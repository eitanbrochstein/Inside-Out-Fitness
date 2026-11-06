import { useState, type ReactNode } from 'react'
import type { DayActivity } from '@/lib/insights'
import { cn } from '../cn'

const LEVELS = ['bg-(--heat-0)', 'bg-(--heat-1)', 'bg-(--heat-2)', 'bg-(--heat-3)', 'bg-(--heat-4)']
const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' })
const longDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * Weeks as columns (Monday at the top), each day shaded by how much was done. Tapping, hovering
 * or focusing a day shows it in the line below; today is outlined.
 */
export function CalendarHeatmap({
  days,
  level,
  describe,
  label,
}: {
  /** Whole weeks, oldest first (dailyActivity). */
  days: DayActivity[]
  level: (day: DayActivity) => 0 | 1 | 2 | 3 | 4
  describe: (day: DayActivity) => ReactNode
  label: string
}) {
  const today = days.findLast((d) => !d.future)
  // Until a day is picked, show the latest day trained.
  const [picked, setPicked] = useState<string | null>(null)
  const selected = days.find((d) => d.day === picked) ?? days.findLast((d) => !d.future && d.sessions > 0) ?? today
  const weeks = days.length / 7
  const mondays = Array.from({ length: weeks }, (_, w) => days[w * 7].date)
  // A month is labelled at its first week, with room to spare: never two labels within three columns.
  const labels: (string | null)[] = []
  let last = -Infinity
  mondays.forEach((d, w) => {
    const starts = w === 0 || d.getMonth() !== mondays[w - 1].getMonth()
    const room = w + 3 <= weeks && (w > 0 || mondays[Math.min(2, weeks - 1)].getMonth() === d.getMonth())
    labels.push(starts && room && w - last >= 3 ? month(d) : null)
    if (labels[w]) last = w
  })

  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} aria-hidden>
        {labels.map((l, w) => (
          <span key={w} className="h-4 overflow-visible text-micro leading-4 tracking-normal whitespace-nowrap text-faint">
            {l}
          </span>
        ))}
      </div>
      <div
        role="group"
        aria-label={label}
        className="mt-1 grid grid-flow-col grid-rows-7 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            disabled={d.future}
            aria-label={`${longDay(d.date)}: ${d.sessions ? `${d.sessions} session${d.sessions === 1 ? '' : 's'}` : 'rest'}`}
            aria-pressed={selected?.day === d.day}
            aria-current={d.day === today?.day ? 'date' : undefined}
            onClick={() => setPicked(d.day)}
            onFocus={() => setPicked(d.day)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && !d.future && setPicked(d.day)}
            className={cn(
              'aspect-square rounded-[4px] transition-[outline-color,scale] duration-150',
              d.future ? 'bg-(--heat-0) opacity-35' : LEVELS[level(d)],
              d.day === today?.day && 'outline-1 outline-offset-1 outline-accent',
              selected?.day === d.day && 'scale-110 outline-2 outline-offset-1 outline-text',
            )}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-footnote text-muted" aria-live="polite">
          {selected && (
            <>
              <span className="font-semibold text-text">{longDay(selected.date)}</span> · {describe(selected)}
            </>
          )}
        </p>
        <span className="flex shrink-0 items-center gap-1 text-caption text-faint" aria-hidden>
          Less
          {LEVELS.map((c) => (
            <span key={c} className={cn('size-2.5 rounded-[3px]', c)} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}
