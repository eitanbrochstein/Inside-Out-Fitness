import { useState, type ReactNode } from 'react'
import { LogOut, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useCoaches, useEndCoaching } from '@/data/useCoaching'
import { useUpdateProfile, useProfile } from '@/data/useProfile'
import { defaultIncrement, type RoundingMode, type Unit } from '@/lib/load'
import { supabase } from '@/lib/supabase'
import { useDraft } from '@/lib/useAutosave'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Chip } from '@/ui/Chip'
import { IconButton } from '@/ui/IconButton'
import { ListRow } from '@/ui/ListRow'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { Switch } from '@/ui/Switch'
import { TextField } from '@/ui/TextField'
import { useAuth, useUserId } from '../auth/AuthProvider'
import { AppearanceSettings } from './AppearanceSettings'

const INCREMENTS: Record<Unit, number[]> = { lb: [1, 2.5, 5, 10], kg: [0.5, 1, 1.25, 2.5, 5] }

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="px-4 py-4">
      <div className="text-callout font-semibold">{label}</div>
      {hint && <div className="mt-0.5 text-footnote text-muted">{hint}</div>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()

  if (!profile) return null

  return (
    <Page>
      <PageHeader back eyebrow="Settings" title="Preferences" subtitle={session?.user.email} />

      <SectionLabel className="mb-2 px-1">Profile</SectionLabel>
      <Card>
        <Row label="Name" hint="Shown to your coach or clients.">
          <NameField value={profile.display_name ?? ''} onSave={(display_name) => update.mutate({ display_name })} />
        </Row>
      </Card>

      <SectionLabel className="mt-7 mb-2 px-1">Training</SectionLabel>
      <Card>
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="flex-1">
            <div className="text-callout font-semibold">Weekly goal</div>
            <div className="mt-0.5 text-footnote text-muted">Sessions a week. Home tracks it and your streak.</div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              aria-label="Fewer sessions"
              variant="glass"
              size="sm"
              disabled={profile.weekly_goal <= 1}
              onClick={() => update.mutate({ weekly_goal: profile.weekly_goal - 1 })}
            >
              <Minus className="size-4" strokeWidth={2.4} />
            </IconButton>
            <span className="w-7 text-center font-display text-title-3 font-semibold tabular-nums" aria-live="polite">
              {profile.weekly_goal}
            </span>
            <IconButton
              aria-label="More sessions"
              variant="glass"
              size="sm"
              disabled={profile.weekly_goal >= 14}
              onClick={() => update.mutate({ weekly_goal: profile.weekly_goal + 1 })}
            >
              <Plus className="size-4" strokeWidth={2.4} />
            </IconButton>
          </div>
        </div>
      </Card>

      <SectionLabel className="mt-7 mb-2 px-1">Loading</SectionLabel>
      <Card className="divide-y divide-border">
        <Row label="Units" hint="Weights are stored precisely, so you can switch any time.">
          <SegmentedControl<Unit>
            aria-label="Units"
            value={profile.unit}
            onChange={(unit) => update.mutate({ unit, rounding_increment: defaultIncrement(unit) })}
            options={[
              { value: 'lb', label: 'Pounds (lb)' },
              { value: 'kg', label: 'Kilograms (kg)' },
            ]}
          />
        </Row>
        <Row label="Round percentage loads to" hint="Matches the smallest plates you have.">
          <div className="flex flex-wrap gap-2">
            {INCREMENTS[profile.unit].map((inc) => (
              <Chip
                key={inc}
                selected={profile.rounding_increment === inc}
                onClick={() => update.mutate({ rounding_increment: inc })}
                className="h-10 min-w-16 justify-center tabular-nums"
              >
                {inc} {profile.unit}
              </Chip>
            ))}
          </div>
        </Row>
        <Row label="Rounding">
          <SegmentedControl<RoundingMode>
            aria-label="Rounding"
            value={profile.rounding_mode}
            onChange={(rounding_mode) => update.mutate({ rounding_mode })}
            options={[
              { value: 'nearest', label: 'Nearest' },
              { value: 'down', label: 'Round down' },
            ]}
          />
        </Row>
      </Card>

      <SectionLabel className="mt-7 mb-2 px-1">Appearance</SectionLabel>
      <AppearanceSettings profile={profile} />

      <SectionLabel className="mt-7 mb-2 px-1">Coaching</SectionLabel>
      <Card className="divide-y divide-border overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="flex-1">
            <div className="text-callout font-semibold">Coaching tools</div>
            <div className="mt-0.5 text-footnote text-muted">Invite clients, write templates and assign workouts.</div>
          </div>
          <Switch
            label="Coaching tools"
            checked={profile.is_coach}
            onChange={(is_coach) => {
              update.mutate({ is_coach })
              if (is_coach) toast.success('Coaching is on', { description: 'Switch modes from the top of Home.' })
            }}
          />
        </div>
        {profile.is_coach && <ListRow to="/coach" title={<span className="text-accent-text">Open coaching</span>} trailing="chevron" />}
        <ListRow to="/join" title={<span className="text-accent-text">Join a coach with a code</span>} trailing="chevron" />
      </Card>

      <YourCoaches />

      <Button variant="danger-soft" size="lg" block className="mt-8" onClick={() => supabase.auth.signOut()}>
        <LogOut className="size-5" />
        Sign out
      </Button>
    </Page>
  )
}

function NameField({ value, onSave }: { value: string; onSave: (name: string) => void }) {
  const { draft, setDraft, setFocused } = useDraft(value)
  return (
    <TextField
      aria-label="Name"
      value={draft}
      placeholder="Your name"
      autoComplete="name"
      enterKeyHint="done"
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onBlur={() => {
        setFocused(false)
        const name = draft.trim()
        if (name && name !== value) onSave(name)
        else setDraft(value)
      }}
    />
  )
}

/** Clients see who coaches them and can leave. */
function YourCoaches() {
  const uid = useUserId()
  const { data: coaches } = useCoaches()
  const end = useEndCoaching()
  const [confirming, setConfirming] = useState<string | null>(null)
  if (!coaches?.length) return null

  return (
    <>
      <SectionLabel className="mt-7 mb-2 px-1">Your coach</SectionLabel>
      <Card className="divide-y divide-border">
        {coaches.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-3 pr-3 pl-4">
            <Avatar name={c.name} className="size-9 text-footnote" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-callout font-semibold">{c.name}</div>
              <div className="text-footnote text-muted">Can see your training and assign workouts</div>
            </div>
            <Button
              size="sm"
              variant={confirming === c.id ? 'danger' : 'secondary'}
              onClick={() => {
                if (confirming !== c.id) return setConfirming(c.id)
                end.mutate({ coachId: c.id, clientId: uid })
                setConfirming(null)
                toast(`You left ${c.name}`)
              }}
            >
              {confirming === c.id ? 'Confirm' : 'Leave'}
            </Button>
          </div>
        ))}
      </Card>
    </>
  )
}
