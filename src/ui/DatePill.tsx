import { Calendar } from 'lucide-react'
import { formatScheduled } from '@/lib/dates'
import { cn } from './cn'

/** A date as a pill; tapping it opens the system date picker when `onChange` is given. */
export function DatePill({
  value,
  onChange,
  label,
  emptyLabel = 'No date',
  size = 'sm',
}: {
  value: string | null
  onChange?: (value: string | null) => void
  label: string
  emptyLabel?: string
  size?: 'sm' | 'md'
}) {
  return (
    <label
      className={cn(
        'glass-control relative inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold text-muted',
        size === 'sm' ? 'h-8 px-3 text-footnote' : 'h-9 px-3.5 text-subhead',
      )}
    >
      <Calendar className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      {value ? formatScheduled(value) : emptyLabel}
      {onChange && (
        <input
          type="date"
          aria-label={label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      )}
    </label>
  )
}
