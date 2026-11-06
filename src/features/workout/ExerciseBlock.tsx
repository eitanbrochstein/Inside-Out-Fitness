import { Check, ChevronRight, Ellipsis } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import { MAX_LABEL, type BlockWithSets, type ExerciseStats, type MaxKind } from '@/data/types'
import { formatWeight, isPercentSet, type Unit } from '@/lib/load'
import { useAutosave, useDraft } from '@/lib/useAutosave'
import { exerciseSummary } from '@/lib/summary'
import { AutoTextarea } from '@/ui/AutoTextarea'
import { Card } from '@/ui/Card'
import { ProgressRing } from '@/ui/charts/ProgressRing'
import { IconButton } from '@/ui/IconButton'
import { ease } from '@/ui/motion'
import { loadContextFor, useWorkoutPage } from './context'
import { SetTable } from './SetTable'

const topSetLabel = (kg: number | null, reps: number | null, unit: Unit) =>
  kg == null ? `${reps ?? 0} reps` : `${formatWeight(kg, unit)} × ${reps ?? 0}`

export function ExerciseBlock({ block }: { block: BlockWithSets }) {
  const page = useWorkoutPage()
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
  })

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => page.toggle(block.id)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 py-4 pr-2 pl-4 text-left select-none"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-headline font-semibold">{block.exercise?.name ?? 'Exercise'}</span>
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
              {(showMax || stats) && (
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
                  {stats && <StatsLine stats={stats} href={page.statsHref(block.exercise_id!)} unit={ctx.unit} />}
                </div>
              )}
              <SetTable block={block} />
              <BlockNotes block={block} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function StatsLine({ stats, href, unit }: { stats: ExerciseStats; href: string; unit: Unit }) {
  return (
    <Link
      to={href}
      viewTransition
      className="flex h-8 items-center gap-1.5 text-footnote text-muted tabular-nums active:opacity-60"
    >
      <span>
        Last <span className="font-semibold text-text">{topSetLabel(stats.last_weight_kg, stats.last_reps, unit)}</span>
      </span>
      <span className="text-faint">·</span>
      <span>
        Best <span className="font-semibold text-text">{topSetLabel(stats.best_weight_kg, stats.best_reps, unit)}</span>
      </span>
      <ChevronRight className="ml-auto size-4 text-faint" />
    </Link>
  )
}

function BlockNotes({ block }: { block: BlockWithSets }) {
  const { mode, actions } = useWorkoutPage()
  const { draft, setDraft, setFocused } = useDraft(block.notes)
  const { schedule, flush } = useAutosave((notes: string) => actions.updateBlock.mutate({ id: block.id, patch: { notes } }))

  if (mode === 'train') {
    return block.notes ? <p className="mt-3 text-callout whitespace-pre-wrap text-muted">{block.notes}</p> : null
  }
  return (
    <AutoTextarea
      aria-label="Exercise notes"
      placeholder="Add a note…"
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        flush()
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        schedule(e.target.value)
      }}
      className="mt-3 text-body leading-snug text-muted"
    />
  )
}
