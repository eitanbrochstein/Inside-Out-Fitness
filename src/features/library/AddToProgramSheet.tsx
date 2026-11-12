import { useState, type ReactNode } from 'react'
import { CalendarRange, ChevronLeft, Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { ProgramListItem } from '@/data/types'
import { useAddToProgram, useCreateProgramFrom, usePrograms } from '@/data/usePrograms'
import { programDayLabel, weekdayName, weekdayOf } from '@/lib/calendar'
import { plural } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { ListGroup, ListRow } from '@/ui/ListRow'
import { SectionLabel } from '@/ui/SectionLabel'
import { Sheet } from '@/ui/Sheet'
import { Skeleton } from '@/ui/Skeleton'
import { TextField } from '@/ui/TextField'

type Target = { kind: 'program'; program: ProgramListItem } | { kind: 'new' }

const leading = (icon: ReactNode) => (
  <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-accent-soft text-accent-text [&_svg]:size-[18px]">{icon}</span>
)

/**
 * Puts a copy of a workout on a day of a program: one of yours, a new week of it, or a new program.
 * The workout itself stays as it is. Remount (via key) to reset between openings.
 */
export function AddToProgramSheet({
  open,
  onOpenChange,
  workout,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: { id: string; title: string; scheduled_for: string | null }
}) {
  const navigate = useNavigate()
  const programs = usePrograms()
  const add = useAddToProgram()
  const create = useCreateProgramFrom()
  const [target, setTarget] = useState<Target | null>(null)
  const [week, setWeek] = useState(0)
  const [weekday, setWeekday] = useState(() => (workout.scheduled_for ? weekdayOf(workout.scheduled_for) : 0))
  const [title, setTitle] = useState('')

  const name = workout.title.trim() || 'Workout'
  const weeks = target?.kind === 'program' ? target.program.week_count : 1
  const newWeek = week === weeks
  const day = week * 7 + weekday

  const done = (programId: string, programTitle: string) => {
    onOpenChange(false)
    toast(`Added ${name} to ${programTitle}`, {
      description: programDayLabel(day),
      action: {
        label: 'Open',
        onClick: () => navigate(`/programs/${programId}${week ? `?week=${week + 1}` : ''}`, { viewTransition: true }),
      },
    })
  }

  const save = () => {
    if (!target) return
    if (target.kind === 'new') {
      create.mutate(
        { title, weekCount: 1, workouts: [workout.id], days: [weekday] },
        { onSuccess: (id) => done(id, title.trim() || 'a new program') },
      )
      return
    }
    add.mutate(
      { programId: target.program.id, day, source: workout.id, newWeek },
      { onSuccess: () => done(target.program.id, target.program.title || 'Untitled program') },
    )
  }

  const pick = (t: Target) => {
    setTarget(t)
    setWeek(0)
  }

  if (!target) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Add to program" description={`A copy of ${name} goes on a day of the program.`}>
        <div className="pt-1 pb-3">
          {programs.isPending ? (
            <Skeleton className="h-[120px]" />
          ) : (
            <ListGroup>
              <ListRow leading={leading(<Plus />)} title="New program" subtitle="Start one with this workout" onClick={() => pick({ kind: 'new' })} trailing="chevron" />
              {(programs.data ?? []).map((p) => (
                <ListRow
                  key={p.id}
                  leading={leading(<CalendarRange />)}
                  title={p.title || 'Untitled program'}
                  subtitle={`${plural(p.week_count, 'week')} · ${plural(p.workouts.length, 'workout')}`}
                  onClick={() => pick({ kind: 'program', program: p })}
                  trailing="chevron"
                />
              ))}
            </ListGroup>
          )}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={target.kind === 'new' ? 'New program' : target.program.title || 'Untitled program'}
      description={target.kind === 'new' ? `Starts with ${name}. Add weeks and days from the program page.` : 'Pick the day for the copy.'}
    >
      <div className="flex flex-col gap-4 pt-1 pb-3">
        <button
          type="button"
          onClick={() => setTarget(null)}
          className="-mt-1 flex h-8 w-fit select-none items-center gap-0.5 text-subhead font-semibold text-accent-text active:opacity-60"
        >
          <ChevronLeft className="size-4" strokeWidth={2.6} /> Programs
        </button>
        {target.kind === 'new' ? (
          <TextField
            label="Program name"
            placeholder="Untitled program"
            value={title}
            enterKeyHint="done"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <div>
            <SectionLabel className="mb-2 px-1">Week</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: weeks }, (_, w) => (
                <Chip key={w} selected={week === w} onClick={() => setWeek(w)}>
                  Week {w + 1}
                </Chip>
              ))}
              {weeks < 52 && (
                <Chip selected={newWeek} onClick={() => setWeek(weeks)} icon={<Plus className="size-4" strokeWidth={2.4} />}>
                  New week
                </Chip>
              )}
            </div>
          </div>
        )}
        <div>
          <SectionLabel className="mb-2 px-1">Day</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }, (_, d) => (
              <Chip key={d} selected={weekday === d} onClick={() => setWeekday(d)}>
                {weekdayName(d)}
              </Chip>
            ))}
          </div>
        </div>
        <Button size="lg" block loading={add.isPending || create.isPending} onClick={save}>
          {target.kind === 'new' ? 'Create program' : `Add to ${newWeek ? `new week ${weeks + 1}` : `week ${week + 1}`}, ${weekdayName(weekday)}`}
        </Button>
      </div>
    </Sheet>
  )
}
