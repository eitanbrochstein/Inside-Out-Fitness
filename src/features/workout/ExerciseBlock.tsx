import { Check, ChevronRight, Ellipsis, StickyNote } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import { MAX_LABEL, type BlockWithSets, type ExerciseStats, type MaxKind } from '@/data/types'
import { measureOf } from '@/lib/blocks'
import { formatSetTime } from '@/lib/format'
import { formatWeight, isPercentSet, type Unit } from '@/lib/load'
import { exerciseSummary } from '@/lib/summary'
import { Card } from '@/ui/Card'
import { ProgressRing } from '@/ui/charts/ProgressRing'
import { IconButton } from '@/ui/IconButton'
import { ease } from '@/ui/motion'
import { loadContextFor, useWorkoutPage } from './context'
import { NoteCallout, NoteField } from './Note'
import { SetTable } from './SetTable'

const topSetLabel = (kg: number | null, reps: number | null, unit: Unit) =>
  kg == null ? `${reps ?? 0} reps` : `${formatWeight(kg, unit)} × ${reps ?? 0}`

/** An exercise and its sets. `embedded` sits inside a superset's card, tagged A1, A2… */
export function ExerciseBlock({ block, embedded, tag }: { block: BlockWithSets; embedded?: boolean; tag?: string }) {
  const page = useWorkoutPage()
  const measure = measureOf(block)
  const open = page.expanded.has(block.id)
  const ctx = loadContextFor(page, block)
  const stats = block.exercise_id ? page.stats.get(block.exercise_id) : undefined
  const sets = block.workout_sets
  const doneCount = sets.filter((s) => s.completed_at).length
  const allDone = sets.length > 0 && doneCount === sets.length
  // Completed workouts show the max their loads were calculated from, not today's.
  const frozenBasis = page.doc.status === 'completed' ? (sets.find((s) => s.basis_max_kg != null)?.basis_max_kg ?? null) : null
  const max = page.isTemplate ? null : page.maxes.get(block.exercise_id, block.max_kind)
  const shownMaxKg = frozenBasis ?? max?.value_kg ?? null
  const hasPercent = sets.some(isPercentSet)
  const showMax = !page.isTemplate && (shownMaxKg != null || hasPercent)
  const perHand = block.exercise?.load_basis === 'per_hand'

  const summary = exerciseSummary({
    sets,
    mode: page.summaryMode,
    ctx,
    lastPerformedKg: page.isTemplate ? null : (stats?.last_weight_kg ?? null),
    measure,
  })
  // A timed exercise's history is its times; with none logged yet there's nothing to show.
  const showStats = !!stats && (measure === 'reps' || stats.last_seconds != null)
  const Root = embedded ? 'div' : Card

  return (
    <Root className="overflow-hidden">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => page.toggle(block.id)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 py-4 pr-2 pl-4 text-left select-none"
        >
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              {tag && (
                <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-micro font-bold text-accent-text tabular-nums">{tag}</span>
              )}
              <span className="block truncate text-headline font-semibold">{block.exercise?.name ?? 'Exercise'}</span>
              {!open && block.notes.trim() && <StickyNote aria-label="Has a note" className="size-3.5 shrink-0 text-accent-text" />}
            </span>
            <span className="mt-1 block truncate text-subhead text-muted tabular-nums">{summary}</span>
          </span>
          {page.mode === 'train' && sets.length > 0 && page.summaryMode !== 'edit' && (
            <ProgressRing value={doneCount / sets.length} size={30} stroke={3} label={`${doneCount} of ${sets.length} sets done`}>
              {allDone && <Check className="size-3.5 text-accent" strokeWidth={3} />}
            </ProgressRing>
          )}
          {!(open && page.mode === 'edit') && (
            <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.25, ease }} className="shrink-0 pr-2 text-faint">
              <ChevronRight className="size-5" />
            </motion.span>
          )}
        </button>
        {open && page.mode === 'edit' && (
          <IconButton aria-label="Exercise actions" className="mr-1" onClick={() => page.openBlockActions(block)}>
            <Ellipsis className="size-5" />
          </IconButton>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
          >
            <div className="px-4 pb-4">
              {page.isTemplate && hasPercent && (
                <p className="mb-3 border-b border-border pb-3 text-subhead text-muted">
                  {page.isCoach
                    ? `Percentages use each client's own ${MAX_LABEL[block.max_kind as MaxKind]} when you assign this.`
                    : `Percentages use your ${MAX_LABEL[block.max_kind as MaxKind]} when you start this.`}
                </p>
              )}
              {(showMax || showStats) && (
                <div className="mb-3 border-b border-border pb-3">
                  {showMax && (
                    <button
                      type="button"
                      disabled={page.readOnly}
                      onClick={() => page.openMaxSheet(block.exercise_id!, block.max_kind as MaxKind)}
                      className="flex h-9 w-full items-center justify-between text-callout"
                    >
                      <span className="text-muted">
                        {frozenBasis != null ? `${MAX_LABEL[block.max_kind as MaxKind]} used` : `Stored ${MAX_LABEL[block.max_kind as MaxKind]}`}
                      </span>
                      {shownMaxKg != null ? (
                        <span className="font-bold tabular-nums">{formatWeight(shownMaxKg, ctx.unit, { perHand })}</span>
                      ) : page.readOnly ? (
                        <span className="text-faint">Not set</span>
                      ) : (
                        <span className="font-semibold text-accent-text">
                          Set {MAX_LABEL[block.max_kind as MaxKind]}
                        </span>
                      )}
                    </button>
                  )}
                  {showStats && <StatsLine stats={stats} href={page.statsHref(block.exercise_id!)} unit={ctx.unit} timed={measure !== 'reps'} />}
                </div>
              )}
              <BlockNote block={block} />
              <SetTable block={block} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Root>
  )
}

function StatsLine({ stats, href, unit, timed }: { stats: ExerciseStats; href: string; unit: Unit; timed: boolean }) {
  const last = timed ? formatSetTime(stats.last_seconds ?? 0) : topSetLabel(stats.last_weight_kg, stats.last_reps, unit)
  const best = timed ? formatSetTime(stats.best_seconds ?? 0) : topSetLabel(stats.best_weight_kg, stats.best_reps, unit)
  return (
    <Link
      to={href}
      viewTransition
      className="flex h-8 items-center gap-1.5 text-footnote text-muted tabular-nums active:opacity-60"
    >
      <span>
        Last <span className="font-semibold text-text">{last}</span>
      </span>
      <span className="text-faint">·</span>
      <span>
        Best <span className="font-semibold text-text">{best}</span>
      </span>
      <ChevronRight className="ml-auto size-4 text-faint" />
    </Link>
  )
}

/** The exercise's note, above its sets: form cues, tempo, reminders. */
function BlockNote({ block }: { block: BlockWithSets }) {
  const { mode, actions, readOnly, notesLocked, noteFrom, clientFirstName, isTemplate, isCoach } = useWorkoutPage()
  if (mode === 'train' || readOnly || notesLocked) {
    return block.notes.trim() ? <NoteCallout text={block.notes} from={noteFrom} className="mb-3" /> : null
  }
  return (
    <NoteField
      value={block.notes}
      onSave={(notes) => actions.updateBlock.mutate({ id: block.id, patch: { notes } })}
      label="Exercise note"
      placeholder={
        clientFirstName
          ? `Cue for ${clientFirstName}: form, tempo, reminders…`
          : isTemplate && isCoach
            ? 'Cue for your clients: form, tempo, reminders…'
            : 'Add a note: form cues, reminders…'
      }
      className="mb-3"
    />
  )
}
