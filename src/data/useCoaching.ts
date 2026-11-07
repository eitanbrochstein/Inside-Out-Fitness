// Coaching: relationships, invites, assignment, client data and workout comments.
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import type { Rounding, Unit } from '@/lib/load'
import { isNative } from '@/lib/native'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { Invite, MaxKind, TrainingMax, WorkoutComment } from './types'
import { LIST_SELECT } from './useWorkouts'

export interface Client {
  id: string
  name: string
  unit: Unit
  rounding: Rounding
  since: string
}

const PERSON = 'id, display_name, unit, rounding_increment, rounding_mode'

const displayName = (name: string | null | undefined) => name?.trim() || 'Unnamed'

/** Active clients of the signed-in coach, by name. */
export function useClients(opts: { enabled?: boolean } = {}) {
  const uid = useUserId()
  const query = useQuery({
    queryKey: keys.clients(uid),
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const rows = must(
        await supabase
          .from('coach_clients')
          .select(`created_at, client:profiles!coach_clients_client_id_fkey(${PERSON})`)
          .eq('coach_id', uid)
          .eq('status', 'active'),
      )
      return (rows ?? [])
        .flatMap((r) =>
          r.client
            ? [
                {
                  id: r.client.id,
                  name: displayName(r.client.display_name),
                  unit: r.client.unit as Unit,
                  rounding: { increment: r.client.rounding_increment, mode: r.client.rounding_mode } as Rounding,
                  since: r.created_at,
                } satisfies Client,
              ]
            : [],
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  })
  const byId = useMemo(() => new Map((query.data ?? []).map((c) => [c.id, c])), [query.data])
  return { ...query, byId }
}

/** The signed-in user's active coaches. */
export function useCoaches() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.coaches(uid),
    queryFn: async () => {
      const rows = must(
        await supabase
          .from('coach_clients')
          .select('created_at, coach:profiles!coach_clients_coach_id_fkey(id, display_name)')
          .eq('client_id', uid)
          .eq('status', 'active'),
      )
      return (rows ?? []).flatMap((r) => (r.coach ? [{ id: r.coach.id, name: displayName(r.coach.display_name), since: r.created_at }] : []))
    },
  })
}

/** Ends a coach–client relationship from either side. */
export function useEndCoaching() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ coachId, clientId }: { coachId: string; clientId: string }) =>
      must(await supabase.from('coach_clients').update({ status: 'ended' }).eq('coach_id', coachId).eq('client_id', clientId)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['coaching'] }),
  })
}

// ---------- invites ----------

export function useInvites() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.invites(uid),
    queryFn: async () =>
      must(
        await supabase
          .from('coach_invites')
          .select('*')
          .eq('coach_id', uid)
          .is('accepted_by', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ),
  })
}

export function useCreateInvite() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (label: string | null) => must(await supabase.from('coach_invites').insert({ label }).select().single()),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.invites(uid) }),
  })
}

export function useRevokeInvite() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => must(await supabase.from('coach_invites').delete().eq('code', code)),
    onMutate: (code) => {
      qc.setQueryData<Invite[]>(keys.invites(uid), (list) => list?.filter((i) => i.code !== code))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.invites(uid) }),
  })
}

/** The apps have no web address of their own, so their links point at the website (see vite.config.ts). */
export const inviteLink = (code: string) =>
  new URL(`/join/${code}`, isNative ? import.meta.env.VITE_APP_URL : window.location.origin).href

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: ['invite', code],
    queryFn: async () => must(await supabase.rpc('invite_preview', { p_code: code }))?.[0] ?? null,
    retry: false,
  })
}

const INVITE_ERRORS: Record<string, string> = {
  invite_invalid: "This invite link isn't valid.",
  invite_own: "That's your own invite. Send it to a client instead.",
  invite_used: 'This invite has already been used.',
  invite_expired: 'This invite has expired. Ask your coach for a new one.',
}

export const inviteErrorMessage = (error: unknown) =>
  INVITE_ERRORS[(error as { message?: string })?.message ?? ''] ?? "Couldn't accept the invite. Try again."

export function useAcceptInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => must(await supabase.rpc('accept_invite', { p_code: code })),
    onSuccess: () => qc.invalidateQueries(),
    retry: false,
    meta: { quiet: true },
  })
}

// ---------- assignment ----------

export function useAssignTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { templateId: string; clientIds: string[]; scheduledFor: string | null }) =>
      must(
        await supabase.rpc('assign_template', {
          p_template: args.templateId,
          p_client_ids: args.clientIds,
          p_scheduled_for: args.scheduledFor ?? undefined,
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['coaching'] })
    },
  })
}

// ---------- client data ----------

/** Recently completed sessions across the given clients, newest first. */
export function useClientActivity(clientIds: string[]) {
  const uid = useUserId()
  const ids = useMemo(() => [...clientIds].sort(), [clientIds])
  return useQuery({
    queryKey: keys.clientActivity(uid, ids),
    enabled: ids.length > 0,
    queryFn: async () =>
      must(
        await supabase
          .from('workouts')
          .select(LIST_SELECT)
          .in('owner_id', ids)
          .eq('kind', 'workout')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(60),
      ),
  })
}

/** Current maxes for several clients at once (for the assign preview). */
export function useClientMaxes(clientIds: string[]) {
  const uid = useUserId()
  const ids = useMemo(() => [...clientIds].sort(), [clientIds])
  const query = useQuery({
    queryKey: keys.clientMaxes(uid, ids),
    enabled: ids.length > 0,
    queryFn: async () =>
      must(
        await supabase
          .from('training_maxes')
          .select('*')
          .in('owner_id', ids)
          .order('recorded_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  })
  return useMemo(() => {
    const latest = new Map<string, TrainingMax>()
    for (const m of query.data ?? []) {
      const k = `${m.owner_id}:${m.exercise_id}:${m.kind}`
      if (!latest.has(k)) latest.set(k, m)
    }
    return (owner: string, exerciseId: string, kind: MaxKind | string = 'one_rm') => latest.get(`${owner}:${exerciseId}:${kind}`) ?? null
  }, [query.data])
}

// ---------- comments ----------

export function useComments(workoutId: string) {
  return useQuery({
    queryKey: keys.comments(workoutId),
    queryFn: async () =>
      must(
        await supabase
          .from('workout_comments')
          .select('*, author:profiles(display_name)')
          .eq('workout_id', workoutId)
          .order('created_at'),
      ) as WorkoutComment[],
  })
}

export function useAddComment(workoutId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: WorkoutComment) =>
      must(await supabase.from('workout_comments').insert({ id: c.id, workout_id: workoutId, body: c.body, owner_id: c.owner_id })),
    onMutate: (c) => {
      qc.setQueryData<WorkoutComment[]>(keys.comments(workoutId), (list) => [...(list ?? []), c])
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.comments(workoutId) }),
  })
}

export function useDeleteComment(workoutId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('workout_comments').delete().eq('id', id)),
    onMutate: (id) => {
      qc.setQueryData<WorkoutComment[]>(keys.comments(workoutId), (list) => list?.filter((c) => c.id !== id))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.comments(workoutId) }),
  })
}
