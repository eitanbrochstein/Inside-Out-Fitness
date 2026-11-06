import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { inviteErrorMessage, useAcceptInvite, useInvitePreview } from '@/data/useCoaching'
import { Button } from '@/ui/Button'
import { Page } from '@/ui/Page'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'
import { TextField } from '@/ui/TextField'

const title = 'mt-3 font-display text-title font-semibold text-balance'

const STATUS_MESSAGE: Record<string, string> = {
  own: "That's your own invite. Send it to a client instead.",
  used: 'This invite has already been used.',
  expired: 'This invite has expired. Ask your coach for a new one.',
  accepted: "You've already accepted this invite.",
}

/** /join (enter a code) and /join/:code (review and accept). */
export function JoinPage() {
  const { code } = useParams()
  return code ? <ReviewInvite code={code} /> : <EnterCode />
}

function EnterCode() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.trim()) navigate(`/join/${code.trim().toUpperCase()}`)
  }
  return (
    <Page className="flex min-h-dvh flex-col justify-center pb-16">
      <SectionLabel>Coaching invite</SectionLabel>
      <h1 className={title}>Join your coach</h1>
      <p className="mt-1.5 text-callout text-muted">Enter the code your coach sent you.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <TextField
          aria-label="Invite code"
          placeholder="ABCD2345"
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-14 [&_input]:text-center [&_input]:font-mono [&_input]:text-title-2 [&_input]:tracking-[0.2em] [&_input]:uppercase"
        />
        <Button type="submit" size="lg" block disabled={!code.trim()}>
          Continue
        </Button>
        <Button variant="ghost" block onClick={() => navigate('/')}>
          Not now
        </Button>
      </form>
    </Page>
  )
}

function ReviewInvite({ code }: { code: string }) {
  const navigate = useNavigate()
  const preview = useInvitePreview(code)
  const accept = useAcceptInvite()
  const [error, setError] = useState<string | null>(null)
  const info = preview.data

  const onAccept = () => {
    setError(null)
    accept.mutate(code, {
      onSuccess: () => {
        toast.success(`You're connected with ${info?.coach_name ?? 'your coach'}`)
        navigate('/', { replace: true, viewTransition: true })
      },
      onError: (e) => setError(inviteErrorMessage(e)),
    })
  }

  return (
    <Page className="flex min-h-dvh flex-col justify-center pb-16">
      <SectionLabel>Coaching invite</SectionLabel>
      {preview.isPending ? (
        <Skeleton className="mt-4 h-40" />
      ) : !info ? (
        <>
          <h1 className={title}>Invite not found</h1>
          <p className="mt-2 text-callout text-muted">Check the code or ask your coach for a new link.</p>
          <Button size="lg" block className="mt-6" onClick={() => navigate('/join', { replace: true })}>
            Enter a code
          </Button>
        </>
      ) : info.status !== 'valid' ? (
        <>
          <h1 className={title}>{info.coach_name}'s invite</h1>
          <p className="mt-2 text-callout text-muted">{STATUS_MESSAGE[info.status] ?? "This invite can't be used."}</p>
          <Button size="lg" block className="mt-6" onClick={() => navigate('/', { replace: true })}>
            Go to my journal
          </Button>
        </>
      ) : (
        <>
          <h1 className={title}>{info.coach_name} wants to coach you</h1>
          <ul className="mt-4 flex flex-col gap-2.5 text-callout text-muted">
            <li>They'll see your workouts, maxes and progress.</li>
            <li>Workouts they assign appear on your plan, with loads from your own maxes. They can adjust one until you start it.</li>
            <li>Your personal journal stays yours, and you can leave any time in Settings.</li>
          </ul>
          {error && (
            <p role="alert" className="mt-4 text-subhead text-danger">
              {error}
            </p>
          )}
          <Button size="lg" block className="mt-7" loading={accept.isPending} onClick={onAccept}>
            Accept invite
          </Button>
          <Button variant="ghost" block className="mt-2" onClick={() => navigate('/', { replace: true })}>
            Not now
          </Button>
        </>
      )}
    </Page>
  )
}
