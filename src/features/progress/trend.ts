import type { SetLogRow, TrainingMax } from '@/data/types'
import { markPRs } from '@/lib/insights'
import { toDisplay, type Unit } from '@/lib/load'
import { sessionPoints } from '@/lib/progress'

export interface TrendPoint {
  t: number
  workoutId: string
  /** Estimated 1RM, or reps for bodyweight exercises: the line being charted. */
  value: number | null
  top: number | null
  topReps: number
  /** The stored 1RM in effect that day. */
  max: number | null
  pr: boolean
}

const round1 = (x: number) => Math.round(x * 10) / 10

/** One point per session, oldest first, in the display unit, with records flagged. */
export function trendPoints(log: SetLogRow[], oneRMs: TrainingMax[], unit: Unit) {
  const points = markPRs(
    sessionPoints(log.map((r) => ({ workout_id: r.workout_id!, performed_at: r.performed_at!, weight_kg: r.weight_kg, reps: r.reps }))),
  )
  const bodyweight = points.length > 0 && points.every((p) => p.topWeightKg == null)
  // oneRMs are newest first: the first one recorded on or before the day was in effect.
  const data: TrendPoint[] = points.map((p) => {
    const max = oneRMs.find((m) => m.recorded_on <= p.date.slice(0, 10))
    return {
      t: new Date(p.date).getTime(),
      workoutId: p.workoutId,
      value: bodyweight ? p.topReps : p.e1rmKg == null ? null : round1(toDisplay(p.e1rmKg, unit)),
      top: p.topWeightKg == null ? null : toDisplay(p.topWeightKg, unit),
      topReps: p.topReps,
      max: bodyweight || !max ? null : toDisplay(max.value_kg, unit),
      pr: p.pr,
    }
  })
  return { data, bodyweight }
}
