import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, History, LineChart, Plus, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { trendPoints } from '@/features/progress/trend'
import { MAX_LABEL, type MaxKind, type SetLogRow } from '@/data/types'
import { equipmentLabel, useExerciseMap, useUpdateExercise } from '@/data/useExercises'
import { useAddMax, useCurrentMaxes, useDeleteMax, useMaxes } from '@/data/useMaxes'
import { useUnits } from '@/data/useProfile'
import { useSetLog } from '@/data/useStats'
import { formatDay, formatTimestamp, parseISODate } from '@/lib/dates'
import { formatNumber, formatWeight, toDisplay, type Unit } from '@/lib/load'
import { topSet } from '@/lib/progress'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { EmptyState } from '@/ui/EmptyState'
import { IconButton } from '@/ui/IconButton'
import { ListGroup, ListRow } from '@/ui/ListRow'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'
import { MaxSheet } from './MaxSheet'
import { groupSessions } from './sessions'

// Charts load on their own, so recharts stays out of the main bundle.
const charts = () => import('@/features/progress/ExerciseCharts')
const TrendChart = lazy(() => charts().then((m) => ({ default: m.TrendChart })))
const RepRanges = lazy(() => charts().then((m) => ({ default: m.RepRanges })))
const MaxHistoryChart = lazy(() => charts().then((m) => ({ default: m.MaxHistoryChart })))

const compactSet = (r: SetLogRow, unit: Unit) =>
  r.weight_kg == null ? `${r.reps ?? 0} reps` : `${formatNumber(toDisplay(r.weight_kg, unit))}×${r.reps ?? 0}`

const toTop = (rows: SetLogRow[]) => topSet(rows.map((r) => ({ weightKg: r.weight_kg, reps: r.reps ?? 0 })))

function StatRow({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-callout text-muted">{label}</span>
      <span className="text-right">
        <span className="block text-body font-semibold tabular-nums">{value}</span>
        {hint && <span className="block text-caption text-faint">{hint}</span>}
      </span>
    </div>
  )
}

