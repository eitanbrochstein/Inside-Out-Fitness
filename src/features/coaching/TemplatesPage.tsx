import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Library, NewInLibrarySheet } from '@/features/library/Library'
import { IconButton } from '@/ui/IconButton'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'

export function TemplatesPage() {
  const [adding, setAdding] = useState(false)

  return (
    <Page>
      <PageHeader
        title="Templates"
        subtitle="Write a workout or a program once, assign it to anyone"
        actions={
          <IconButton aria-label="New template or program" variant="accent" size="md" onClick={() => setAdding(true)}>
            <Plus className="size-5" strokeWidth={2.4} />
          </IconButton>
        }
      />
      <Library audience="coach" />
      <NewInLibrarySheet open={adding} onOpenChange={setAdding} audience="coach" />
    </Page>
  )
}
