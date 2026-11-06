import { Activity } from 'lucide-react'
import { useClientActivity, useClients } from '@/data/useCoaching'
import { formatTimestamp } from '@/lib/dates'
import { Avatar } from '@/ui/Avatar'
import { EmptyState } from '@/ui/EmptyState'
import { ListGroup, ListRow } from '@/ui/ListRow'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'

export function ActivityPage() {
  const clients = useClients()
  const activity = useClientActivity((clients.data ?? []).map((c) => c.id))

  return (
    <Page>
      <PageHeader back="/coach" eyebrow="Coaching" title="Client Activity" subtitle="Recently completed sessions" />
      {clients.isPending || (clients.data?.length && activity.isPending) ? (
        <Skeleton className="h-64" />
      ) : activity.data?.length ? (
        <ListGroup>
          {activity.data.map((w) => {
            const name = clients.byId.get(w.owner_id)?.name ?? 'Client'
            return (
              <ListRow
                key={w.id}
                to={`/w/${w.id}`}
                leading={<Avatar name={name} />}
                title={name}
                subtitle={w.title || 'Untitled workout'}
                meta={formatTimestamp(w.completed_at!)}
                trailing="chevron"
              />
            )
          })}
        </ListGroup>
      ) : (
        <EmptyState icon={<Activity />} title="No sessions yet">
          Completed client sessions show up here.
        </EmptyState>
      )}
    </Page>
  )
}
