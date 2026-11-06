import { useState } from 'react'
import { CalendarRange, Ellipsis } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/AuthProvider'
import { WorkoutActionsSheet } from '@/features/workout/Sheets'
import type { ProgramRun } from '@/data/types'
import { useProgramRuns, useStopRun } from '@/data/usePrograms'
import { useWorkoutList } from '@/data/useWorkouts'
import { addDays, daysBetween, mondayOf } from '@/lib/calendar'
import { formatScheduled, lowerRelative } from '@/lib/dates'
import { plural } from '@/lib/format'
import { IconButton } from '@/ui/IconButton'

/**
 * The programs running through the week on screen, and which week of each it is. This week also shows
 * the ones still to come. The trainee, or the coach who assigned it, can stop one.
 */
export function RunBanners({ owner, monday, today }: { owner: string; monday: string; today: string }) {
  const uid = useUserId()
  const runs = useProgramRuns(owner)
  const current = useWorkoutList('current', owner)
  const stop = useStopRun(owner)
  const [stopping, setStopping] = useState<ProgramRun | null>(null)
  const [open, setOpen] = useState(false)

  const isThisWeek = monday === mondayOf(today)
  const shown = (runs.data ?? []).flatMap((run) => {
    const last = addDays(run.start_date, run.week_count * 7 - 1)
    if (run.start_date <= addDays(monday, 6) && last >= monday) {
      return [{ run, when: `Week ${Math.floor(daysBetween(run.start_date, monday) / 7) + 1} of ${run.week_count}` }]
    }
    if (isThisWeek && run.start_date > today) return [{ run, when: `Starts ${lowerRelative(formatScheduled(run.start_date))}` }]
    return []
  })
  if (!shown.length) return null

  const upcoming = stopping ? (current.data ?? []).filter((w) => w.program_run_id === stopping.id && w.status === 'planned').length : 0

  return (
    <>
      {shown.map(({ run, when }) => {
        const origin = run.assigned_by && run.assigned_by !== uid ? `From ${run.coach?.display_name || 'your coach'}` : null
        // Your own program opens; a coach's stays theirs.
        const href = run.program_id && run.owner_id === uid && !run.assigned_by ? `/programs/${run.program_id}` : null
        const body = (
          <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-accent-soft text-accent-text">
              <CalendarRange className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold">{run.title}</span>
              <span className="mt-0.5 block truncate text-footnote text-muted">{[origin, when].filter(Boolean).join(' · ')}</span>
            </span>
          </>
        )
        return (
          <div key={run.id} className="glass-card flex items-center rounded-card pr-2">
            {href ? (
              <Link to={href} viewTransition className="flex min-w-0 flex-1 select-none items-center gap-3 py-3 pl-4 active:opacity-70">
                {body}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4">{body}</div>
            )}
            {(run.owner_id === uid || run.assigned_by === uid) && (
              <IconButton
                aria-label={`${run.title} actions`}
                onClick={() => {
                  setStopping(run)
                  setOpen(true)
                }}
              >
                <Ellipsis className="size-5" />
              </IconButton>
            )}
          </div>
        )
      })}
      <WorkoutActionsSheet
        open={open}
        onOpenChange={setOpen}
        title={stopping?.title ?? 'Program'}
        items={[]}
        destructive={{
          label: 'Stop program…',
          warning: `Takes its ${plural(upcoming, 'upcoming workout')} off the plan. Workouts already started or finished stay.`,
          confirm: 'Stop program',
          onConfirm: () => {
            setOpen(false)
            if (!stopping) return
            const title = stopping.title
            stop.mutate(stopping.id, {
              onSuccess: (n) => toast(`Stopped ${title}`, { description: `${plural(n ?? 0, 'planned workout')} removed.` }),
            })
          },
        }}
      />
    </>
  )
}
