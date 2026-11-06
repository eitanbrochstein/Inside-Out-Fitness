import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/AuthProvider'
import type { WorkoutListItem } from '@/data/types'
import { calendarQuery, useCalendar, useReschedule, useWorkoutList } from '@/data/useWorkouts'
import { addDays, addMonths, daysBetween, isMissed, mondayOf, monthGrid, monthOf, placeOnDays, weekDays } from '@/lib/calendar'
import { formatDay, parseISODate, todayISO } from '@/lib/dates'
import { plural } from '@/lib/format'
import { Badge } from '@/ui/Chip'
import { cn } from '@/ui/cn'
import { IconButton } from '@/ui/IconButton'
import { ListGroup } from '@/ui/ListRow'
import { ease } from '@/ui/motion'
import { SectionLabel } from '@/ui/SectionLabel'
import { Dots } from './Dots'
import { MonthGrid } from './MonthGrid'
import { RunBanners } from './RunBanners'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

const shortDay = (day: string) => {
  const d = parseISODate(day)
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}`
}
const longDay = (day: string) => formatDay(parseISODate(day))
const monthDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function weekLabel(monday: string) {
  const start = parseISODate(monday)
  const end = parseISODate(addDays(monday, 6))
  const range = `${monthDay(start)} – ${start.getMonth() === end.getMonth() ? end.getDate() : monthDay(end)}`
  return end.getFullYear() === new Date().getFullYear() ? range : `${range}, ${end.getFullYear()}`
}

const monthLabel = (month: string) => parseISODate(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
}

/**
 * Someone's plan, a week (or a month) at a time. The week and month live in the URL, so coming back
 * from a workout returns to the same place. `onAdd` puts a workout on a day.
 */
export function PlanCalendar({ ownerId, onAdd }: { ownerId?: string; onAdd?: (day: string) => void }) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  const qc = useQueryClient()
  const today = todayISO()
  const thisMonday = mondayOf(today)
  const [params, setParams] = useSearchParams()
  const weekParam = params.get('week')
  const monthParam = params.get('month')
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : null
  const monday = weekParam && DAY_RE.test(weekParam) ? mondayOf(weekParam) : thisMonday
  const [dir, setDir] = useState(1)

  const goWeek = (m: string) => {
    setDir(Math.sign(daysBetween(month ? `${month}-01` : monday, m)) || 1)
    setParams(m === thisMonday ? {} : { week: m }, { replace: true })
  }
  const goMonth = (m: string) => {
    setDir(month && m < month ? -1 : 1)
    setParams({ month: m }, { replace: true })
  }

  // The weeks either side are fetched ahead, so paging is instant.
  useEffect(() => {
    if (month) return
    for (const m of [addDays(monday, -7), addDays(monday, 7)]) void qc.prefetchQuery(calendarQuery(owner, m, addDays(m, 6)))
  }, [qc, owner, monday, month])

  const header = month ? (
    <CalendarHeader
      label={monthLabel(month)}
      toggleLabel="Show week"
      onToggle={() => goWeek(month === monthOf(today) ? thisMonday : mondayOf(`${month}-01`))}
      onPrev={() => goMonth(addMonths(month, -1))}
      onNext={() => goMonth(addMonths(month, 1))}
      onToday={month === monthOf(today) ? undefined : () => goMonth(monthOf(today))}
      unit="month"
    />
  ) : (
    <CalendarHeader
      label={weekLabel(monday)}
      toggleLabel="Show month"
      // A week across two months belongs to the one holding its Thursday.
      onToggle={() => goMonth(monthOf(addDays(monday, 3)))}
      onPrev={() => goWeek(addDays(monday, -7))}
      onNext={() => goWeek(addDays(monday, 7))}
      onToday={monday === thisMonday ? undefined : () => goWeek(thisMonday)}
      unit="week"
    />
  )

  return (
    <div>
      {header}
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={month ?? monday}
          custom={dir}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease }}
        >
          {month ? (
            <MonthView
              owner={owner}
              month={month}
              today={today}
              onPick={(day) => {
                goWeek(mondayOf(day))
                window.setTimeout(() => scrollToDay(day), 320)
              }}
            />
          ) : (
            <WeekView owner={owner} monday={monday} today={today} onAdd={onAdd} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const scrollToDay = (day: string) => document.getElementById(`day-${day}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function CalendarHeader({
  label,
  toggleLabel,
  onToggle,
  onPrev,
  onNext,
  onToday,
  unit,
}: {
  label: string
  toggleLabel: string
  onToggle: () => void
  onPrev: () => void
  onNext: () => void
  onToday?: () => void
  unit: 'week' | 'month'
}) {
  return (
    <div className="mb-3 flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${label}. ${toggleLabel}`}
        className="flex h-10 min-w-0 select-none items-center gap-1 rounded-full pr-2 font-display text-headline font-semibold active:opacity-70"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" strokeWidth={2.4} />
      </button>
      <span className="flex-1" />
      {onToday && (
        <button
          type="button"
          onClick={onToday}
          className="glass-control mr-1 h-8 shrink-0 select-none rounded-full px-3 text-footnote font-semibold text-accent-text active:scale-[0.96]"
        >
          Today
        </button>
      )}
      <IconButton size="sm" aria-label={`Previous ${unit}`} onClick={onPrev}>
        <ChevronLeft className="size-5" />
      </IconButton>
      <IconButton size="sm" aria-label={`Next ${unit}`} onClick={onNext}>
        <ChevronRight className="size-5" />
      </IconButton>
    </div>
  )
}

