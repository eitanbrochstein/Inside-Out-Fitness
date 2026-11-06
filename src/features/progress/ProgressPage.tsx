import { useMemo } from 'react'
import { LineChart, Trophy } from 'lucide-react'
import { useParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useClients } from '@/data/useCoaching'
import { useExerciseMap } from '@/data/useExercises'
import { SUMMARY_WEEKS, usePersonalRecords, useTrainingSummary, useWeeklyGoal, type PersonalRecord } from '@/data/useInsights'
import { useUnits } from '@/data/useProfile'
import { useAllStats } from '@/data/useStats'
import type { Exercise } from '@/data/types'
import { formatTimestamp } from '@/lib/dates'
import { formatChange, formatCompact, formatVolume, plural } from '@/lib/format'
import { categorySplit, dailyActivity, heatLevels, weekDelta, weeklyTotals, weekStreak, type DayActivity } from '@/lib/insights'
import { formatWeight, toDisplay, type Unit } from '@/lib/load'
import { startOfWeek } from '@/lib/progress'
import { Card, CardHeader } from '@/ui/Card'
import { BarList } from '@/ui/charts/BarList'
import { CalendarHeatmap } from '@/ui/charts/CalendarHeatmap'
import { ChartTooltip } from '@/ui/charts/kit'
import { axisTick, compactTick, gradient, shortDate, useChartAnimation } from '@/ui/charts/shared'
import { EmptyState } from '@/ui/EmptyState'
import { ListGroup, ListRow } from '@/ui/ListRow'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'
import { StatTile } from '@/ui/StatTile'

const WEEKS = 12
const HEAT_WEEKS = 17
const SPLIT_WEEKS = 4

const RECORD_LABEL: Record<PersonalRecord['kind'], string> = { weight: 'Heaviest', e1rm: 'Est. 1RM', reps: 'Most reps' }

function recordSet(r: PersonalRecord, exercise: Exercise | undefined, unit: Unit) {
  if (r.weightKg == null) return `${r.reps} reps`
  return `${formatWeight(r.weightKg, unit, { perHand: exercise?.load_basis === 'per_hand' })} × ${r.reps}`
}

