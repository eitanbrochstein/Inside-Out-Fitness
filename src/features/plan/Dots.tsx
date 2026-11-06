import type { WorkoutListItem } from '@/data/types'
import { isMissed } from '@/lib/calendar'
import { cn } from '@/ui/cn'

/** A day's workouts as up to three dots: filled once done, a ring while planned, faint when missed. */
export function Dots({ items, today }: { items: WorkoutListItem[]; today: string }) {
  return (
    <span aria-hidden className="flex h-1.5 items-center gap-[3px]">
      {items.slice(0, 3).map((w) => (
        <span
          key={w.id}
          className={cn(
            'size-1.5 rounded-full',
            w.status === 'completed'
              ? 'bg-success'
              : w.status === 'in_progress'
                ? 'bg-accent'
                : isMissed(w, today)
                  ? 'border border-faint'
                  : 'border border-accent',
          )}
        />
      ))}
    </span>
  )
}
