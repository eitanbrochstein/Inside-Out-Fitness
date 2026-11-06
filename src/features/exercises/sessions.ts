import type { SetLogRow } from '@/data/types'

export interface Session {
  workoutId: string
  title: string | null
  performedAt: string
  sets: SetLogRow[]
}

/** Groups set-log rows (newest first) into sessions, keeping order. */
export function groupSessions(rows: SetLogRow[]): Session[] {
  const map = new Map<string, Session>()
  for (const r of rows) {
    const s = map.get(r.workout_id!) ?? { workoutId: r.workout_id!, title: r.workout_title, performedAt: r.performed_at!, sets: [] }
    s.sets.push(r)
    map.set(r.workout_id!, s)
  }
  return [...map.values()]
}
