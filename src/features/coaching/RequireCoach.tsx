import { Navigate, Outlet } from 'react-router'
import { useProfile } from '@/data/useProfile'
import { Splash } from '@/ui/Splash'

/** Coaching routes need coaching turned on in Settings. */
export function RequireCoach() {
  const { data: profile, isPending } = useProfile()
  if (isPending) return <Splash />
  if (!profile?.is_coach) return <Navigate to="/settings" replace />
  return <Outlet />
}
