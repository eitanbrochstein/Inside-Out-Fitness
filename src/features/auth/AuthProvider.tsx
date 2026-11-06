import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear()
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}

export const useAuth = () => use(AuthContext)

/** The signed-in user's id. Only call below <RequireAuth>. */
export function useUserId() {
  const { session } = useAuth()
  if (!session) throw new Error('useUserId called outside an authenticated route')
  return session.user.id
}