function WeekView({ owner, monday, today, onAdd }: { owner: string; monday: string; today: string; onAdd?: (day: string) => void }) {
  const days = weekDays(monday)
  const calendar = useCalendar(monday, days[6], owner)
  const current = useWorkoutList('current', owner)
  const reschedule = useReschedule(owner)
  const placed = calendar.data ? placeOnDays(calendar.data, days) : null
  const isThisWeek = monday === mondayOf(today)
  // Only on this week: planned workouts left behind in earlier weeks, and ones with no date.
  const earlier = isThisWeek ? (current.data ?? []).filter((w) => w.scheduled_for && w.scheduled_for < monday) : []
  const unscheduled = isThisWeek ? (current.data ?? []).filter((w) => !w.scheduled_for) : []

  const moveToToday = (w: WorkoutListItem) => {
    reschedule.mutate({ id: w.id, date: today })
    toast(`Moved ${w.title || 'workout'} to today`)
  }

  return (
    <div className="flex flex-col gap-5">
      <WeekStrip days={days} today={today} placed={placed} />
      <RunBanners owner={owner} monday={monday} today={today} />
      {earlier.length > 0 && (
        <Group label="Earlier">
          {earlier.map((w) => (
            <PlanRow key={w.id} w={w} today={today} showDate onMove={moveToToday} />
          ))}
        </Group>
      )}
      {days.map((day) => (
        <DaySection key={day} day={day} today={today} items={placed?.get(day) ?? null} onAdd={onAdd} onMove={moveToToday} />
      ))}
      {unscheduled.length > 0 && (
        <Group label="Unscheduled">
          {unscheduled.map((w) => (
            <PlanRow key={w.id} w={w} today={today} />
          ))}
        </Group>
      )}
    </div>
  )
}

function MonthView({ owner, month, today, onPick }: { owner: string; month: string; today: string; onPick: (day: string) => void }) {
  const grid = monthGrid(month)
  const calendar = useCalendar(grid[0].day, grid.at(-1)!.day, owner)
  const placed = calendar.data ? placeOnDays(calendar.data, grid.map((d) => d.day)) : null
  return <MonthGrid grid={grid} today={today} placed={placed} onPick={onPick} />
}

