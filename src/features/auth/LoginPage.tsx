import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Aurora } from '@/ui/Aurora'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Logo } from '@/ui/Logo'
import { Page } from '@/ui/Page'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { TextField } from '@/ui/TextField'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) setError(error.message)
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
          <TextField
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Password"
            aria-label="Password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="px-1 text-subhead text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={busy} className="mt-2">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </Card>
      <Link to="/privacy" viewTransition className="mt-5 self-center text-footnote text-muted">
        Privacy policy
      </Link>
    </Page>
  )
}
