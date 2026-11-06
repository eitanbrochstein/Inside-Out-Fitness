import { useState, type ReactNode } from 'react'
import { ArrowUpDown, Check, Copy, Dumbbell, Scale, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import type { BlockWithSets } from '@/data/types'
import { allSets, duplicateOf } from '@/data/useWorkout'
import { todayISO } from '@/lib/dates'
import { plural } from '@/lib/format'
import { success } from '@/lib/haptics'
import { freezeSet } from '@/lib/load'
import { sessionRecords } from '@/lib/session'
import { Button } from '@/ui/Button'
import { ProgressRing } from '@/ui/charts/ProgressRing'
import { DatePill } from '@/ui/DatePill'
import { spring } from '@/ui/motion'
import { Sheet, SheetAction } from '@/ui/Sheet'
import { loadContextFor, priorBest, useWorkoutPage } from './context'
import { blockLabel } from './ReorderList'
import { SessionSummary, type SummaryRecord } from './SessionSummary'

export function BlockActionsSheet({
  block,
  open,
  onOpenChange,
  onReorder,
  onChangeExercise,
}: {
  block: BlockWithSets | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReorder: () => void
  onChangeExercise: (block: BlockWithSets) => void
}) {
  const { actions, deleteBlockWithUndo, doc } = useWorkoutPage()
  if (!block) return null
  const close = () => onOpenChange(false)
  const isTM = block.max_kind === 'training_max'

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={blockLabel(block)}>
      <div className="flex flex-col pb-2">
        <SheetAction
          icon={<Copy />}
          onClick={() => {
            actions.duplicateBlock.mutate({ source: block, copy: duplicateOf(block) })
            close()
          }}
        >
          Duplicate
        </SheetAction>
        {doc.workout_blocks.length > 1 && (
          <SheetAction
            icon={<ArrowUpDown />}
            onClick={() => {
              close()
              onReorder()
            }}
          >
            Reorder blocks
          </SheetAction>
        )}
        {block.type === 'exercise' && (
          <>
            <SheetAction
              icon={<Dumbbell />}
              onClick={() => {
                close()
                onChangeExercise(block)
              }}
            >
              Change exercise
            </SheetAction>
            <SheetAction
              icon={<Scale />}
              onClick={() => {
                actions.updateBlock.mutate({ id: block.id, patch: { max_kind: isTM ? 'one_rm' : 'training_max' } })
                close()
              }}
            >
              {isTM ? 'Base percentages on 1RM' : 'Base percentages on training max'}
            </SheetAction>
          </>
        )}
        <SheetAction
          danger
          icon={<Trash2 />}
          onClick={() => {
            deleteBlockWithUndo(block)
            close()
          }}
        >
          Delete block
        </SheetAction>
      </div>
    </Sheet>
  )
}

export function FinishSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const page = useWorkoutPage()
  const [finished, setFinished] = useState(false)
  const sets = allSets(page.doc)
  const done = sets.filter((s) => s.completed_at).length
  const records: SummaryRecord[] = sessionRecords(page.doc.workout_blocks, (id) => priorBest(page, id)).map(({ block, set, kind }) => ({
    key: block.id,
    exercise: block.exercise?.name ?? 'Exercise',
    kind,
    weightKg: set.actual_weight_kg,
    reps: set.actual_reps,
    perHand: block.exercise?.load_basis === 'per_hand',
  }))

  const change = (o: boolean) => {
    if (!o) setFinished(false)
    onOpenChange(o)
  }

  const finish = () => {
    // Freeze every remaining percent set so the record keeps the loads prescribed today.
    const freezes = page.doc.workout_blocks.flatMap((b) => {
      const ctx = loadContextFor(page, b)
      return b.workout_sets.flatMap((s) => {
        const f = freezeSet(s, ctx)
        return f ? [{ id: s.id, basis_max_kg: f.basis_max_kg!, prescribed_load_kg: f.prescribed_load_kg! }] : []
      })
    })
    page.actions.finishWorkout.mutate(freezes)
    if (records.length) success()
    setFinished(true)
  }

  if (finished) {
    return (
      <Sheet
        open={open}
        onOpenChange={change}
        title="Workout complete"
        description={records.length ? `${plural(records.length, 'new record')}. Saved to your history.` : 'Saved to your history.'}
      >
        <div className="flex flex-col gap-4 pt-1 pb-2">
          <div className="flex justify-center py-2">
            <ProgressRing value={1} size={96} stroke={8} label="Workout complete">
              <motion.span initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.pop, delay: 0.35 }}>
                <Check className="size-10 text-accent" strokeWidth={2.6} />
              </motion.span>
            </ProgressRing>
          </div>
          <SessionSummary doc={page.doc} unit={page.units.unit} records={records} />
          <Button size="lg" block onClick={() => change(false)}>
            Done
          </Button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={change}
      title="Finish workout?"
      description={
        done === sets.length
          ? `All ${sets.length} sets logged. Nice work.`
          : `${done} of ${sets.length} sets logged. Unlogged sets stay in the plan but won't count toward history.`
      }
    >
      <div className="flex flex-col gap-4 pt-1 pb-2">
        <SessionSummary doc={page.doc} unit={page.units.unit} records={records} />
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={finish}>
            Finish workout
          </Button>
          <Button size="lg" variant="ghost" block onClick={() => change(false)}>
            Keep training
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

export interface SheetItem {
  icon: ReactNode
  label: string
  onClick: () => void
}

/** Page-level actions plus an optional destructive action that asks for confirmation inside the sheet. */
export function WorkoutActionsSheet({
  open,
  onOpenChange,
  title,
  items,
  destructive,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  items: SheetItem[]
  destructive?: { label: string; warning: string; confirm: string; onConfirm: () => void }
}) {
  const [confirming, setConfirming] = useState(false)
  const change = (o: boolean) => {
    if (!o) setConfirming(false)
    onOpenChange(o)
  }

  return (
    <Sheet open={open} onOpenChange={change} title={title}>
      {confirming && destructive ? (
        <div className="flex flex-col gap-2 pt-1 pb-2">
          <p className="pb-2 text-callout text-muted">{destructive.warning}</p>
          <Button size="lg" variant="danger" block onClick={destructive.onConfirm}>
            {destructive.confirm}
          </Button>
          <Button size="lg" variant="ghost" block onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-col pb-2">
          {items.map((item) => (
            <SheetAction
              key={item.label}
              icon={item.icon}
              onClick={() => {
                change(false)
                item.onClick()
              }}
            >
              {item.label}
            </SheetAction>
          ))}
          {destructive && (
            <SheetAction danger icon={<Trash2 />} onClick={() => setConfirming(true)}>
              {destructive.label}
            </SheetAction>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** Puts a copy of a saved workout on a day of your plan. */
export function ScheduleSheet({
  open,
  onOpenChange,
  onSchedule,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule: (date: string) => void
}) {
  const [date, setDate] = useState(todayISO)
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule"
      description="A copy goes on your plan for that day. This saved workout stays as it is."
    >
      <div className="flex flex-col gap-4 pt-1 pb-3">
        <div className="flex items-center justify-between text-callout">
          <span className="text-muted">Day</span>
          <DatePill size="md" label="Day" value={date} onChange={(d) => d && setDate(d)} />
        </div>
        <Button
          size="lg"
          block
          onClick={() => {
            onOpenChange(false)
            onSchedule(date)
          }}
        >
          Add to plan
        </Button>
      </div>
    </Sheet>
  )
}
