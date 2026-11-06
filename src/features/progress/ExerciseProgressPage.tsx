import { useMemo } from 'react'
import { ChevronRight, LineChart as LineChartIcon, Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useClients } from '@/data/useCoaching'
import { useExerciseMap } from '@/data/useExercises'
import { useMaxes } from '@/data/useMaxes'
import { useUnits } from '@/data/useProfile'
import { useSetLog } from '@/data/useStats'
import { formatTimestamp } from '@/lib/dates'
import { plural } from '@/lib/format'
import { formatNumber } from '@/lib/load'
import { Card, CardHeader } from '@/ui/Card'
import { EmptyState } from '@/ui/EmptyState'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'
import { RepRanges, TrendChart } from './ExerciseCharts'
import { trendPoints } from './trend'

export function ExerciseProgressPage() {
  const { exerciseId, clientId } = useParams()
  const client = useClients({ enabled: !!clientId }).byId.get(clientId ?? '')
  const exercise = useExerciseMap().get(exerciseId!)
  const { unit } = useUnits()
  const log = useSetLog(exerciseId!, clientId)
  const maxes = useMaxes(clientId).data

  const oneRMs = useMemo(() => (maxes ?? []).filter((m) => m.exercise_id === exerciseId && m.kind === 'one_rm'), [maxes, exerciseId])
  const { data, bodyweight } = useMemo(() => trendPoints(log.data ?? [], oneRMs, unit), [log.data, oneRMs, unit])
  const records = data.filter((d) => d.pr).length

  return (
    <Page>
      <PageHeader
        back
        eyebrow={clientId ? `${client?.name ?? 'Client'} · Progress` : 'Progress'}
        title={exercise?.name ?? ''}
        subtitle={data.length ? `${plural(data.length, 'session')} logged${records ? ` · ${plural(records, 'record')}` : ''}` : undefined}
      />

      {log.isPending ? (
        <Skeleton className="h-72" />
      ) : data.length === 0 ? (
        <EmptyState icon={<LineChartIcon />} title="No history yet">
          Log this exercise in a workout to see its trend.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <Card className="px-2 pt-4 pb-2">
            <CardHeader className="mb-3 px-2" title={bodyweight ? 'Reps per session' : `Strength per session (${unit})`} />
            <TrendChart data={data} bodyweight={bodyweight} unit={unit} />
          </Card>

          <Card className="p-4">
            <CardHeader className="mb-4" title="Rep ranges" subtitle="Sets logged in each range" />
            <RepRanges log={log.data ?? []} />
          </Card>

          <SectionLabel className="mt-4 px-1">Sessions</SectionLabel>
          <Card className="overflow-hidden">
            <table className="w-full text-left text-subhead tabular-nums">
              <thead>
                <tr className="border-b border-border text-micro font-semibold text-faint uppercase">
                  <th className="py-2.5 pl-4 font-semibold">Date</th>
                  <th className="py-2.5 font-semibold">Top set</th>
                  {!bodyweight && <th className="py-2.5 font-semibold">Est. 1RM</th>}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...data].reverse().map((d) => (
                  <tr key={d.workoutId} className="relative active:bg-(--glass-press)">
                    <td className="py-3 pl-4 text-muted">
                      <Link to={`/w/${d.workoutId}`} viewTransition className="after:absolute after:inset-0">
                        {formatTimestamp(new Date(d.t).toISOString())}
                      </Link>
                    </td>
                    <td className="py-3 font-semibold">
                      <span className="flex items-center gap-1.5">
                        {d.top == null ? `${d.topReps} reps` : `${formatNumber(d.top)} × ${d.topReps}`}
                        {d.pr && <Trophy aria-label="Record" className="size-3.5 text-pr" strokeWidth={2.4} />}
                      </span>
                    </td>
                    {!bodyweight && <td className="py-3 text-muted">{d.value == null ? '—' : formatNumber(d.value)}</td>}
                    <td className="pr-3 text-faint">
                      <ChevronRight className="size-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {!clientId && (
            <Link
              to={`/exercises/${exerciseId}`}
              viewTransition
              className="mt-1 flex items-center justify-center gap-1 py-2 text-callout font-semibold text-accent-text"
            >
              Exercise details <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      )}
    </Page>
  )
}
