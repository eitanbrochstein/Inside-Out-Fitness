// Pure helpers behind history "best" values and the progress charts.
import { estimate1RM } from './load'

export interface TopSet {
  weightKg: number | null // null = bodyweight
  reps: number
}

/** Heaviest set; ties go to more reps. Bodyweight sets only win when nothing was loaded. */
export function topSet(sets: TopSet[]): TopSet | null {
  let best: TopSet | null = null
  for (const s of sets) {
    if (!best) best = s
    else {
      const w = s.weightKg ?? -1
      const bw = best.weightKg ?? -1
      if (w > bw || (w === bw && s.reps > best.reps)) best = s
    }
  }
  return best
}

export interface LoggedSet {
  workout_id: string
  performed_at: string
  weight_kg: number | null
  reps: number | null
}

export interface SessionPoint {
  workoutId: string
  date: string
  topWeightKg: number | null
  topReps: number
  e1rmKg: number | null
  setCount: number
}

export function sessionPoints(sets: LoggedSet[]): SessionPoint[] {
  const byWorkout = new Map<string, LoggedSet[]>()
  for (const s of sets) {
    const list = byWorkout.get(s.workout_id) ?? []
    list.push(s)
    byWorkout.set(s.workout_id, list)
  }
  const points: SessionPoint[] = []
  for (const [workoutId, list] of byWorkout) {
    const top = topSet(list.map((s) => ({ weightKg: s.weight_kg, reps: s.reps ?? 0 })))!
    const e1rms = list.map((s) => (s.weight_kg == null ? null : estimate1RM(s.weight_kg, s.reps ?? 0))).filter((x) => x != null)
    points.push({
      workoutId,
      date: list[0].performed_at,
      topWeightKg: top.weightKg,
      topReps: top.reps,
      e1rmKg: e1rms.length ? Math.max(...e1rms) : null,
      setCount: list.length,
    })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export const startOfWeek = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
