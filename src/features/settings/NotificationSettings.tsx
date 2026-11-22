import { useEffect, useState, type ReactNode } from 'react'
import { BellOff, BellRing, Check } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_PREFS, useNotificationPrefs, useUpdateNotificationPrefs } from '@/data/useNotifications'
import { disablePushHere, enablePush, pushOnHere, pushPermission, pushSupport, type PushPermission } from '@/lib/push'
import { isNative } from '@/lib/native'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Chip } from '@/ui/Chip'
import { Switch } from '@/ui/Switch'
import { TimePill } from '@/ui/TimePill'

const LEADS: { value: number; label: string }[] = [
  { value: 0, label: 'At start' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 120, label: '2 hr' },
]
const NUDGES = [3, 5, 7, 14]

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <div className="flex-1">
        <div className="text-callout font-semibold">{label}</div>
        <div className="mt-0.5 text-footnote text-muted">{hint}</div>
      </div>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  )
}

function Choices({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="px-4 py-4">
      <div className="text-callout font-semibold">{label}</div>
      {hint && <div className="mt-0.5 text-footnote text-muted">{hint}</div>}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/** Settings → Notifications: this device, then what to be told about (the same on every device). */
export function NotificationSettings({ isCoach }: { isCoach: boolean }) {
  const { data: prefs = DEFAULT_PREFS } = useNotificationPrefs()
  const update = useUpdateNotificationPrefs()

  return (
    <>
      <ThisDevice />
      <Card className="mt-3 divide-y divide-border">
        <Toggle
          label="Workout reminders"
          hint="Before a planned workout, in your time zone."
          checked={prefs.reminders}
          onChange={(reminders) => update.mutate({ reminders })}
        />
        {prefs.reminders && (
          <>
            <Choices label="Remind me" hint="For workouts planned at a time.">
              {LEADS.map((l) => (
                <Chip
                  key={l.value}
                  selected={prefs.reminder_lead_min === l.value}
                  onClick={() => update.mutate({ reminder_lead_min: l.value })}
                  className="h-10 justify-center"
                >
                  {l.value === 0 ? l.label : `${l.label} before`}
                </Chip>
              ))}
            </Choices>
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="flex-1">
                <div className="text-callout font-semibold">Workouts without a time</div>
                <div className="mt-0.5 text-footnote text-muted">One reminder on the day.</div>
              </div>
              {prefs.day_reminder_time && (
                <TimePill
                  size="md"
                  label="Reminder time"
                  clearable={false}
                  value={prefs.day_reminder_time}
                  onChange={(t) => t && update.mutate({ day_reminder_time: t })}
                />
              )}
              <Switch
                label="Workouts without a time"
                checked={!!prefs.day_reminder_time}
                onChange={(on) => update.mutate({ day_reminder_time: on ? '08:00' : null })}
              />
            </div>
          </>
        )}
        <Choices label="Nudge me when I haven't trained" hint="When nothing's planned and nothing's been done for a while. Sent at 10 AM.">
          <Chip selected={prefs.nudge_after_days == null} onClick={() => update.mutate({ nudge_after_days: null })} className="h-10 justify-center">
            Off
          </Chip>
          {NUDGES.map((d) => (
            <Chip
              key={d}
              selected={prefs.nudge_after_days === d}
              onClick={() => update.mutate({ nudge_after_days: d })}
              className="h-10 justify-center tabular-nums"
            >
              {d} days
            </Chip>
          ))}
        </Choices>
      </Card>

      <Card className="mt-3 divide-y divide-border">
        <Toggle
          label="From your coach"
          hint="A new workout or program on your plan."
          checked={prefs.coach_updates}
          onChange={(coach_updates) => update.mutate({ coach_updates })}
        />
        <Toggle
          label="Comments"
          hint={isCoach ? 'Replies on workouts, from clients or your coach.' : 'Replies on workouts from your coach.'}
          checked={prefs.comments}
          onChange={(comments) => update.mutate({ comments })}
        />
        {isCoach && (
          <Toggle
            label="Client activity"
            hint="A client finishes a workout you assigned, or joins with your invite."
            checked={prefs.client_activity}
            onChange={(client_activity) => update.mutate({ client_activity })}
          />
        )}
      </Card>
    </>
  )
}

/** Whether this phone or browser gets them, and the one place that asks for permission. */
function ThisDevice() {
  const support = pushSupport()
  const [permission, setPermission] = useState<PushPermission | null>(null)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (support !== 'native' && support !== 'web') return
    let live = true
    void Promise.all([pushPermission(), pushOnHere()]).then(([p, here]) => {
      if (!live) return
      setPermission(p)
      setOn(p === 'granted' && here)
    })
    return () => {
      live = false
    }
  }, [support])

  const turnOn = async () => {
    setBusy(true)
    try {
      const result = await enablePush()
      setPermission(result)
      setOn(result === 'granted')
      if (result === 'granted') toast.success('Notifications are on')
    } catch (e) {
      const noWorker = e instanceof Error && e.message === 'no_service_worker'
      toast.error("Couldn't turn on notifications", {
        description: noWorker ? 'They need the installed app or the live site.' : 'Check your connection and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setBusy(true)
    try {
      await disablePushHere()
      setOn(false)
    } finally {
      setBusy(false)
    }
  }

  let status: ReactNode
  let action: ReactNode = null
  if (support === 'unsupported') {
    status = "This browser can't receive notifications."
  } else if (support === 'ios-needs-install') {
    status = 'On iPhone, add Inside Out to your Home Screen first (Share → Add to Home Screen), then turn them on from there.'
  } else if (permission === 'denied') {
    status = isNative
      ? 'Blocked. Allow notifications for Inside Out in your phone’s Settings.'
      : 'Blocked. Allow notifications for this site in your browser’s settings.'
  } else if (on) {
    status = (
      <span className="flex items-center gap-1.5 text-success">
        <Check className="size-4" strokeWidth={2.6} /> On for this {isNative ? 'phone' : 'browser'}
      </span>
    )
    action = (
      <Button size="sm" variant="secondary" loading={busy} onClick={turnOff}>
        Turn off
      </Button>
    )
  } else {
    status = 'Reminders and coaching updates, even when the app is closed.'
    action = (
      <Button size="sm" loading={busy || permission == null} onClick={turnOn}>
        Turn on
      </Button>
    )
  }

  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
        {on ? <BellRing className="size-5" /> : <BellOff className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-callout font-semibold">This {isNative ? 'phone' : 'device'}</div>
        <div className="mt-0.5 text-footnote text-muted">{status}</div>
      </div>
      {action}
    </Card>
  )
}
