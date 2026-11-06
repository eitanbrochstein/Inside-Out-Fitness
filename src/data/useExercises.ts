import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { Exercise } from './types'

export const CATEGORIES = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Full body', 'Other'] as const
export const EQUIPMENT = ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'other'] as const

/** Every exercise this user can see: the library, their own, and (via coaching) a coach's or client's custom ones. */
export function useExercises() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.exercises(uid),
    queryFn: async () => must(await supabase.from('exercises').select('*').order('name')),
    staleTime: 5 * 60_000,
  })
}

/** Library + own exercises: what pickers and the Exercise Database list. */
export const isOwnOrLibrary = (e: Exercise, uid: string) => e.owner_id == null || e.owner_id === uid

export function useExerciseMap() {
  const { data } = useExercises()
  return useMemo(() => new Map((data ?? []).map((e) => [e.id, e])), [data])
}

type NewExercise = Pick<Exercise, 'name' | 'category' | 'equipment' | 'load_basis'>

export function useCreateExercise() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (exercise: Exercise) => {
      const { id, name, category, equipment, load_basis } = exercise
      return must(await supabase.from('exercises').insert({ id, name, category, equipment, load_basis }).select().single())
    },
    onMutate: (exercise) => {
      qc.setQueryData<Exercise[]>(keys.exercises(uid), (list) =>
        list && [...list, exercise].sort((a, b) => a.name.localeCompare(b.name)),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.exercises(uid) }),
  })
}

/** Builds the optimistic row for a new custom exercise. */
export function newExercise(uid: string, fields: NewExercise): Exercise {
  return { ...fields, id: crypto.randomUUID(), owner_id: uid, archived_at: null, created_at: new Date().toISOString() }
}

export function useUpdateExercise() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Exercise> & { id: string }) =>
      must(await supabase.from('exercises').update(patch).eq('id', id)),
    onMutate: ({ id, ...patch }) => {
      qc.setQueryData<Exercise[]>(keys.exercises(uid), (list) => list?.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.exercises(uid) }),
  })
}

export const equipmentLabel = (e: string) => e.charAt(0).toUpperCase() + e.slice(1)
