import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCreateProgramFrom } from '@/data/usePrograms'
import { useCalendar } from '@/data/useWorkouts'
import { addDays, daysBetween, placeOnDays, weekLabel } from '@/lib/calendar'
import { plural } from '@/lib/format'
import { Button } from '@/ui/Button'
import { IconButton } from '@/ui/IconButton'
import { Sheet } from '@/ui/Sheet'
import { TextField } from '@/ui/TextField'

const MAX_WEEKS = 12

/**
 * Saves weeks of your plan as a new program: every workout on those days, on the same weekday of the
 * same week. What the calendar shows on a day is what's saved. Remount (via key) to reset.
 */
export function SaveWeeksSheet({ open, onOpenChange, monday }: { open: boolean; onOpenChange: (open: boolean) => void; monday: string }) {
  const navigate = useNavigate()
  const create = useCreateProgramFrom()
  const [from, setFrom] = useState(monday)
  const [weeks, setWeeks] = useState(1)
  const [title, setTitle] = useState('')

  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(from, i))
  const calendar = useCalendar(from, days.at(-1)!)
  const picked = calendar.data
    ? [...placeOnDays(calendar.data, days)].flatMap(([day, items]) => items.map((w) => ({ id: w.id, day: daysBetween(from, day) })))
    : null

  const save = () => {
    if (!picked?.length) return
    create.mutate(
      { title, weekCount: weeks, workouts: picked.map((p) => p.id), days: picked.map((p) => p.day) },
      {
        onSuccess: (id) => {
          onOpenChange(false)
          toast(`Saved ${plural(weeks, 'week')} as a program`)
          navigate(`/programs/${id}`, { viewTransition: true })
        },
      },
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Save as program"
      description="Copies the workouts on these weeks into a new program, each on its weekday, to start again any time. Your plan stays as it is."
    >
      <div className="flex flex-col gap-4 pt-1 pb-3">
        <TextField
          label="Program name"
          placeholder="Untitled program"
          value={title}
          enterKeyHint="done"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <Stepper label="First week">
          <IconButton size="sm" aria-label="Previous week" onClick={() => setFrom(addDays(from, -7))}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <span className="min-w-[7.5rem] text-center font-semibold tabular-nums">{weekLabel(from)}</span>
          <IconButton size="sm" aria-label="Next week" onClick={() => setFrom(addDays(from, 7))}>
            <ChevronRight className="size-5" />
          </IconButton>
        </Stepper>
        <Stepper label="Weeks">
          <IconButton size="sm" aria-label="Fewer weeks" disabled={weeks <= 1} onClick={() => setWeeks(weeks - 1)}>
            <Minus className="size-[18px]" />
          </IconButton>
          <span className="min-w-[7.5rem] text-center font-semibold tabular-nums">{plural(weeks, 'week')}</span>
          <IconButton size="sm" aria-label="More weeks" disabled={weeks >= MAX_WEEKS} onClick={() => setWeeks(weeks + 1)}>
            <Plus className="size-[18px]" />
          </IconButton>
        </Stepper>
        <p className="text-callout text-muted" aria-live="polite">
          {picked == null
            ? 'Counting workouts…'
            : picked.length
              ? `${plural(picked.length, 'workout')} through ${weekLabel(addDays(from, (weeks - 1) * 7))}.`
              : 'Nothing on these weeks yet.'}
        </p>
        <Button size="lg" block disabled={!picked?.length} loading={create.isPending} onClick={save}>
          Save program
        </Button>
      </div>
    </Sheet>
  )
}

function Stepper({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-callout">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1">{children}</span>
    </div>
  )
}
