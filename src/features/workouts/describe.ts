import type { WorkoutListItem } from '@/data/types'
import { formatScheduled, formatTimestamp } from '@/lib/dates'
import { plural } from '@/lib/format'

/** "Today · 3 exercises", or when it was completed (and how hard it felt). */
export function describeWorkout(w: WorkoutListItem) {
  const exercises = w.workout_blocks.filter((b) => b.type === 'exercise').length
  const count = exercises ? plural(exercises, 'exercise') : 'No exercises yet'
  if (w.status === 'completed' && w.completed_at) return [formatTimestamp(w.completed_at), count, w.rpe != null ? `RPE ${w.rpe}` : null].filter(Boolean).join(' · ')
  if (w.scheduled_for) return `${formatScheduled(w.scheduled_for)} · ${count}`
  return count
}
