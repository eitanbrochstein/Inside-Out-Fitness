import type { ReactNode } from 'react'
import { CalendarPlus, Play, Plus } from 'lucide-react'
import type { WorkoutListItem } from '@/data/types'
import { allSets, useWorkout } from '@/data/useWorkout'
import { pickUpNext } from '@/lib/calendar'
import { formatScheduled, todayISO } from '@/lib/dates'
import { plural } from '@/lib/format'
import { Button, ButtonLink } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Chip'
import { ProgressRing } from '@/ui/charts/ProgressRing'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'

const exercises = (w: WorkoutListItem) => w.workout_blocks.filter((b) => b.type === 'exercise').length

/** The workout to do next: the one under way, else today's or the next planned, else a prompt to plan one. */
export function HeroCard({ current, onNew }: { current: WorkoutListItem[] | undefined; onNew: () => void }) {
  if (!current) return <Skeleton className="h-[164px]" />
  const today = todayISO()
  const next = pickUpNext(current, today)
  if (next?.status === 'in_progress') return <LiveCard workout={next} />
  const missed = !!next?.scheduled_for && next.scheduled_for < today

  return (
    <Glow>
      {next ? (
        <>
          <SectionLabel>
            {missed ? 'Missed' : 'Up next'} · {next.scheduled_for ? formatScheduled(next.scheduled_for) : 'Unscheduled'}
          </SectionLabel>
          <h2 className="mt-2 truncate font-display text-title-2 font-semibold">{next.title || 'Untitled workout'}</h2>
          <p className="mt-0.5 truncate text-subhead text-muted">
            {[next.subtitle, exercises(next) ? plural(exercises(next), 'exercise') : 'No exercises yet'].filter(Boolean).join(' · ')}
          </p>
          <ButtonLink to={`/w/${next.id}`} size="lg" block className="mt-4">
            <Play className="size-[18px] fill-current" /> Start workout
          </ButtonLink>
        </>
      ) : (
        <>
          <span className="flex size-11 items-center justify-center rounded-tile bg-accent-soft text-accent-text">
            <CalendarPlus className="size-[22px]" />
          </span>
          <h2 className="mt-3 font-display text-title-3 font-semibold">Nothing planned</h2>
          <p className="mt-0.5 text-subhead text-muted">Plan your next session and it'll wait for you here.</p>
          <Button size="lg" block className="mt-4" onClick={onNew}>
            <Plus className="size-5" strokeWidth={2.4} /> New Workout
          </Button>
        </>
      )}
    </Glow>
  )
}

function LiveCard({ workout }: { workout: WorkoutListItem }) {
  const doc = useWorkout(workout.id).data
  const sets = doc ? allSets(doc) : []
  const done = sets.filter((s) => s.completed_at).length
  return (
    <Glow>
      <div className="flex items-center gap-4">
        <ProgressRing value={sets.length ? done / sets.length : 0} size={64} stroke={6} label="Sets done">
          <span className="font-display text-headline font-semibold">{done}</span>
          <span className="block text-caption text-muted">of {sets.length}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <Badge tone="live" pulse>
            Live
          </Badge>
          <h2 className="mt-1.5 truncate font-display text-title-3 font-semibold">{workout.title || 'Untitled workout'}</h2>
          <p className="truncate text-subhead text-muted">{sets.length ? `${plural(sets.length - done, 'set')} to go` : 'Under way'}</p>
        </div>
      </div>
      <ButtonLink to={`/w/${workout.id}`} size="lg" block className="mt-4">
        <Play className="size-[18px] fill-current" /> Continue
      </ButtonLink>
    </Glow>
  )
}

/** A card lit from its corner by the accent: the one thing on Home to look at first. */
function Glow({ children }: { children: ReactNode }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_srgb,var(--accent)_24%,transparent),transparent_60%)]"
      />
      <div className="relative">{children}</div>
    </Card>
  )
}