/** Your progress at /progress, or a client's at /coach/clients/:clientId/progress. */
export function ProgressPage() {
  const { clientId } = useParams()
  const client = useClients({ enabled: !!clientId }).byId.get(clientId ?? '')
  const base = clientId ? `/coach/clients/${clientId}/progress` : '/progress'
  const summary = useTrainingSummary({ ownerId: clientId })
  const stats = useAllStats(clientId)
  const since = useMemo(() => {
    const d = startOfWeek(new Date())
    d.setDate(d.getDate() - 7 * (WEEKS - 1))
    return d
  }, [])
  const records = usePersonalRecords({ ownerId: clientId, since, limit: 8 })
  const goal = useWeeklyGoal(clientId)
  const exercises = useExerciseMap()
  const { unit } = useUnits()
  const animate = useChartAnimation()

  const rows = useMemo(() => summary.data ?? [], [summary.data])
  const weeks = useMemo(() => weeklyTotals(rows, WEEKS), [rows])
  const days = useMemo(() => dailyActivity(rows, HEAT_WEEKS), [rows])
  const level = useMemo(() => {
    const of = heatLevels(days.map((d) => d.sets))
    return (d: DayActivity) => of(d.sets)
  }, [days])
  const split = useMemo(() => categorySplit(rows, SPLIT_WEEKS), [rows])
  const sessions = weeks.reduce((n, w) => n + w.sessions, 0)
  const volume = weekDelta(weeks.map((w) => w.volumeKg))
  const streak = weekStreak(rows, goal, SUMMARY_WEEKS)
  const bars = weeks.map((w) => ({ t: w.weekStart.getTime(), volume: toDisplay(w.volumeKg, unit), sessions: w.sessions }))

  const list = useMemo(
    () =>
      [...(stats.data ?? [])].sort(
        (a, b) => Number(b.session_count) - Number(a.session_count) || (exercises.get(a.exercise_id)?.name ?? '').localeCompare(exercises.get(b.exercise_id)?.name ?? ''),
      ),
    [stats.data, exercises],
  )

  const describeDay = (d: DayActivity) =>
    d.sessions ? `${plural(d.sessions, 'session')} · ${plural(d.sets, 'set')} · ${formatVolume(d.volumeKg, unit)}` : 'Rest day'

  return (
    <Page>
      {clientId ? (
        <PageHeader back={`/coach/clients/${clientId}`} eyebrow={client?.name ?? 'Client'} title="Progress" subtitle={`Last ${WEEKS} weeks`} />
      ) : (
        <PageHeader title="Progress" subtitle={`Strength trends and consistency · last ${WEEKS} weeks`} />
      )}

      {summary.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-56" />
          <Skeleton className="h-64" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<LineChart />} title="Nothing to chart yet">
          Log a workout to see progress.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Sessions" value={sessions} />
            <StatTile label="Avg / week" value={Math.round((sessions / WEEKS) * 10) / 10} />
            <StatTile label="Streak" value={streak} unit="wk" />
          </div>

          <Card className="p-4">
            <CardHeader title="Activity" subtitle={`Sets per day · last ${HEAT_WEEKS} weeks`} className="mb-3" />
            <CalendarHeatmap days={days} level={level} describe={describeDay} label="Training days, shaded by sets logged" />
          </Card>

          <Card className="px-2 pt-4 pb-2">
            <CardHeader
              className="px-2"
              title="Weekly volume"
              subtitle={`Weight × reps, ${unit}`}
              action={
                <div className="text-right">
                  <div className="font-display text-title-3 font-semibold">{formatCompact(toDisplay(volume.current, unit))}</div>
                  <div className="text-caption text-muted">
                    {volume.current === 0
                      ? `this week · last ${formatCompact(toDisplay(volume.previous, unit))}`
                      : `this week${volume.change != null ? ` · ${formatChange(volume.change)}` : ''}`}
                  </div>
                </div>
              }
            />
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="t" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tickFormatter={compactTick} tick={axisTick} tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    cursor={{ fill: 'var(--glass-press)' }}
                    content={(p) => {
                      const d = p.payload?.[0]?.payload as (typeof bars)[number] | undefined
                      return (
                        <ChartTooltip
                          active={p.active}
                          title={d ? `Week of ${shortDate(d.t)}` : ''}
                          rows={
                            d
                              ? [
                                  { color: 'var(--accent)', label: 'Volume', value: `${formatCompact(d.volume)} ${unit}` },
                                  { label: 'Sessions', value: String(d.sessions) },
                                ]
                              : []
                          }
                        />
                      )
                    }}
                  />
                  <Bar dataKey="volume" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={animate}>
                    {bars.map((b, i) => (
                      <Cell key={b.t} fill={i === bars.length - 1 ? gradient.bar : 'color-mix(in srgb, var(--accent) 42%, transparent)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {split.length > 0 && (
            <Card className="p-4">
              <CardHeader title="Muscle groups" subtitle={`Sets · last ${SPLIT_WEEKS} weeks`} className="mb-4" />
              <BarList
                label="Sets per muscle group"
                items={[...split]
                  .sort((a, b) => b.sets - a.sets)
                  .map((g) => ({ key: g.key, label: g.key, value: g.sets, display: `${Math.round(g.share * 100)}%` }))}
              />
            </Card>
          )}
        </div>
      )}

      {!!records.data?.length && (
        <>
          <SectionLabel className="mt-7 mb-2 px-1">Recent records</SectionLabel>
          <ListGroup>
            {records.data.map((r) => {
              const exercise = exercises.get(r.exerciseId)
              return (
                <ListRow
                  key={`${r.workoutId}:${r.exerciseId}:${r.kind}`}
                  to={`${base}/${r.exerciseId}`}
                  leading={
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pr-soft text-pr">
                      <Trophy className="size-[18px]" />
                    </span>
                  }
                  title={exercise?.name ?? 'Exercise'}
                  subtitle={`${RECORD_LABEL[r.kind]} · ${recordSet(r, exercise, unit)}`}
                  meta={formatTimestamp(r.performedAt)}
                />
              )
            })}
          </ListGroup>
        </>
      )}

      <SectionLabel className="mt-7 mb-2 px-1">Exercises</SectionLabel>
      {stats.isPending ? (
        <Skeleton className="h-48" />
      ) : list.length ? (
        <ListGroup>
          {list.map((s) => (
            <ListRow
              key={s.exercise_id}
              to={`${base}/${s.exercise_id}`}
              title={exercises.get(s.exercise_id)?.name ?? 'Exercise'}
              subtitle={
                <span className="tabular-nums">
                  {plural(Number(s.session_count), 'session')}
                  {s.best_weight_kg != null && ` · best ${formatWeight(s.best_weight_kg, unit)} × ${s.best_reps}`}
                </span>
              }
              trailing="chevron"
            />
          ))}
        </ListGroup>
      ) : (
        <EmptyState icon={<LineChart />} title="No exercise history yet">
          Exercises you log show up here.
        </EmptyState>
      )}
    </Page>
  )
}
