import { CalendarDays, Dumbbell, Flame, History, LineChart, Plus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ModeSwitch } from '@/features/coaching/ModeSwitch'
import { useUserId } from '@/features/auth/AuthProvider'
import { AddWorkoutSheet } from '@/features/plan/AddWorkoutSheet'
import { useAddWorkout } from '@/features/plan/useAddWorkout'
import { isOwnOrLibrary, useExercises } from '@/data/useExercises'
import { SUMMARY_WEEKS, useTrainingSummary, useWeeklyGoal } from '@/data/useInsights'
import { useCurrentMaxes } from '@/data/useMaxes'
import { useUnits } from '@/data/useProfile'
import { useWorkoutList } from '@/data/useWorkouts'
import { formatChange, formatCompact, plural } from '@/lib/format'
import { addDays, mondayOf } from '@/lib/calendar'
import { todayISO } from '@/lib/dates'
import { weekDelta, weeklyTotals, weekProgress, weekStreak } from '@/lib/insights'
import { toDisplay } from '@/lib/load'
import { Card } from '@/ui/Card'
import { ProgressRing } from '@/ui/charts/ProgressRing'
import { Sparkline } from '@/ui/charts/Sparkline'
import { IconButton } from '@/ui/IconButton'
import { NavTiles } from '@/ui/NavTiles'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'
import { StatTile, type Delta } from '@/ui/StatTile'
import { HeroCard } from './HeroCard'

const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

export function HomePage() {
  const uid = useUserId()
  const navigate = useNavigate()
  const current = useWorkoutList('current')
  const history = useWorkoutList('history')
  const exercises = useExercises()
  const maxes = useCurrentMaxes()
  const summary = useTrainingSummary()
  const goal = useWeeklyGoal()
  const { unit } = useUnits()
  const { add, sheet } = useAddWorkout()

  const monday = mondayOf(todayISO())
  const plannedThisWeek = current.data?.filter((w) => w.scheduled_for && w.scheduled_for >= monday && w.scheduled_for <= addDays(monday, 6)).length

  const rows = summary.data ?? []
  const week = weekProgress(rows, goal)
  const streak = weekStreak(rows, goal, SUMMARY_WEEKS)
  const volumes = weeklyTotals(rows, 8).map((w) => toDisplay(w.volumeKg, unit))
  const volume = weekDelta(volumes)
  // Until something is logged this week, a comparison would only ever read -100%.
  const delta: Delta | undefined =
    volume.current === 0
      ? volume.previous > 0
        ? { text: `Last week ${formatCompact(volume.previous)} ${unit}`, dir: 'flat' }
        : undefined
      : volume.change == null
        ? undefined
        : { text: `${formatChange(volume.change)} vs last week`, dir: volume.change > 0 ? 'up' : volume.change < 0 ? 'down' : 'flat' }

  return (
    <Page>
      <PageHeader
        hero
        eyebrow={today()}
        title="My Training"
        subtitle={<ModeSwitch value="personal" />}
        actions={
          <>
            <IconButton aria-label="New workout" variant="accent" size="md" className="mr-1" onClick={add}>
              <Plus className="size-5" strokeWidth={2.4} />
            </IconButton>
            <IconButton aria-label="Settings" onClick={() => navigate('/settings', { viewTransition: true })}>
              <Settings className="size-[22px]" />
            </IconButton>
          </>
        }
      />

      <HeroCard current={current.data} onNew={add} />

      {summary.isPending ? (
        <Skeleton className="mt-3 h-[236px]" />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Card className="flex items-center gap-3 p-4">
              <ProgressRing value={week.ratio} size={52} stroke={5} label={`${week.done} of ${week.goal} sessions this week`}>
                <span className="font-display text-headline font-semibold">{week.done}</span>
              </ProgressRing>
              <div className="min-w-0">
                <div className="text-caption font-semibold text-muted">This week</div>
                <div className="text-callout font-semibold">
                  {week.done >= week.goal ? 'Goal met' : `${week.goal - week.done} to go`}
                </div>
                <div className="text-caption text-faint">Goal {week.goal}</div>
              </div>
            </Card>
            <StatTile
              label="Streak"
              icon={<Flame className={streak ? 'size-3.5 text-pr' : 'size-3.5'} />}
              value={streak}
              unit={streak === 1 ? 'week' : 'weeks'}
            />
          </div>
          <StatTile className="mt-3" label="Volume this week" value={formatCompact(volume.current)} unit={unit} delta={delta}>
            <Sparkline data={volumes} label="Weekly volume over the last 8 weeks" className="mt-2" />
          </StatTile>
        </>
      )}

      <SectionLabel className="mt-7 mb-2 px-1">Your training</SectionLabel>
      <NavTiles
        items={[
          {
            to: '/workouts',
            title: 'Plan',
            icon: CalendarDays,
            sub: plannedThisWeek != null && (plannedThisWeek ? `${plannedThisWeek} planned this week` : 'Nothing planned this week'),
          },
          {
            to: '/workouts/history',
            title: 'History',
            icon: History,
            sub: history.data && (history.data.length ? plural(history.data.length, 'workout') : 'Past workouts'),
          },
          {
            to: '/exercises',
            title: 'Exercises',
            icon: Dumbbell,
            sub:
              exercises.data &&
              `${plural(exercises.data.filter((e) => !e.archived_at && isOwnOrLibrary(e, uid)).length, 'exercise')} · ${plural(maxes.count, 'max', 'maxes')}`,
          },
          { to: '/progress', title: 'Progress', icon: LineChart, sub: summary.data && `${plural(week.done, 'session')} this week` },
        ]}
      />
      <AddWorkoutSheet {...sheet} />
    </Page>
  )
}
