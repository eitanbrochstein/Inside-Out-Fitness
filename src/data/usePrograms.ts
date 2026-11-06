// Programs: reusable blocks of weeks whose days are templates. A run is a program started on someone's
// calendar. Changes to one program run one at a time (a shared mutation scope), like a workout's.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { Program, ProgramDay, ProgramDoc, ProgramListItem, ProgramRun } from './types'
import { LIST_SELECT } from './useWorkouts'

const byDay = (a: ProgramDay, b: ProgramDay) => a.program_day - b.program_day || a.created_at.localeCompare(b.created_at)

export function usePrograms() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.programs(uid),
    queryFn: async () =>
      must(
        await supabase
          .from('programs')
          .select('*, workouts!workouts_program_fk(id)')
          .eq('owner_id', uid)
          .order('updated_at', { ascending: false }),
      ) as ProgramListItem[],
  })
}

/** A program with its days in order. */
export function useProgram(id: string | null | undefined) {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.program(uid, id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const doc = must(
        await supabase.from('programs').select(`*, workouts!workouts_program_fk(${LIST_SELECT})`).eq('id', id!).maybeSingle(),
      ) as ProgramDoc | null
      return doc && { ...doc, workouts: [...doc.workouts].sort(byDay) }
    },
  })
}

export function useCreateProgram() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['createProgram'],
    mutationFn: async (id: string) => must(await supabase.from('programs').insert({ id })),
    onMutate: (id) => {
      // Seed the page so the new program opens instantly.
      const now = new Date().toISOString()
      qc.setQueryData<ProgramDoc>(keys.program(uid, id), {
        id,
        owner_id: uid,
        title: '',
        description: '',
        week_count: 1,
        created_at: now,
        updated_at: now,
        workouts: [],
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.programs(uid) }),
  })
}

/** Everything that changes one program: its text, its weeks, its days. */
export function useProgramActions(id: string) {
  const uid = useUserId()
  const qc = useQueryClient()
  const key = keys.program(uid, id)
  const scope = { id: `program:${id}` }
  const mutationKey = ['program', id]
  const refresh = () => qc.invalidateQueries({ queryKey: keys.workouts(uid) })

  const update = useMutation({
    mutationKey,
    scope,
    mutationFn: async (patch: Partial<Pick<Program, 'title' | 'description'>>) => must(await supabase.from('programs').update(patch).eq('id', id)),
    onMutate: (patch) => qc.setQueryData<ProgramDoc | null>(key, (doc) => doc && { ...doc, ...patch }),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.programs(uid) }),
  })

  /** A week at `at` (0-based); with `copyFrom`, a copy of that week. */
  const insertWeek = useMutation({
    mutationKey,
    scope,
    mutationFn: async ({ at, copyFrom }: { at: number; copyFrom?: number }) =>
      must(await supabase.rpc('program_insert_week', { p_program: id, p_at: at, p_copy_from: copyFrom })),
    onSettled: refresh,
  })

  const deleteWeek = useMutation({
    mutationKey,
    scope,
    mutationFn: async (week: number) => must(await supabase.rpc('program_delete_week', { p_program: id, p_week: week })),
    onSettled: refresh,
  })

  const clearWeek = useMutation({
    mutationKey,
    scope,
    mutationFn: async (week: number) =>
      must(await supabase.from('workouts').delete().eq('program_id', id).gte('program_day', week * 7).lt('program_day', (week + 1) * 7)),
    onMutate: (week) =>
      qc.setQueryData<ProgramDoc | null>(key, (doc) => doc && { ...doc, workouts: doc.workouts.filter((w) => Math.floor(w.program_day / 7) !== week) }),
    onSettled: refresh,
  })

  /** A copy of a saved workout on a day. */
  const addSaved = useMutation({
    mutationKey,
    scope,
    mutationFn: async ({ day, source }: { day: number; source: string }) =>
      must(await supabase.rpc('add_program_workout', { p_program: id, p_day: day, p_source: source })),
    onSettled: refresh,
  })

  const remove = useMutation({
    mutationKey,
    scope,
    mutationFn: async () => must(await supabase.from('programs').delete().eq('id', id)),
    onSuccess: () => {
      qc.removeQueries({ queryKey: key })
      refresh()
    },
  })

  return { update, insertWeek, deleteWeek, clearWeek, addSaved, remove }
}

/**
 * Starts a program on a Monday: for yourself, or for each of `clientIds` (as their coach). Days before
 * `skipBefore` are left out. Everyone's calendars refresh, since a coach fills clients' too.
 */
export function useStartProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { programId: string; start: string; clientIds?: string[]; skipBefore?: string }) =>
      must(
        await supabase.rpc('start_program', {
          p_program: v.programId,
          p_start: v.start,
          p_client_ids: v.clientIds,
          p_skip_before: v.skipBefore,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

/** Someone's runs that haven't been stopped, newest first. */
export function useProgramRuns(ownerId?: string) {
  const uid = useUserId()
  const owner = ownerId ?? uid
  return useQuery({
    queryKey: keys.runs(owner),
    queryFn: async () =>
      must(
        await supabase
          .from('program_runs')
          .select('*, coach:profiles!program_runs_assigned_by_fkey(display_name)')
          .eq('owner_id', owner)
          .is('ended_at', null)
          .order('start_date', { ascending: false }),
      ) as ProgramRun[],
  })
}

/** Stops a run: its unstarted workouts come off the calendar. Resolves to how many. */
export function useStopRun(ownerId?: string) {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (runId: string) => must(await supabase.rpc('stop_program_run', { p_run: runId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workouts(ownerId ?? uid) }),
  })
}
