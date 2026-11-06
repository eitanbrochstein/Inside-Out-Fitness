import { Ellipsis } from 'lucide-react'
import type { BlockWithSets } from '@/data/types'
import { useAutosave, useDraft } from '@/lib/useAutosave'
import { AutoTextarea } from '@/ui/AutoTextarea'
import { Card } from '@/ui/Card'
import { IconButton } from '@/ui/IconButton'
import { SectionLabel } from '@/ui/SectionLabel'
import { useWorkoutPage } from './context'

export function TextBlock({ block, autoFocus }: { block: BlockWithSets; autoFocus?: boolean }) {
  const { mode } = useWorkoutPage()
  if (mode === 'edit') return <EditableTextBlock block={block} autoFocus={autoFocus} />

  if (!block.title && !block.body.trim()) return null
  // A heading with no body reads as a section label, like "STRENGTH" in the brief.
  if (!block.body.trim()) return <SectionLabel className="px-1 pt-3 pb-0.5">{block.title}</SectionLabel>
  return (
    <Card className="px-4 py-4">
      {block.title && <SectionLabel className="mb-2">{block.title}</SectionLabel>}
      <p className="text-body leading-relaxed whitespace-pre-wrap">{block.body}</p>
    </Card>
  )
}

function EditableTextBlock({ block, autoFocus }: { block: BlockWithSets; autoFocus?: boolean }) {
  const { actions, openBlockActions } = useWorkoutPage()
  const title = useDraft(block.title)
  const body = useDraft(block.body)
  const saveTitle = useAutosave((value: string) => actions.updateBlock.mutate({ id: block.id, patch: { title: value } }))
  const saveBody = useAutosave((value: string) => actions.updateBlock.mutate({ id: block.id, patch: { body: value } }))

  return (
    <Card className="px-4 pt-2 pb-4">
      <div className="flex items-center gap-1">
        <input
          aria-label="Block title"
          placeholder="TITLE"
          value={title.draft}
          onFocus={() => title.setFocused(true)}
          onBlur={() => {
            title.setFocused(false)
            saveTitle.flush()
          }}
          onChange={(e) => {
            title.setDraft(e.target.value)
            saveTitle.schedule(e.target.value)
          }}
          className="h-10 min-w-0 flex-1 bg-transparent text-body font-semibold tracking-[0.06em] text-muted uppercase outline-none"
        />
        <IconButton aria-label="Text block actions" size="md" className="-mr-2" onClick={() => openBlockActions(block)}>
          <Ellipsis className="size-5" />
        </IconButton>
      </div>
      <AutoTextarea
        aria-label="Block text"
        autoFocus={autoFocus}
        placeholder="Warm-up, cues, notes — anything."
        value={body.draft}
        onFocus={() => body.setFocused(true)}
        onBlur={() => {
          body.setFocused(false)
          saveBody.flush()
        }}
        onChange={(e) => {
          body.setDraft(e.target.value)
          saveBody.schedule(e.target.value)
        }}
        className="text-body leading-relaxed"
      />
    </Card>
  )
}
