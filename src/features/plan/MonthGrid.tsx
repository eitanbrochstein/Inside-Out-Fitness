import type { WorkoutListItem } from '@/data/types'
import type { MonthDay } from '@/lib/calendar'
import { formatDay, parseISODate } from '@/lib/dates'
import { plural } from '@/lib/format'
import { cn } from '@/ui/cn'
import { Dots } from './Dots'

/** A month at a glance: a dot per workout on each day. Tapping a day opens its week. */
export function MonthGrid({
  grid,
  today,
  placed,
  onPick,
}: {
  grid: MonthDay[]
  today: string
  placed: Map<string, WorkoutListItem[]> | null
  onPick: (day: string) => void
}) {
  return (
    <div className="glass-card rounded-card p-2">
      <div aria-hidden className="grid grid-cols-7 pb-1">
        {grid.slice(0, 7).map(({ day }) => (
          <span key={day} className="py-1 text-center text-micro font-semibold uppercase text-faint">
            {parseISODate(day).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map(({ day, inMonth }) => {
          const items = placed?.get(day) ?? []
          const isToday = day === today
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPick(day)}
              aria-label={`${formatDay(parseISODate(day))}: ${items.length ? plural(items.length, 'workout') : 'nothing planned'}`}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex h-12 select-none flex-col items-center justify-center gap-1 rounded-tile transition-colors duration-150 active:bg-(--glass-press)',
                isToday && 'bg-accent-soft',
              )}
            >
              <span
                className={cn(
                  'text-callout leading-none font-semibold tabular-nums',
                  !inMonth && 'text-faint',
                  isToday && 'text-accent-text',
                )}
              >
                {parseISODate(day).getDate()}
              </span>
              <Dots items={items} today={today} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
