import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { MaxKind, TrainingMax } from './types'

/** Every recorded max for an owner, newest first. Small enough to load whole. */
export function useMaxes(ownerId?: string) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  return useQuery({
    queryKey: keys.maxes(owner),
    queryFn: async () =>
      must(
        await supabase
          .from('training_maxes')
          .select('*')
          .eq('owner_id', owner)
          .order('recorded_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  })
}

const maxKey = (exerciseId: string, kind: string) => `${exerciseId}:${kind}`

/** Latest max per exercise and kind. */
export function useCurrentMaxes(ownerId?: string) {
  const { data } = useMaxes(ownerId)
  return useMemo(() => {
    const map = new Map<string, TrainingMax>()
    for (const m of data ?? []) if (!map.has(maxKey(m.exercise_id, m.kind))) map.set(maxKey(m.exercise_id, m.kind), m)
    return {
      get: (exerciseId: string | null, kind: MaxKind | string = 'one_rm') =>
        exerciseId ? (map.get(maxKey(exerciseId, kind)) ?? null) : null,
      count: new Set([...map.values()].map((m) => m.exercise_id)).size,
    }
  }, [data])
}

/** Records a max for `max.owner_id`: yourself, or (as a coach) one of your clients. */
export function useAddMax() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (max: TrainingMax) => {
      const { id, owner_id, exercise_id, kind, value_kg, recorded_on, note } = max
      return must(await supabase.from('training_maxes').insert({ id, owner_id, exercise_id, kind, value_kg, recorded_on, note }))
    },
    onMutate: (max) => {
      qc.setQueryData<TrainingMax[]>(keys.maxes(max.owner_id), (list) =>
        [max, ...(list ?? [])].sort((a, b) => b.recorded_on.localeCompare(a.recorded_on) || b.created_at.localeCompare(a.created_at)),
      )
    },
    onSettled: (_d, _e, max) => {
      qc.invalidateQueries({ queryKey: keys.maxes(max.owner_id) })
      qc.invalidateQueries({ queryKey: ['coaching'] })
    },
  })
}

export function useDeleteMax() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('training_maxes').delete().eq('id', id)),
    onMutate: (id) => {
      qc.setQueryData<TrainingMax[]>(keys.maxes(uid), (list) => list?.filter((m) => m.id !== id))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.maxes(uid) }),
  })
}
