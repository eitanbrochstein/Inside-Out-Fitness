import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { ExerciseStats } from './types'
import { useExercises } from './useExercises'

const byExercise = (rows: ExerciseStats[] | null | undefined) => new Map((rows ?? []).map((r) => [r.exercise_id, r]))

/** Last/best for the exercises on a workout page, ignoring the workout itself. */
export function useWorkoutStats(workoutId: string, exerciseIds: string[], ownerId?: string) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  const ids = useMemo(() => [...new Set(exerciseIds)].sort(), [exerciseIds])
  const query = useQuery({
    queryKey: keys.workoutStats(owner, workoutId, ids),
    queryFn: async () =>
      must(await supabase.rpc('exercise_stats', { p_exercise_ids: ids, p_exclude_workout: workoutId, p_owner: owner })),
    enabled: ids.length > 0,
    placeholderData: (prev) => prev,
  })
  return useMemo(() => byExercise(query.data), [query.data])
}

/** Last/best/session count for every exercise with history. */
export function useAllStats(ownerId?: string) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  const { data: exercises } = useExercises()
  const query = useQuery({
    queryKey: keys.allStats(owner),
    queryFn: async () =>
      must(await supabase.rpc('exercise_stats', { p_exercise_ids: exercises!.map((e) => e.id), p_owner: owner })),
    enabled: !!exercises,
  })
  return { ...query, byExercise: useMemo(() => byExercise(query.data), [query.data]) }
}

export function useSetLog(exerciseId: string, ownerId?: string) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  return useQuery({
    queryKey: keys.setLog(owner, exerciseId),
    queryFn: async () =>
      must(
        await supabase
          .from('set_log')
          .select('*')
          .eq('owner_id', owner)
          .eq('exercise_id', exerciseId)
          .order('performed_at', { ascending: false })
          .order('block_position')
          .order('set_position')
          .limit(1000),
      ),
  })
}
