import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { authErrorMessage } from '@/lib/otp'
import { Aurora } from '@/ui/Aurora'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Logo } from '@/ui/Logo'
import { Page } from '@/ui/Page'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { TextField } from '@/ui/TextField'
import { useAuth } from './AuthProvider'
import { savePendingSignIn, sendCode, type AuthMode, type PendingSignIn } from './emailCode'

/** /login: asks for an email and sends a 6-digit code, which /login/verify takes. */
export function LoginPage() {
  const { session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // From RequireAuth ({ from }), or the code page's "Use a different email" (all three).
  const state = location.state as { from?: string; email?: string; mode?: AuthMode } | null
  const from = state?.from
  const [mode, setMode] = useState<AuthMode>(state?.mode ?? 'signin')
  const [email, setEmail] = useState(state?.email ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={from ?? '/'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const address = email.trim()
    const { error } = await sendCode(address, mode)
    setBusy(false)
    if (error) return setError(authErrorMessage(error))
    const pending: PendingSignIn = { email: address, mode, from, sentAt: Date.now() }
    savePendingSignIn(pending)
    navigate('/login/verify', { state: { pending }, viewTransition: true })
  }

  return (
    <Page className="flex min-h-dvh flex-col justify-center pb-16">
      <Aurora />
      <Logo className="size-14" />
      <h1 className="mt-6 font-display text-display font-semibold glass-text">
        {mode === 'signin' ? 'Welcome back' : 'Create your journal'}
      </h1>
      <p className="mt-1.5 text-callout text-muted">Plan workouts, log every set, see your progress.</p>

      <Card className="mt-8 p-4">
        <SegmentedControl
          aria-label="Sign in or create account"
          value={mode}
          onChange={(m) => {
            setMode(m)
            setError(null)
          }}
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Create account' },
          ]}
        />

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <TextField
            type="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && (
            <p role="alert" className="px-1 text-subhead text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={busy} className="mt-2">
            Email me a code
          </Button>
          <p className="px-1 text-center text-footnote text-muted">We'll email you a 6-digit code. No password needed.</p>
        </form>
      </Card>
      <Link to="/privacy" viewTransition className="mt-5 self-center text-footnote text-muted">
        Privacy policy
      </Link>
    </Page>
  )
}
