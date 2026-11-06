// Pure helpers for the workout being trained: live totals, records as sets are logged, elapsed time.
import { estimate1RM } from './load'

export interface SessionSet {
  id: string
  position: number
  completed_at: string | null
  actual_weight_kg: number | null
  actual_reps: number | null
}

export interface SessionBlock {
  type: string
  exercise: { load_basis: string } | null
  workout_sets: SessionSet[]
}

/** Weight × reps, counting both hands of a per-hand exercise. Bodyweight sets have no volume. */
export const setVolumeKg = (weightKg: number | null, reps: number | null, perHand: boolean) =>
  (weightKg ?? 0) * (reps ?? 0) * (perHand ? 2 : 1)

export function sessionTotals(blocks: SessionBlock[]) {
  let setsDone = 0
  let setsTotal = 0
  let reps = 0
  let volumeKg = 0
  let exercisesDone = 0
  let exercisesTotal = 0
  for (const b of blocks) {
    if (b.type !== 'exercise') continue
    const perHand = b.exercise?.load_basis === 'per_hand'
    const done = b.workout_sets.filter((s) => s.completed_at)
    setsTotal += b.workout_sets.length
    setsDone += done.length
    if (b.workout_sets.length) exercisesTotal++
    if (b.workout_sets.length && done.length === b.workout_sets.length) exercisesDone++
    for (const s of done) {
      reps += s.actual_reps ?? 0
      volumeKg += setVolumeKg(s.actual_weight_kg, s.actual_reps, perHand)
    }
  }
  return { setsDone, setsTotal, reps, volumeKg, exercisesDone, exercisesTotal }
}

export type RecordKind = 'weight' | 'e1rm' | 'reps'

/** The best from earlier sessions (exercise_stats); absent the first time an exercise is done. */
export interface PriorBest {
  weightKg: number | null
  e1rmKg: number | null
  reps: number | null
}

/** Whether a logged set beats `best`: heavier, a higher estimated 1RM, or more bodyweight reps. */
export function setRecordKind(set: { weightKg: number | null; reps: number | null }, best: PriorBest): RecordKind | null {
  if (!set.reps) return null
  if (set.weightKg == null) return best.weightKg == null && best.reps != null && set.reps > best.reps ? 'reps' : null
  if (best.weightKg != null && set.weightKg > best.weightKg + 0.001) return 'weight'
  const e1rm = estimate1RM(set.weightKg, set.reps)
  if (e1rm != null && best.e1rmKg != null && e1rm > best.e1rmKg + 0.01) return 'e1rm'
  return null
}

/**
 * Records among one exercise's logged sets, in set order: each set must beat earlier sessions and
 * the sets before it today. No earlier session means today is the baseline, so no records.
 */
export function blockRecords(sets: SessionSet[], prior: PriorBest | undefined): Map<string, RecordKind> {
  const out = new Map<string, RecordKind>()
  if (!prior) return out
  const best = { ...prior }
  for (const s of [...sets].sort((a, b) => a.position - b.position)) {
    if (!s.completed_at) continue
    const set = { weightKg: s.actual_weight_kg, reps: s.actual_reps }
    const kind = setRecordKind(set, best)
    if (kind) out.set(s.id, kind)
    if (set.weightKg != null) {
      best.weightKg = Math.max(best.weightKg ?? 0, set.weightKg)
      best.e1rmKg = Math.max(best.e1rmKg ?? 0, estimate1RM(set.weightKg, set.reps ?? 0) ?? 0)
    } else if (set.reps != null) {
      best.reps = Math.max(best.reps ?? 0, set.reps)
    }
  }
  return out
}

/** The strongest record each exercise set today (the last one in set order, as each beats the last). */
export function sessionRecords<B extends SessionBlock & { exercise_id: string | null }>(
  blocks: B[],
  priorOf: (exerciseId: string) => PriorBest | undefined,
) {
  return blocks.flatMap((block) => {
    if (block.type !== 'exercise' || !block.exercise_id) return []
    const records = [...blockRecords(block.workout_sets, priorOf(block.exercise_id))]
    if (!records.length) return []
    const [setId, kind] = records.at(-1)!
    return [{ block, set: block.workout_sets.find((s) => s.id === setId)!, kind }]
  })
}

/** 4:05, 12:34, 1:02:03. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 48 min, 1 h 12 min. */
export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}
