import { Activity, ClipboardList, Plus, Send, Users } from 'lucide-react'
import { useNewWorkout } from '@/features/workouts/useNewWorkout'
import { useClientActivity, useClients } from '@/data/useCoaching'
import { usePrograms } from '@/data/usePrograms'
import { useTemplates } from '@/data/useWorkouts'
import { plural } from '@/lib/format'
import { startOfWeek } from '@/lib/progress'
import { Button } from '@/ui/Button'
import { NavTiles } from '@/ui/NavTiles'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { ModeSwitch } from './ModeSwitch'

export function CoachHomePage() {
  const clients = useClients()
  const templates = useTemplates()
  const programs = usePrograms()
  const activity = useClientActivity((clients.data ?? []).map((c) => c.id))
  const newTemplate = useNewWorkout('template')

  const weekStart = startOfWeek(new Date())
  const thisWeek = activity.data?.filter((w) => w.completed_at && new Date(w.completed_at) >= weekStart).length

  return (
    <Page>
      <PageHeader hero title="Coaching" subtitle={<ModeSwitch value="coaching" />} />

      <NavTiles
        items={[
          {
            to: '/coach/clients',
            title: 'Clients',
            icon: Users,
            sub: clients.data && (clients.data.length ? plural(clients.data.length, 'active client') : 'Invite your first'),
          },
          {
            to: '/coach/templates',
            title: 'Templates',
            icon: ClipboardList,
            sub:
              templates.data &&
              programs.data &&
              (templates.data.length || programs.data.length
                ? [plural(templates.data.length, 'template'), programs.data.length ? plural(programs.data.length, 'program') : null].filter(Boolean).join(' · ')
                : 'Write once, reuse'),
          },
          { to: '/coach/assign', title: 'Assign', icon: Send, sub: 'Send to clients' },
          {
            to: '/coach/activity',
            title: 'Activity',
            icon: Activity,
            sub: clients.data?.length === 0 ? 'Sessions show up here' : thisWeek == null ? null : `${plural(thisWeek, 'session')} this week`,
          },
        ]}
      />

      <Button size="lg" block className="mt-6" onClick={newTemplate}>
        <Plus className="size-5" strokeWidth={2.4} />
        New Template
      </Button>
    </Page>
  )
}
