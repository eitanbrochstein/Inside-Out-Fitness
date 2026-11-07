import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/AuthProvider'
import type { Rounding, Unit } from '@/lib/load'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { Profile } from './types'

export function useProfile() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.profile(uid),
    queryFn: async () => must(await supabase.from('profiles').select('*').eq('id', uid).single()) as Profile,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateProfile() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, 'id'>>) => must(await supabase.from('profiles').update(patch).eq('id', uid)),
    onMutate: (patch) => {
      qc.setQueryData<Profile>(keys.profile(uid), (p) => p && { ...p, ...patch })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.profile(uid) }),
  })
}

/** Permanently deletes the signed-in account. Signing out afterwards takes the app back to the login page. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      must(await supabase.rpc('delete_my_account'))
      toast('Your account has been deleted')
      // Local only: the session died with the account, so there's nothing left to end on the server.
      await supabase.auth.signOut({ scope: 'local' })
    },
    retry: false,
    meta: { quiet: true },
  })
}

/** Display unit and rounding rule for load math, with sensible defaults while loading. */
export function useUnits(): { unit: Unit; rounding: Rounding } {
  const { data } = useProfile()
  const unit = data?.unit ?? 'lb'
  const increment = data?.rounding_increment ?? 5
  const mode = data?.rounding_mode ?? 'nearest'
  return useMemo(() => ({ unit, rounding: { increment, mode } }), [unit, increment, mode])
}
