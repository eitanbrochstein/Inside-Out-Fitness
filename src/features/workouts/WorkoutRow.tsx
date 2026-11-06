import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useUserId } from '@/features/auth/AuthProvider'
import type { WorkoutListItem } from '@/data/types'
import { Badge } from '@/ui/Chip'
import { describeWorkout } from './describe'

/** A workout or template as a card in a list. */
export function WorkoutRow({ w }: { w: WorkoutListItem }) {
  const uid = useUserId()
  const origin = w.assigned_by ? (w.assigned_by === uid ? 'Assigned' : `From ${w.coach?.display_name || 'your coach'}`) : null
  return (
    <Link
      to={`/w/${w.id}`}
      viewTransition
      data-interactive
      className="glass-card flex select-none items-center gap-3 rounded-card px-4 py-3.5 [content-visibility:auto] [contain-intrinsic-size:auto_92px] active:scale-[0.98]"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-headline font-semibold">{w.title || 'Untitled workout'}</span>
          {w.status === 'in_progress' && (
            <Badge tone="live" pulse>
              Live
            </Badge>
          )}
        </span>
        {w.subtitle && <span className="mt-0.5 block truncate text-subhead text-muted">{w.subtitle}</span>}
        <span className="mt-1.5 flex items-center gap-2">
          {origin && <Badge tone="accent">{origin}</Badge>}
          <span className="truncate text-footnote text-faint">{describeWorkout(w)}</span>
        </span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-faint" />
    </Link>
  )
}
