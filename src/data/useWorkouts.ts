import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import { addDays, localMidnight } from '@/lib/calendar'
import { todayISO } from '@/lib/dates'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { WorkoutDoc, WorkoutListItem } from './types'

export const LIST_SELECT = '*, workout_blocks(type), coach:profiles!workouts_assigned_by_fkey(display_name)'

export function useWorkoutList(scope: 'current' | 'history', ownerId?: string) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  return useQuery({
    queryKey: keys.workoutList(owner, scope),
    queryFn: async () => {
      const base = supabase.from('workouts').select(LIST_SELECT).eq('owner_id', owner).eq('kind', 'workout')
      const query =
        scope === 'current'
          ? base
              .in('status', ['planned', 'in_progress'])
              .order('scheduled_for', { ascending: true, nullsFirst: false })
              .order('created_at', { ascending: false })
          : base.eq('status', 'completed').order('completed_at', { ascending: false }).limit(200)
      return must(await query) as WorkoutListItem[]
    },
  })
}

/**
 * Every workout on the days `from`–`to` (inclusive): planned and under-way ones by their date, completed
 * ones by when they were finished. Two single-column range queries, so each can use its index.
 */
export const calendarQuery = (owner: string, from: string, to: string) =>
  queryOptions({
    queryKey: keys.calendar(owner, from, to),
    queryFn: async () => {
      const base = () => supabase.from('workouts').select(LIST_SELECT).eq('owner_id', owner).eq('kind', 'workout')
      const [open, done] = await Promise.all([
        base().in('status', ['planned', 'in_progress']).gte('scheduled_for', from).lte('scheduled_for', to),
        base().eq('status', 'completed').gte('completed_at', localMidnight(from)).lt('completed_at', localMidnight(addDays(to, 1))),
      ])
      return [...(must(open) ?? []), ...(must(done) ?? [])] as WorkoutListItem[]
    },
  })

export function useCalendar(from: string, to: string, ownerId?: string) {
  const uid = useUserId()
  return useQuery(calendarQuery(ownerId ?? uid, from, to))
}

/** Moves a workout to another day. */
export function useReschedule(ownerId?: string) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) =>
      must(await supabase.from('workouts').update({ scheduled_for: date }).eq('id', id)),
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.workouts(owner) })
      qc.invalidateQueries({ queryKey: keys.workout(id) })
    },
  })
}

export function useTemplates() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.templates(uid),
    queryFn: async () =>
      must(
        await supabase
          .from('workouts')
          .select(LIST_SELECT)
          .eq('owner_id', uid)
          .eq('kind', 'template')
          .is('program_id', null)
          .order('updated_at', { ascending: false }),
      ) as WorkoutListItem[],
  })
}

type Kind = 'workout' | 'template'

/** A workout's date: the one asked for, else today. Templates have none. */
const dateFor = (kind: Kind, scheduledFor?: string) => (kind === 'workout' ? (scheduledFor ?? todayISO()) : null)

export interface NewWorkout {
  id: string
  kind?: Kind
  scheduledFor?: string
  /** A day of a program (always a template). */
  program?: { id: string; day: number }
  /** A client's calendar, when coaching: an assigned workout they own. */
  ownerId?: string
}

export function useCreateWorkout() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['createWorkout'],
    mutationFn: async ({ id, kind = 'workout', scheduledFor, program, ownerId }: NewWorkout) =>
      ownerId && ownerId !== uid
        ? must(await supabase.rpc('assign_blank_workout', { p_client: ownerId, p_scheduled_for: dateFor(kind, scheduledFor) ?? undefined, p_new_id: id }))
        : must(
            await supabase
              .from('workouts')
              .insert({ id, kind, scheduled_for: dateFor(kind, scheduledFor), program_id: program?.id, program_day: program?.day }),
          ),
    onMutate: ({ id, kind = 'workout', scheduledFor, program, ownerId }) => {
      const assigned = !!ownerId && ownerId !== uid
      // Seed the page cache so the new page opens instantly.
      const now = new Date().toISOString()
      qc.setQueryData<WorkoutDoc>(keys.workout(id), {
        id,
        owner_id: ownerId ?? uid,
        kind,
        title: '',
        subtitle: '',
        status: 'planned',
        scheduled_for: dateFor(kind, scheduledFor),
        started_at: null,
        completed_at: null,
        rpe: null,
        source_workout_id: null,
        assigned_by: assigned ? uid : null,
        assigned_at: assigned ? now : null,
        program_id: program?.id ?? null,
        program_day: program?.day ?? null,
        program_run_id: null,
        created_at: now,
        updated_at: now,
        coach: null,
        workout_blocks: [],
      })
    },
    onSettled: (_d, _e, { ownerId }) => qc.invalidateQueries({ queryKey: keys.workouts(ownerId ?? uid) }),
  })
}

export function useDeleteWorkout() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('workouts').delete().eq('id', id)),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.workout(id) })
      qc.invalidateQueries({ queryKey: keys.workouts(uid) })
      qc.invalidateQueries({ queryKey: keys.stats(uid) })
    },
  })
}

/** Deep-copies a workout's plan: Repeat, Save workout, Start or Schedule a saved workout, Duplicate. */
export function useCopyWorkout() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ source, id, kind = 'workout', scheduledFor }: { source: string; id: string; kind?: Kind; scheduledFor?: string }) =>
      must(
        await supabase.rpc('copy_workout', {
          p_source: source,
          p_new_id: id,
          p_kind: kind,
          p_scheduled_for: dateFor(kind, scheduledFor) ?? undefined,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workouts(uid) }),
  })
}
