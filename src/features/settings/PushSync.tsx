import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useUserId } from '@/features/auth/AuthProvider'
import { onNotificationOpen, syncPush } from '@/lib/push'

/**
 * Renders nothing. When someone is signed in it keeps this device's push registration current (tokens
 * change, people travel) and opens the page a tapped notification points at.
 */
export function PushSync() {
  const uid = useUserId()
  const navigate = useNavigate()

  useEffect(() => {
    syncPush().catch(() => {
      // Offline, or the push service is unavailable: the next launch tries again.
    })
  }, [uid])

  useEffect(() => onNotificationOpen((path) => navigate(path, { viewTransition: true })), [navigate])

  return null
}
