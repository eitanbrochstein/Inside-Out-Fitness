import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { ProgramDoc } from '@/data/types'
import { useStartProgram } from '@/data/usePrograms'
import { addDays, firstMonday, mondayOf } from '@/lib/calendar'
import { formatDay, formatScheduled, lowerRelative, parseISODate, todayISO } from '@/lib/dates'
import { plural } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { DatePill } from '@/ui/DatePill'
import { Sheet } from '@/ui/Sheet'

/** Puts a program on your plan from a Monday. Remount (via key) to reset between openings. */
export function StartProgramSheet({ open, onOpenChange, program }: { open: boolean; onOpenChange: (open: boolean) => void; program: ProgramDoc }) {
  const navigate = useNavigate()
  const start = useStartProgram()
  const today = todayISO()
  const [monday, setMonday] = useState(() => firstMonday(today))
  const title = program.title.trim() || 'Untitled program'

  const go = () =>
    start.mutate(
      { programId: program.id, start: monday, skipBefore: today },
      {
        onSuccess: () => {
          onOpenChange(false)
          toast(monday <= today ? `${title} is on your plan` : `${title} starts ${lowerRelative(formatScheduled(monday))}`)
          navigate(monday === mondayOf(today) ? '/workouts' : `/workouts?week=${monday}`, { viewTransition: true })
        },
      },
    )

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Start program"
      description={`Puts its ${plural(program.workouts.length, 'workout')} on your plan, a week at a time from the Monday you pick.`}
    >
      <div className="flex flex-col gap-4 pt-1 pb-3">
        <WeekStartPicker value={monday} onChange={setMonday} />
        <ProgramWindow program={program} monday={monday} />
        <Button size="lg" block disabled={program.workouts.length === 0} loading={start.isPending} onClick={go}>
          Start program
        </Button>
      </div>
    </Sheet>
  )
}

/** This week, next week, or any week (snapped to its Monday). */
export function WeekStartPicker({ value, onChange }: { value: string; onChange: (monday: string) => void }) {
  const thisMonday = mondayOf(todayISO())
  const nextMonday = addDays(thisMonday, 7)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip selected={value === thisMonday} onClick={() => onChange(thisMonday)}>
        This week
      </Chip>
      <Chip selected={value === nextMonday} onClick={() => onChange(nextMonday)}>
        Next week
      </Chip>
      <DatePill size="md" label="First week" value={value} onChange={(d) => d && onChange(mondayOf(d))} />
    </div>
  )
}

/** When a program would run from `monday`, and how many of its days have already gone by. */
export function ProgramWindow({ program, monday }: { program: Pick<ProgramDoc, 'week_count' | 'workouts'>; monday: string }) {
  const today = todayISO()
  const skipped = program.workouts.filter((w) => addDays(monday, w.program_day) < today).length
  const last = addDays(monday, program.week_count * 7 - 1)
  return (
    <>
      <p className="text-callout text-muted">
        {plural(program.week_count, 'week')}: {formatDay(parseISODate(monday))} to {formatDay(parseISODate(last))}
      </p>
      {skipped > 0 && (
        <p className="text-callout text-warn">
          {plural(skipped, 'workout')} on days already past {skipped === 1 ? 'is' : 'are'} left out.
        </p>
      )}
      {program.workouts.length === 0 && <p className="text-callout text-warn">Add a workout to a day first.</p>}
    </>
  )
}