/** Mon–Sun with a dot per workout; a tap scrolls to that day. */
function WeekStrip({ days, today, placed }: { days: string[]; today: string; placed: Map<string, WorkoutListItem[]> | null }) {
  return (
    <div className="glass-card grid grid-cols-7 gap-0.5 rounded-card p-1.5">
      {days.map((day) => {
        const items = placed?.get(day) ?? []
        const isToday = day === today
        const d = parseISODate(day)
        return (
          <button
            key={day}
            type="button"
            onClick={() => scrollToDay(day)}
            aria-label={`${longDay(day)}: ${items.length ? plural(items.length, 'workout') : 'nothing planned'}`}
            aria-current={isToday ? 'date' : undefined}
            className={cn(
              'flex select-none flex-col items-center gap-1 rounded-tile py-2 transition-colors duration-150 active:bg-(--glass-press)',
              isToday && 'bg-accent-soft',
            )}
          >
            <span className="text-micro font-semibold uppercase text-faint">{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            <span className={cn('font-display text-headline leading-none font-semibold tabular-nums', isToday && 'text-accent-text')}>{d.getDate()}</span>
            <Dots items={items} today={today} />
          </button>
        )
      })}
    </div>
  )
}

function DaySection({
  day,
  today,
  items,
  onAdd,
  onMove,
}: {
  day: string
  today: string
  items: WorkoutListItem[] | null
  onAdd?: (day: string) => void
  onMove?: (w: WorkoutListItem) => void
}) {
  const isToday = day === today
  return (
    <section id={`day-${day}`} aria-label={longDay(day)} className="scroll-mt-16">
      <div className="flex min-h-9 items-center gap-2 px-1">
        <SectionLabel className={cn('flex-1', isToday && 'text-accent-text')}>{isToday ? `Today · ${shortDay(day)}` : shortDay(day)}</SectionLabel>
        {items?.length === 0 && day < today && <span className="text-footnote text-faint">Rest</span>}
        {onAdd && (
          <IconButton size="sm" aria-label={`Add a workout on ${longDay(day)}`} onClick={() => onAdd(day)} className="-mr-1.5">
            <Plus className="size-[18px]" strokeWidth={2.2} />
          </IconButton>
        )}
      </div>
      {!!items?.length && (
        <ListGroup className="mt-1">
          {items.map((w) => (
            <PlanRow key={w.id} w={w} today={today} onMove={onMove} />
          ))}
        </ListGroup>
      )}
    </section>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label}>
      <SectionLabel className="flex min-h-9 items-center px-1">{label}</SectionLabel>
      <ListGroup className="mt-1">{children}</ListGroup>
    </section>
  )
}

function PlanRow({ w, today, showDate, onMove }: { w: WorkoutListItem; today: string; showDate?: boolean; onMove?: (w: WorkoutListItem) => void }) {
  const uid = useUserId()
  const missed = isMissed(w, today)
  const exercises = w.workout_blocks.filter((b) => b.type === 'exercise').length
  const origin = w.assigned_by ? (w.assigned_by === uid ? 'Assigned' : `From ${w.coach?.display_name || 'your coach'}`) : null
  const sub = [showDate && w.scheduled_for ? longDay(w.scheduled_for) : null, origin, w.subtitle, exercises ? plural(exercises, 'exercise') : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex items-center">
      <Link
        to={`/w/${w.id}`}
        viewTransition
        className="flex min-h-[60px] min-w-0 flex-1 select-none items-center gap-3 px-4 py-3 transition-colors duration-150 active:bg-(--glass-press)"
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-body font-semibold', missed && 'text-muted')}>{w.title || 'Untitled workout'}</span>
          {sub && <span className="mt-0.5 block truncate text-footnote text-muted">{sub}</span>}
        </span>
        {w.status === 'in_progress' && (
          <Badge tone="live" pulse>
            Live
          </Badge>
        )}
        {w.status === 'completed' && <Check aria-label="Done" className="size-[18px] shrink-0 text-success" strokeWidth={2.6} />}
      </Link>
      {missed && onMove && (w.owner_id === uid || w.assigned_by === uid) && (
        <button
          type="button"
          onClick={() => onMove(w)}
          className="glass-control mr-3 h-8 shrink-0 select-none rounded-full px-3 text-footnote font-semibold text-accent-text active:scale-[0.96]"
        >
          Move to today
        </button>
      )}
    </div>
  )
}
