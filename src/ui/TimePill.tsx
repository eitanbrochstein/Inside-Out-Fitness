import { Clock, X } from 'lucide-react'
import { formatTime } from '@/lib/format'
import { cn } from './cn'

/** A time of day as a pill, beside a DatePill; tapping it opens the system time picker when `onChange` is given. */
export function TimePill({
  value,
  onChange,
  label,
  emptyLabel = 'Add time',
  size = 'sm',
  clearable = true,
}: {
  /** "18:30" or "18:30:00". */
  value: string | null
  onChange?: (value: string | null) => void
  label: string
  emptyLabel?: string
  size?: 'sm' | 'md'
  /** Shows an × that clears it. Off when something else turns the time off (a switch). */
  clearable?: boolean
}) {
  return (
    <span
      className={cn(
        'glass-control relative inline-flex shrink-0 items-center rounded-full font-semibold text-muted',
        size === 'sm' ? 'h-8 text-footnote' : 'h-9 text-subhead',
      )}
    >
      <label className={cn('relative inline-flex h-full items-center gap-1.5', size === 'sm' ? 'px-3' : 'px-3.5', value && onChange && clearable && 'pr-1.5')}>
        <Clock className={size === 'sm' ? 'size-3.5' : 'size-4'} />
        {value ? formatTime(value) : emptyLabel}
        {onChange && (
          <input
            type="time"
            aria-label={label}
            value={value?.slice(0, 5) ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        )}
      </label>
      {value && onChange && clearable && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onChange(null)}
          className="relative mr-1.5 grid size-5 place-items-center rounded-full text-faint before:absolute before:-inset-2 active:bg-(--glass-press)"
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      )}
    </span>
  )
}