export function ExerciseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exercise = useExerciseMap().get(id!)
  const { unit } = useUnits()
  const maxes = useCurrentMaxes()
  const allMaxes = useMaxes().data
  const maxHistory = useMemo(() => allMaxes?.filter((m) => m.exercise_id === id) ?? [], [allMaxes, id])
  const addMax = useAddMax()
  const deleteMax = useDeleteMax()
  const updateExercise = useUpdateExercise()
  const log = useSetLog(id!)
  const [maxSheet, setMaxSheet] = useState<{ open: boolean; kind: MaxKind; n: number }>({ open: false, kind: 'one_rm', n: 0 })

  const sessions = useMemo(() => groupSessions(log.data ?? []), [log.data])
  const oneRMs = useMemo(() => maxHistory.filter((m) => m.kind === 'one_rm'), [maxHistory])
  const trend = useMemo(() => trendPoints(log.data ?? [], oneRMs, unit), [log.data, oneRMs, unit])
  const last = sessions[0] ? toTop(sessions[0].sets) : null
  const best = log.data?.length ? toTop(log.data) : null
  const bestRow = best && log.data?.find((r) => r.weight_kg === best.weightKg && (r.reps ?? 0) === best.reps)

  if (!exercise) {
    return (
      <Page>
        <PageHeader back title={<Skeleton className="h-8 w-48 rounded-lg" />} />
      </Page>
    )
  }

  const perHand = exercise.load_basis === 'per_hand'
  const fmt = (kg: number | null, reps: number) => (kg == null ? `${reps} reps` : `${formatWeight(kg, unit, { perHand })} × ${reps}`)

  return (
    <Page>
      <PageHeader
        back
        eyebrow={exercise.category}
        title={exercise.name}
        subtitle={[equipmentLabel(exercise.equipment), perHand && 'per hand', exercise.owner_id && 'custom'].filter(Boolean).join(' · ')}
      />

      <SectionLabel className="mb-2 px-1">Maxes</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {(['one_rm', 'training_max'] as const).map((kind) => {
          const m = maxes.get(exercise.id, kind)
          return (
            <button
              key={kind}
              type="button"
              data-interactive
              onClick={() => setMaxSheet({ open: true, kind, n: Date.now() })}
              className="glass-card flex min-h-[104px] select-none flex-col items-start justify-between gap-2 rounded-card p-4 text-left active:scale-[0.97]"
            >
              <span className="text-caption font-semibold text-muted">{kind === 'one_rm' ? 'Stored 1RM' : 'Training max'}</span>
              {m ? (
                <span>
                  <span className="block font-display text-title-2 font-semibold">{formatWeight(m.value_kg, unit, { perHand })}</span>
                  <span className="block text-caption text-faint">{formatDay(parseISODate(m.recorded_on), { relative: true })}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-callout font-semibold text-accent-text">
                  <Plus className="size-4" strokeWidth={2.4} /> Set
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-2 px-1 text-footnote text-faint">Optional. Percentage-based sets calculate from these.</p>

      {trend.data.length > 1 && (
        <Card className="mt-3 px-2 pt-4 pb-2">
          <div className="mb-3 px-2">
            <h2 className="text-callout font-semibold">Trend</h2>
          </div>
          <Suspense fallback={<Skeleton className="mx-2 mb-2 h-64" />}>
            <TrendChart data={trend.data} bodyweight={trend.bodyweight} unit={unit} />
          </Suspense>
        </Card>
      )}

      <SectionLabel className="mt-7 mb-2 px-1">Records</SectionLabel>
      {log.isPending ? (
        <Skeleton className="h-36" />
      ) : sessions.length ? (
        <Card className="divide-y divide-border overflow-hidden">
          <StatRow label="Last performed" value={last ? fmt(last.weightKg, last.reps) : '—'} hint={formatTimestamp(sessions[0].performedAt)} />
          <StatRow
            label="Heaviest recorded"
            value={best ? fmt(best.weightKg, best.reps) : '—'}
            hint={bestRow?.performed_at ? formatTimestamp(bestRow.performed_at) : undefined}
          />
          <StatRow label="Sessions" value={sessions.length} />
          <ListRow
            to={`/progress/${exercise.id}`}
            title={
              <span className="flex items-center gap-2 text-accent-text">
                <LineChart className="size-4" /> View progress
              </span>
            }
            trailing="chevron"
          />
        </Card>
      ) : (
        <EmptyState icon={<History />} title="No history yet">
          Log this exercise in a workout and it shows up here.
        </EmptyState>
      )}

      {sessions.length > 0 && (
        <Card className="mt-3 p-4">
          <h2 className="mb-4 text-callout font-semibold">Rep ranges</h2>
          <Suspense fallback={<Skeleton className="h-32" />}>
            <RepRanges log={log.data ?? []} />
          </Suspense>
        </Card>
      )}

      {sessions.length > 0 && (
        <>
          <SectionLabel className="mt-7 mb-2 px-1">History</SectionLabel>
          <div className="flex flex-col gap-2">
            {sessions.slice(0, 50).map((s) => (
              <Link
                key={s.workoutId}
                to={`/w/${s.workoutId}`}
                viewTransition
                data-interactive
                className="glass-card flex select-none items-center gap-3 rounded-card px-4 py-3.5 [content-visibility:auto] [contain-intrinsic-size:auto_72px] active:scale-[0.98]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-callout font-semibold">{s.title || 'Untitled workout'}</span>
                    <span className="shrink-0 text-footnote text-faint">{formatTimestamp(s.performedAt)}</span>
                  </span>
                  <span className="mt-1 block truncate text-subhead text-muted tabular-nums">
                    {s.sets.map((r) => compactSet(r, unit)).join('  ·  ')}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </Link>
            ))}
          </div>
        </>
      )}

      {maxHistory.length > 0 && (
        <>
          <SectionLabel className="mt-7 mb-2 px-1">Max history</SectionLabel>
          {maxHistory.length > 2 && (
            <Card className="mb-3 px-2 pt-4 pb-2">
              <Suspense fallback={<Skeleton className="mx-2 mb-2 h-44" />}>
                <MaxHistoryChart maxes={maxHistory} unit={unit} />
              </Suspense>
            </Card>
          )}
          <ListGroup>
            {maxHistory.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
                <span className="flex-1 text-callout">
                  <span className="font-semibold tabular-nums">{formatWeight(m.value_kg, unit, { perHand })}</span>
                  <span className="text-muted"> · {MAX_LABEL[m.kind as MaxKind]}</span>
                </span>
                <span className="text-footnote text-faint">{formatDay(parseISODate(m.recorded_on), { relative: true })}</span>
                <IconButton
                  aria-label="Remove this max"
                  size="md"
                  onClick={() => {
                    deleteMax.mutate(m.id)
                    toast('Max removed', { action: { label: 'Undo', onClick: () => addMax.mutate(m) }, duration: 6000 })
                  }}
                >
                  <X className="size-4" />
                </IconButton>
              </div>
            ))}
          </ListGroup>
        </>
      )}

      {exercise.owner_id && (
        <Button
          variant="danger-soft"
          block
          className="mt-8"
          onClick={() => {
            updateExercise.mutate({ id: exercise.id, archived_at: new Date().toISOString() })
            toast('Exercise archived', {
              description: 'Its history is kept.',
              action: { label: 'Undo', onClick: () => updateExercise.mutate({ id: exercise.id, archived_at: null }) },
              duration: 6000,
            })
            navigate('/exercises', { replace: true, viewTransition: true })
          }}
        >
          Archive exercise
        </Button>
      )}

      <MaxSheet
        key={maxSheet.n}
        open={maxSheet.open}
        onOpenChange={(open) => setMaxSheet((s) => ({ ...s, open }))}
        exerciseId={exercise.id}
        kind={maxSheet.kind}
      />
    </Page>
  )
}
