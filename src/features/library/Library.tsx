import { Bookmark, CalendarRange, ChevronRight, ClipboardList, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { WorkoutActionsSheet } from '@/features/workout/Sheets'
import { WorkoutRow } from '@/features/workouts/WorkoutRow'
import { useNewWorkout } from '@/features/workouts/useNewWorkout'
import type { ProgramListItem, ProgramRun } from '@/data/types'
import { usePrograms, useProgramRuns } from '@/data/usePrograms'
import { useTemplates } from '@/data/useWorkouts'
import { runProgress } from '@/lib/calendar'
import { todayISO } from '@/lib/dates'
import { plural } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Chip'
import { EmptyState } from '@/ui/EmptyState'
import { riseDelay } from '@/ui/motion'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'
import { useNewProgram } from './useNewProgram'

type Audience = 'personal' | 'coach'

/**
 * The library of reusable training: programs (blocks of weeks) and single workouts. It's one library for
 * everyone: "Saved" in personal mode, and the coach's "Templates", which can also be assigned to clients.
 */
export function Library({ audience }: { audience: Audience }) {
  const templates = useTemplates()
  const programs = usePrograms()
  const runs = useProgramRuns()
  const newWorkout = useNewWorkout('template')
  const newProgram = useNewProgram()

  if (templates.isPending || programs.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
    )
  }

  const workouts = templates.data ?? []
  const blocks = programs.data ?? []
  const workoutWord = audience === 'coach' ? 'Template' : 'Saved Workout'

  if (!workouts.length && !blocks.length) {
    return (
      <EmptyState
        icon={audience === 'coach' ? <ClipboardList /> : <Bookmark />}
        title={audience === 'coach' ? 'No templates yet' : 'No saved workouts'}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={newWorkout}>
              <Plus className="size-4" strokeWidth={2.4} /> New {workoutWord}
            </Button>
            <Button variant="secondary" onClick={newProgram}>
              <CalendarRange className="size-4" /> New Program
            </Button>
          </div>
        }
      >
        {audience === 'coach'
          ? "Plan with percentages and each client's loads come from their own maxes. A program strings workouts into weeks."
          : "Save a routine like Upper Body from any workout's menu and start from it on any day, or build a program of weeks."}
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {blocks.length > 0 && (
        <section aria-label="Programs">
          <SectionLabel className="mb-2 px-1">Programs</SectionLabel>
          <div className="flex flex-col gap-3">
            {blocks.map((p, i) => (
              <div key={p.id} className="animate-rise" style={riseDelay(i)}>
                <ProgramRow program={p} runs={runs.data ?? []} />
              </div>
            ))}
          </div>
        </section>
      )}
      <section aria-label={audience === 'coach' ? 'Templates' : 'Workouts'}>
        {blocks.length > 0 && <SectionLabel className="mb-2 px-1">{audience === 'coach' ? 'Templates' : 'Workouts'}</SectionLabel>}
        {workouts.length ? (
          <div className="flex flex-col gap-3">
            {workouts.map((t, i) => (
              <div key={t.id} className="animate-rise" style={riseDelay(blocks.length + i)}>
                <WorkoutRow w={t} />
              </div>
            ))}
          </div>
        ) : (
          <p className="px-1 text-subhead text-muted">
            {audience === 'coach' ? 'No single-workout templates yet.' : "No saved workouts yet. Save one from any workout's menu."}
          </p>
        )}
      </section>
    </div>
  )
}

function ProgramRow({ program, runs }: { program: ProgramListItem; runs: ProgramRun[] }) {
  const today = todayISO()
  // Your own run of it, if one is on your plan now or coming up.
  const run = runs.map((r) => ({ r, p: runProgress(r, today) })).find(({ r, p }) => r.program_id === program.id && p.state !== 'done')
  return (
    <Link
      to={`/programs/${program.id}`}
      viewTransition
      data-interactive
      className="glass-card flex select-none items-center gap-3 rounded-card px-4 py-3.5 active:scale-[0.98]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-accent-soft text-accent-text">
        <CalendarRange className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-headline font-semibold">{program.title || 'Untitled program'}</span>
        <span className="mt-0.5 flex items-center gap-2">
          {run && <Badge tone="accent">{run.p.state === 'upcoming' ? 'Up next' : `Week ${run.p.week} of ${run.p.of}`}</Badge>}
          <span className="truncate text-footnote text-faint">
            {plural(program.week_count, 'week')} · {plural(program.workouts.length, 'workout')}
          </span>
        </span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-faint" />
    </Link>
  )
}

/** The library's "+": a single workout or a program. */
export function NewInLibrarySheet({ open, onOpenChange, audience }: { open: boolean; onOpenChange: (open: boolean) => void; audience: Audience }) {
  const newWorkout = useNewWorkout('template')
  const newProgram = useNewProgram()
  return (
    <WorkoutActionsSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New"
      items={[
        { icon: audience === 'coach' ? <ClipboardList /> : <Bookmark />, label: audience === 'coach' ? 'Template' : 'Saved workout', onClick: newWorkout },
        { icon: <CalendarRange />, label: 'Program', onClick: newProgram },
      ]}
    />
  )
}
