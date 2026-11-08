import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { authErrorMessage, cleanCode, CODE_LENGTH, RESEND_SECONDS } from '@/lib/otp'
import { supabase } from '@/lib/supabase'
import { Aurora } from '@/ui/Aurora'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Logo } from '@/ui/Logo'
import { Page } from '@/ui/Page'
import { TextField } from '@/ui/TextField'
import { useAuth } from './AuthProvider'
import { clearPendingSignIn, loadPendingSignIn, savePendingSignIn, sendCode, type PendingSignIn } from './emailCode'

/** /login/verify: takes the 6-digit code /login sent. The right code signs in, and the session redirects. */
export function VerifyPage() {
  const { session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // Storage first: it's rewritten on every resend, while the history entry keeps the first send.
  const [pending, setPending] = useState<PendingSignIn | null>(
    () => loadPendingSignIn() ?? (location.state as { pending?: PendingSignIn } | null)?.pending ?? null,
  )
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wait = useResendWait(pending?.sentAt)

  if (session) return <Navigate to={pending?.from ?? '/'} replace />
  if (!pending) return <Navigate to="/login" replace />

  const verify = async (token: string) => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'email' })
    if (error) {
      setBusy(false)
      setError(authErrorMessage(error))
      setCode('')
      inputRef.current?.focus()
      return
    }
    // Signed in: AuthProvider picks up the session and the redirect above takes over.
    clearPendingSignIn()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.length === CODE_LENGTH && !busy) void verify(code)
  }

  const resend = async () => {
    setResending(true)
    setError(null)
    const { error } = await sendCode(pending.email, pending.mode)
    setResending(false)
    if (error) return setError(authErrorMessage(error))
    const next = { ...pending, sentAt: Date.now() }
    savePendingSignIn(next)
    setPending(next)
    setCode('')
    toast('New code sent')
    inputRef.current?.focus()
  }

  const startOver = () => {
    clearPendingSignIn()
    navigate('/login', { replace: true, state: { from: pending.from, email: pending.email, mode: pending.mode }, viewTransition: true })
  }

  return (
    <Page className="flex min-h-dvh flex-col justify-center pb-16">
      <Aurora />
      <Logo className="size-14" />
      <h1 className="mt-6 font-display text-display font-semibold glass-text">
        {pending.mode === 'signup' ? 'Confirm your email' : 'Check your email'}
      </h1>
      <p className="mt-1.5 text-callout text-muted">
        Enter the 6-digit code we sent to <span className="font-semibold break-all text-text">{pending.email}</span>.
      </p>

      <Card className="mt-8 p-4">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextField
            ref={inputRef}
            aria-label="6-digit code"
            // Lets iOS and Android offer the code from Mail. No maxLength: the browser would cut a pasted
            // "123 456" short before cleanCode could drop the space.
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            placeholder="······"
            value={code}
            readOnly={busy}
            onChange={(e) => {
              const next = cleanCode(e.target.value)
              setCode(next)
              if (next.length === CODE_LENGTH && !busy) void verify(next)
            }}
            className="h-16"
            inputClassName="pl-[0.5em] text-center font-display text-title font-semibold tracking-[0.5em] tabular-nums placeholder:text-faint"
          />
          {error && (
            <p role="alert" className="px-1 text-subhead text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={busy} disabled={code.length < CODE_LENGTH} className="mt-2">
            {pending.mode === 'signup' ? 'Confirm and continue' : 'Sign in'}
          </Button>
        </form>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={startOver}>
            Use a different email
          </Button>
          <Button variant="ghost" size="sm" className="tabular-nums" loading={resending} disabled={wait > 0} onClick={() => void resend()}>
            {wait > 0 ? `Resend in ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}` : 'Resend code'}
          </Button>
        </div>
      </Card>
      <p className="mt-5 self-center text-center text-footnote text-muted">Can't find it? Check your spam folder.</p>
    </Page>
  )
}

/** Seconds until another code can be sent, counting down to 0. */
function useResendWait(sentAt: number | undefined) {
  const [now, setNow] = useState(Date.now)
  // Capped because `now` stops ticking at 0 and is stale for a moment after a resend.
  const wait = sentAt ? Math.min(RESEND_SECONDS, Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - now) / 1000))) : 0
  useEffect(() => {
    if (wait === 0) return
    const id = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(id)
  }, [wait, now])
  return wait
}
