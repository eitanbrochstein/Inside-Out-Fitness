import { useQuery } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import { dayKey, type CategoryTotals, type SummaryRow } from '@/lib/insights'
import { startOfWeek } from '@/lib/progress'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'
import { useProfile } from './useProfile'

/** How far back the dashboards look. One window, so Home and Progress share one fetch. */
export const SUMMARY_WEEKS = 26

/** Per-workout totals for the last `weeks` weeks (whole weeks, Monday first), newest first. */
export function useTrainingSummary({ weeks = SUMMARY_WEEKS, ownerId }: { weeks?: number; ownerId?: string } = {}) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  return useQuery({
    queryKey: keys.summary(owner, weeks),
    queryFn: async (): Promise<SummaryRow[]> => {
      const since = startOfWeek(new Date())
      since.setDate(since.getDate() - 7 * (weeks - 1))
      const rows = must(await supabase.rpc('training_summary', { p_owner: owner, p_since: since.toISOString() }))
      return (rows ?? []).map((r) => ({
        workoutId: r.workout_id,
        title: r.title,
        status: r.status,
        startedAt: r.started_at,
        performedAt: r.performed_at,
        setCount: r.set_count,
        repCount: r.rep_count,
        volumeKg: Number(r.volume_kg),
        categories: (r.categories ?? {}) as unknown as Record<string, CategoryTotals>,
      }))
    },
  })
}

export interface PersonalRecord {
  exerciseId: string
  workoutId: string
  performedAt: string
  kind: 'weight' | 'e1rm' | 'reps'
  weightKg: number | null
  reps: number | null
  value: number
  previous: number
}

/** Personal records, newest first: since a date, or set in one workout. */
export function usePersonalRecords({
  ownerId,
  since,
  workoutId,
  limit = 20,
  enabled = true,
}: { ownerId?: string; since?: Date; workoutId?: string; limit?: number; enabled?: boolean } = {}) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  const scope = workoutId ?? (since ? `since:${dayKey(since)}` : 'all')
  return useQuery({
    queryKey: [...keys.records(owner, scope), limit],
    enabled,
    queryFn: async (): Promise<PersonalRecord[]> => {
      const rows = must(
        await supabase.rpc('personal_records', {
          p_owner: owner,
          p_since: since?.toISOString(),
          p_workout: workoutId,
          p_limit: limit,
        }),
      )
      return (rows ?? []).map((r) => ({
        exerciseId: r.exercise_id,
        workoutId: r.workout_id,
        performedAt: r.performed_at,
        kind: r.kind as PersonalRecord['kind'],
        weightKg: r.weight_kg,
        reps: r.reps,
        value: Number(r.value),
        previous: Number(r.previous),
      }))
    },
  })
}

/** Sessions a week the owner is aiming for: yours from your profile, a client's from theirs. */
export function useWeeklyGoal(ownerId?: string) {
  const uid = useUserId()
  const own = !ownerId || ownerId === uid
  const profile = useProfile()
  const client = useQuery({
    queryKey: keys.weeklyGoal(ownerId ?? uid),
    enabled: !own,
    queryFn: async () => must(await supabase.from('profiles').select('weekly_goal').eq('id', ownerId!).single())?.weekly_goal,
  })
  return (own ? profile.data?.weekly_goal : client.data) ?? 3
}
