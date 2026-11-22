import { StickyNote } from 'lucide-react'
import { useAutosave, useDraft } from '@/lib/useAutosave'
import { AutoTextarea } from '@/ui/AutoTextarea'
import { cn } from '@/ui/cn'

/** A note to read: tinted, so form cues stand out from the sets around them. `from` names its writer. */
export function NoteCallout({ text, from, className }: { text: string; from?: string | null; className?: string }) {
  return (
    <div className={cn('flex gap-2.5 rounded-tile bg-accent-soft px-3 py-2.5', className)}>
      <StickyNote className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
      <div className="min-w-0 flex-1">
        {from && <div className="text-caption font-semibold text-accent-text">Note from {from}</div>}
        <p className="text-callout leading-snug whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  )
}

/** A note to write, saved as you type. */
export function NoteField({
  value,
  onSave,
  label,
  placeholder,
  className,
}: {
  value: string
  onSave: (value: string) => void
  label: string
  placeholder: string
  className?: string
}) {
  const { draft, setDraft, setFocused } = useDraft(value)
  const { schedule, flush } = useAutosave(onSave)
  return (
    <label className={cn('glass-field flex cursor-text gap-2.5 rounded-tile px-3 py-2.5', className)}>
      <StickyNote className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
      <AutoTextarea
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          flush()
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          schedule(e.target.value)
        }}
        className="text-callout leading-snug placeholder:text-faint"
      />
    </label>
  )
}
