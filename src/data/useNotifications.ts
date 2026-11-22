import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import type { Database } from '@/lib/database.types'
import { must, supabase } from '@/lib/supabase'
import { keys } from './keys'

export type NotificationPrefs = Database['public']['Tables']['notification_prefs']['Row']
type Editable = Omit<NotificationPrefs, 'user_id' | 'timezone' | 'created_at' | 'updated_at'>

/** What a person gets before they change anything: the database's own defaults. */
export const DEFAULT_PREFS: Editable = {
  reminders: true,
  reminder_lead_min: 30,
  day_reminder_time: '08:00:00',
  nudge_after_days: 5,
  coach_updates: true,
  comments: true,
  client_activity: true,
}

/** Your notification settings, the same on every device. Defaults until you change one. */
export function useNotificationPrefs() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.notificationPrefs(uid),
    queryFn: async () => {
      const row = must(await supabase.from('notification_prefs').select('*').eq('user_id', uid).maybeSingle())
      return { ...DEFAULT_PREFS, ...row } as Editable & Partial<NotificationPrefs>
    },
  })
}

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

export function useUpdateNotificationPrefs() {
  const uid = useUserId()
  const qc = useQueryClient()
  return useMutation({
    // The row may not exist yet (no device registered), so this creates it; the time zone comes along.
    mutationFn: async (patch: Partial<Editable>) =>
      must(await supabase.from('notification_prefs').upsert({ user_id: uid, timezone: timezone(), ...patch }, { onConflict: 'user_id' })),
    onMutate: (patch) => {
      qc.setQueryData<Editable>(keys.notificationPrefs(uid), (p) => p && { ...p, ...patch })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.notificationPrefs(uid) }),
  })
}
