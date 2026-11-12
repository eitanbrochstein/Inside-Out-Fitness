import { ChevronDown, Plus, Trophy, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import type { BlockWithSets, WorkoutSet } from '@/data/types'
import { copyPlan, newSetRow } from '@/data/useWorkout'
import { fromTimeField, MEASURE_HEAD, MEASURE_NAME, measureOf, toTimeField, type Measure } from '@/lib/blocks'
import { formatSetTime } from '@/lib/format'
import { success, tick } from '@/lib/haptics'
import {
  formatNumber,
  freezeSet,
  fromDisplay,
  isPercentSet,
  percentLoad,
  plannedLoadKg,
  toDisplay,
  type LoadContext,
} from '@/lib/load'
import { blockRecords, type RecordKind } from '@/lib/session'
import { Button } from '@/ui/Button'
import { cn } from '@/ui/cn'
import { ease, spring } from '@/ui/motion'
import { NumberField } from '@/ui/NumberField'
import { loadContextFor, priorBest, showsLiveRecords, useWorkoutPage } from './context'

const headCls = 'text-micro font-semibold uppercase text-faint'
const EDIT_GRID = 'grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)_32px] items-center gap-2'
const TRAIN_GRID = 'grid grid-cols-[24px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_44px] items-center gap-2'

const show = (kg: number | null, ctx: LoadContext) => (kg == null ? null : toDisplay(kg, ctx.unit))

const RECORD_LABEL: Record<RecordKind, string> = { weight: 'heaviest yet', e1rm: 'best estimated 1RM', reps: 'most reps' }

export function SetTable({ block }: { block: BlockWithSets }) {
  const page = useWorkoutPage()
  const ctx = loadContextFor(page, block)
  const perHand = block.exercise?.load_basis === 'per_hand'
  const unitHead = `${ctx.unit}${perHand ? ' / hand' : ''}`
  const maxHead = block.max_kind === 'training_max' ? '% TM' : '% 1RM'
  const measure = measureOf(block)
  const sets = block.workout_sets

  const addSet = () => {
    const last = sets.at(-1)
    page.actions.addSet.mutate(
      newSetRow({
        block_id: block.id,
        owner_id: page.doc.owner_id,
        position: (last?.position ?? -1) + 1,
        ...(last ? copyPlan(last) : {}),
      }),
    )
  }

  const records = showsLiveRecords(page) ? blockRecords(sets, priorBest(page, block.exercise_id)) : new Map<string, RecordKind>()

  if (page.mode === 'edit') {
    return (
      <div>
        <div className={cn(EDIT_GRID, 'mb-1.5 px-1')}>
          <span className={headCls}>Set</span>
          <button
            type="button"
            onClick={() => page.openMeasureSheet(block)}
            aria-label={`Sets count ${MEASURE_NAME[measure].toLowerCase()}. Change`}
            className={cn(headCls, 'flex h-6 items-center justify-center gap-0.5 text-accent-text active:opacity-60')}
          >
            {MEASURE_HEAD[measure]}
            <ChevronDown className="size-3" strokeWidth={3} />
          </button>
          <span className={cn(headCls, 'text-center')}>{maxHead}</span>
          <span className={cn(headCls, 'text-center')}>{unitHead}</span>
          <span />
        </div>
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {sets.map((s, i) => (
              <motion.li
                key={s.id}
                layout="position"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease }}
              >
                <SetRowEdit set={s} index={i} ctx={ctx} measure={measure} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <Button variant="secondary" block className="mt-3" onClick={addSet}>
          <Plus className="size-[18px]" strokeWidth={2.4} /> Add Set
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className={cn(TRAIN_GRID, 'mb-1.5 px-1')}>
        <span className={headCls}>Set</span>
        <span className={headCls}>Target</span>
        <span className={cn(headCls, 'text-center')}>{unitHead}</span>
        <span className={cn(headCls, 'text-center')}>{MEASURE_HEAD[measure]}</span>
        <span />
      </div>
      <ul className="flex flex-col gap-1.5">
        {sets.map((s, i) => (
          <li key={s.id}>
            <SetRowTrain set={s} index={i} ctx={ctx} block={block} measure={measure} record={records.get(s.id)} />
          </li>
        ))}
      </ul>
      {sets.length === 0 && (
        <p className="py-3 text-center text-subhead text-muted">{page.readOnly ? 'No sets planned.' : 'No sets planned. Switch to Edit to add some.'}</p>
      )}
    </div>
  )
}

const timeLabel = (measure: Measure) => (measure === 'min' ? 'minutes' : 'seconds')

function SetRowEdit({ set, index, ctx, measure }: { set: WorkoutSet; index: number; ctx: LoadContext; measure: Measure }) {
  const { actions, isTemplate } = useWorkoutPage()
  const update = (patch: Parameters<typeof actions.updateSet.mutate>[0]['patch']) => actions.updateSet.mutate({ id: set.id, patch })
  const planned = plannedLoadKg(set, ctx)
  const percent = isPercentSet(set)

  const setPercent = (value: number | null) => {
    if (value == null || value <= 0) {
      // Clearing the % keeps the computed load as a typed load.
      update({ target_percent: null, target_weight_kg: planned, basis_max_kg: null, prescribed_load_kg: null })
      return
    }
    const pct = Math.min(value, 150)
    // A frozen set recalculates from the max it was frozen with, never the current one.
    const prescribed = set.basis_max_kg != null ? (percentLoad({ ...ctx, maxKg: set.basis_max_kg, percent: pct })?.kg ?? null) : null
    update({ target_percent: pct, target_weight_kg: null, prescribed_load_kg: prescribed })
  }

  const setLoad = (value: number | null) =>
    update({ target_weight_kg: value == null ? null : fromDisplay(value, ctx.unit), target_percent: null, basis_max_kg: null, prescribed_load_kg: null })

  const remove = () => {
    actions.deleteSet.mutate(set)
    toast('Set removed', { action: { label: 'Undo', onClick: () => actions.restoreSet.mutate(set) }, duration: 6000 })
  }

  return (
    <div className={cn(EDIT_GRID, 'rounded-tile bg-(--glass-control) px-1 py-1')}>
      <span className="pl-1 text-callout font-bold tabular-nums">{index + 1}</span>
      {measure === 'reps' ? (
        <NumberField
          key="reps"
          aria-label={`Set ${index + 1} reps`}
          decimals={false}
          value={set.target_reps}
          placeholder="–"
          onCommit={(v) => update({ target_reps: v })}
        />
      ) : (
        <NumberField
          key={measure}
          aria-label={`Set ${index + 1} ${timeLabel(measure)}`}
          decimals={measure === 'min'}
          value={toTimeField(set.target_seconds, measure)}
          placeholder="–"
          onCommit={(v) => update({ target_seconds: fromTimeField(v, measure) })}
        />
      )}
      <NumberField
        aria-label={`Set ${index + 1} percent of max`}
        value={set.target_percent}
        placeholder="–"
        onCommit={setPercent}
        className={percent ? '' : 'text-faint'}
      />
      <NumberField
        aria-label={`Set ${index + 1} load`}
        value={show(planned, ctx)}
        placeholder={percent ? (isTemplate ? 'auto' : '—') : '–'}
        onCommit={setLoad}
        className={cn('font-semibold', percent && 'border-transparent bg-transparent bg-none shadow-none')}
      />
      <button
        type="button"
        aria-label={`Remove set ${index + 1}`}
        onClick={remove}
        className="flex size-8 items-center justify-center rounded-full text-faint transition active:scale-90 active:bg-(--glass-press)"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

function SetRowTrain({
  set,
  index,
  ctx,
  block,
  measure,
  record,
}: {
  set: WorkoutSet
  index: number
  ctx: LoadContext
  block: BlockWithSets
  measure: Measure
  record: RecordKind | undefined
}) {
  const timed = measure !== 'reps'
  const page = useWorkoutPage()
  const { actions, doc, readOnly } = page
  const stats = block.exercise_id ? page.stats.get(block.exercise_id) : undefined
  const planned = plannedLoadKg(set, ctx)
  const hintKg = planned ?? stats?.last_weight_kg ?? null
  const done = !!set.completed_at
  const bodyweight = block.exercise?.equipment === 'bodyweight'

  const loggedKg = set.actual_weight_kg
  const deviates =
    done &&
    (timed
      ? set.target_seconds != null && set.actual_seconds !== set.target_seconds
      : (set.target_reps != null && set.actual_reps !== set.target_reps) ||
        (planned != null && loggedKg != null && Math.abs(loggedKg - planned) > 0.01))

  const update = (patch: Parameters<typeof actions.updateSet.mutate>[0]['patch']) => actions.updateSet.mutate({ id: set.id, patch })

  const toggleDone = () => {
    if (done) {
      tick()
      update({ completed_at: null })
      return
    }
    if (doc.status === 'planned') actions.updateWorkout.mutate({ status: 'in_progress', started_at: new Date().toISOString() })
    // A timed set logs its time; reps stay untouched, so they never count toward reps or records.
    const logged = {
      completed_at: new Date().toISOString(),
      actual_weight_kg: set.actual_weight_kg ?? hintKg,
      ...(timed ? { actual_seconds: set.actual_seconds ?? set.target_seconds } : { actual_reps: set.actual_reps ?? set.target_reps }),
    }
    // A record gets a stronger buzz than an ordinary set.
    const live = showsLiveRecords(page)
    const isRecord =
      live && blockRecords(block.workout_sets.map((s) => (s.id === set.id ? { ...s, ...logged } : s)), priorBest(page, block.exercise_id)).has(set.id)
    if (isRecord) success()
    else tick()
    update({ ...logged, ...freezeSet(set, ctx) })
  }

  const amount = timed ? (set.target_seconds != null ? formatSetTime(set.target_seconds) : null) : set.target_reps != null ? `${set.target_reps}` : null
  const target =
    amount == null && planned == null && set.target_percent == null
      ? '—'
      : [
          amount,
          planned != null ? formatNumber(toDisplay(planned, ctx.unit)) : set.target_percent != null ? `${formatNumber(set.target_percent)}%` : null,
        ]
          .filter(Boolean)
          .join(' × ') || '—'

  return (
    <div
      className={cn(
        TRAIN_GRID,
        'rounded-tile px-1 py-1 transition-colors duration-300',
        done ? (record ? 'bg-pr-soft' : 'bg-accent-soft') : 'bg-(--glass-control)',
      )}
    >
      <span className="relative pl-1 text-callout font-bold tabular-nums">
        {record ? (
          <motion.span
            key="record"
            initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={spring.pop}
            className="flex text-pr"
          >
            <Trophy aria-label={`Set ${index + 1}: ${RECORD_LABEL[record]}`} className="size-4" strokeWidth={2.4} />
          </motion.span>
        ) : (
          index + 1
        )}
        {deviates && <span aria-label="Differs from plan" className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-warn" />}
      </span>
      <span className={cn('truncate text-subhead tabular-nums', deviates ? 'text-warn' : 'text-muted')}>{target}</span>
      <NumberField
        aria-label={`Set ${index + 1} weight`}
        disabled={readOnly}
        value={show(set.actual_weight_kg, ctx)}
        placeholder={hintKg != null ? formatNumber(toDisplay(hintKg, ctx.unit)) : bodyweight ? 'BW' : '–'}
        onCommit={(v) => update({ actual_weight_kg: v == null ? null : fromDisplay(v, ctx.unit) })}
        className="font-semibold"
      />
      {timed ? (
        <NumberField
          key={measure}
          aria-label={`Set ${index + 1} ${timeLabel(measure)} done`}
          disabled={readOnly}
          decimals={measure === 'min'}
          value={toTimeField(set.actual_seconds, measure)}
          placeholder={set.target_seconds != null ? String(toTimeField(set.target_seconds, measure)) : '–'}
          onCommit={(v) => update({ actual_seconds: fromTimeField(v, measure) })}
          className="font-semibold"
        />
      ) : (
        <NumberField
          key="reps"
          aria-label={`Set ${index + 1} reps done`}
          disabled={readOnly}
          decimals={false}
          value={set.actual_reps}
          placeholder={set.target_reps != null ? String(set.target_reps) : '–'}
          onCommit={(v) => update({ actual_reps: v })}
          className="font-semibold"
        />
      )}
      <button
        type="button"
        aria-label={done ? `Undo set ${index + 1}` : `Complete set ${index + 1}`}
        aria-pressed={done}
        disabled={readOnly}
        onClick={toggleDone}
        className="flex size-11 items-center justify-center"
      >
        <motion.span
          animate={done ? { scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.3, ease }}
          className={cn('flex size-9 items-center justify-center rounded-full', done ? 'glass-tint' : 'glass-field')}
        >
          {/* The check draws itself in as the set is logged. */}
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
              transition={{ duration: 0.25, ease }}
            />
          </svg>
        </motion.span>
      </button>
    </div>
  )
}
