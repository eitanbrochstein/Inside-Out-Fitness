import { useMemo, useState } from 'react'
import { Check, Copy, Share, UserPlus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Invite } from '@/data/types'
import { inviteLink, useClientActivity, useClients, useCreateInvite, useInvites, useRevokeInvite } from '@/data/useCoaching'
import { formatDay, formatTimestamp, lowerRelative } from '@/lib/dates'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { IconButton } from '@/ui/IconButton'
import { ListGroup, ListRow } from '@/ui/ListRow'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { Sheet } from '@/ui/Sheet'
import { Skeleton } from '@/ui/Skeleton'
import { TextField } from '@/ui/TextField'

export function ClientsPage() {
  const clients = useClients()
  const invites = useInvites()
  const revoke = useRevokeInvite()
  const activity = useClientActivity((clients.data ?? []).map((c) => c.id))
  const [inviting, setInviting] = useState(false)

  const lastSession = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of activity.data ?? []) if (w.completed_at && !map.has(w.owner_id)) map.set(w.owner_id, w.completed_at)
    return map
  }, [activity.data])

  return (
    <Page>
      <PageHeader
        title="Clients"
        actions={
          <IconButton aria-label="Invite a client" variant="accent" size="md" onClick={() => setInviting(true)}>
            <UserPlus className="size-5" strokeWidth={2.2} />
          </IconButton>
        }
      />

      {clients.isPending ? (
        <Skeleton className="h-48" />
      ) : clients.data?.length ? (
        <ListGroup>
          {clients.data.map((c) => {
            const last = lastSession.get(c.id)
            return (
              <ListRow
                key={c.id}
                to={`/coach/clients/${c.id}`}
                leading={<Avatar name={c.name} />}
                title={c.name}
                subtitle={last ? `Last trained ${lowerRelative(formatTimestamp(last))}` : 'No sessions yet'}
                trailing="chevron"
              />
            )
          })}
        </ListGroup>
      ) : (
        <EmptyState
          icon={<Users />}
          title="No clients yet"
          action={
            <Button onClick={() => setInviting(true)}>
              <UserPlus className="size-4" /> Invite a client
            </Button>
          }
        >
          Invite someone to share their training with you.
        </EmptyState>
      )}

      {!!invites.data?.length && (
        <>
          <SectionLabel className="mt-7 mb-2 px-1">Pending invites</SectionLabel>
          <ListGroup>
            {invites.data.map((i) => (
              <PendingInvite key={i.code} invite={i} onRevoke={() => revoke.mutate(i.code)} />
            ))}
          </ListGroup>
        </>
      )}

      <InviteSheet open={inviting} onOpenChange={setInviting} />
    </Page>
  )
}

function PendingInvite({ invite, onRevoke }: { invite: Invite; onRevoke: () => void }) {
  return (
    <div className="flex items-center gap-1 py-2.5 pr-2 pl-4">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-callout font-semibold">{invite.label || 'Invite link'}</span>
        <span className="block text-footnote text-muted">
          <span className="font-mono tracking-wider">{invite.code}</span> · expires {formatDay(new Date(invite.expires_at))}
        </span>
      </span>
      <CopyButton text={inviteLink(invite.code)} />
      <IconButton aria-label="Revoke invite" size="md" onClick={onRevoke}>
        <X className="size-4" />
      </IconButton>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <IconButton
      aria-label="Copy invite link"
      size="md"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error("Couldn't copy. Long-press the link to copy it instead.")
        }
      }}
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </IconButton>
  )
}

function InviteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateInvite()
  const [label, setLabel] = useState('')
  const [invite, setInvite] = useState<Invite | null>(null)
  const link = invite ? inviteLink(invite.code) : ''

  const change = (o: boolean) => {
    if (!o) {
      setInvite(null)
      setLabel('')
    }
    onOpenChange(o)
  }

  const share = async () => {
    try {
      await navigator.share({ title: 'Join me on Inside Out Training', text: 'Use this link to connect your training journal with me:', url: link })
    } catch {
      // dismissed
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={change}
      title={invite ? 'Invite ready' : 'Invite a client'}
      description={
        invite
          ? 'Send this link. It works once and expires in 14 days.'
          : 'Clients who accept share their workouts, maxes and progress with you. They can leave any time.'
      }
    >
      {invite ? (
        <div className="flex flex-col gap-3 pt-1 pb-3">
          <div className="glass-field rounded-field px-3.5 py-3 text-callout break-all select-all">{link}</div>
          <p className="text-subhead text-muted">
            Or have them enter code <span className="font-mono font-semibold tracking-wider text-text">{invite.code}</span> at /join.
          </p>
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link)
                  toast.success('Link copied')
                } catch {
                  toast.error("Couldn't copy. Select the link above instead.")
                }
              }}
            >
              <Copy className="size-[18px]" /> Copy link
            </Button>
            {'share' in navigator && (
              <Button size="lg" className="flex-1" onClick={share}>
                <Share className="size-[18px]" /> Share
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-1 pb-3">
          <TextField
            aria-label="Who is this for? (optional)"
            placeholder="Who's it for? (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button
            size="lg"
            block
            loading={create.isPending}
            onClick={() => create.mutate(label.trim() || null, { onSuccess: (inv) => setInvite(inv) })}
          >
            Create invite link
          </Button>
        </div>
      )}
    </Sheet>
  )
}
