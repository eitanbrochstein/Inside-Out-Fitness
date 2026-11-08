import { supabase } from '@/lib/supabase'

export type AuthMode = 'signin' | 'signup'

/** A sign-in waiting on its emailed code. */
export interface PendingSignIn {
  email: string
  mode: AuthMode
  /** Where to go once signed in: the page that sent the visitor to /login. */
  from?: string
  /** When the latest code was sent, in ms since the epoch. */
  sentAt: number
}

/**
 * Emails a 6-digit code (supabase/templates). Signing in never creates an account, so a mistyped
 * address gets an error instead of a second, empty account.
 */
export const sendCode = (email: string, mode: AuthMode) =>
  supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: mode === 'signup' } })

const KEY = 'pendingSignIn'
// Longer than a code lasts, so someone back after it expired can send a new one without retyping.
const KEEP_MS = 60 * 60 * 1000

// Kept in localStorage so the code page survives a reload, or iOS reopening the home-screen app
// after a trip to Mail for the code.
export function loadPendingSignIn(): PendingSignIn | null {
  try {
    const pending = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PendingSignIn | null
    if (pending && typeof pending.email === 'string' && Date.now() - pending.sentAt < KEEP_MS) return pending
  } catch {
    // Storage blocked or the entry is unreadable: start over at /login.
  }
  return null
}

export function savePendingSignIn(pending: PendingSignIn) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    // Storage blocked: the code page still works until a reload.
  }
}

export function clearPendingSignIn() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
