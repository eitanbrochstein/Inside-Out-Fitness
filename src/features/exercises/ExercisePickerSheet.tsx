import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useUserId } from '@/features/auth/AuthProvider'
import type { Exercise } from '@/data/types'
import { CATEGORIES, isOwnOrLibrary, newExercise, useCreateExercise, useExercises } from '@/data/useExercises'
import { SearchField } from '@/ui/SearchField'
import { SectionLabel } from '@/ui/SectionLabel'
import { Sheet } from '@/ui/Sheet'
import { ExerciseRow } from './ExerciseRow'

export function ExercisePickerSheet({
  open,
  onOpenChange,
  onPick,
  title = 'Add exercise',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (exercise: Exercise) => void
  title?: string
}) {
  const uid = useUserId()
  const { data } = useExercises()
  const create = useCreateExercise()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const active = useMemo(() => (data ?? []).filter((e) => !e.archived_at && isOwnOrLibrary(e, uid)), [data, uid])
  const matches = query ? active.filter((e) => e.name.toLowerCase().includes(query)) : active
  const exact = active.some((e) => e.name.toLowerCase() === query)

  const pick = (e: Exercise) => {
    onPick(e)
    onOpenChange(false)
    setQ('')
  }

  const createNew = () => {
    const e = newExercise(uid, { name: q.trim(), category: 'Other', equipment: 'other', load_basis: 'total' })
    create.mutate(e)
    pick(e)
  }

  const groups = query
    ? [{ label: null, items: matches }]
    : [
        { label: 'Your exercises', items: active.filter((e) => e.owner_id) },
        ...CATEGORIES.map((c) => ({ label: c, items: active.filter((e) => !e.owner_id && e.category === c) })),
      ].filter((g) => g.items.length)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} tall>
      <div className="sticky top-0 z-10 -mx-5 bg-(--glass-panel) px-5 pb-2">
        <SearchField value={q} onChange={setQ} placeholder="Search exercises" />
      </div>
      {query && !exact && (
        <button
          type="button"
          onClick={createNew}
          className="mt-1 flex min-h-14 w-full items-center gap-3 rounded-tile px-2 text-left font-semibold text-accent-text transition-colors active:bg-(--glass-press)"
        >
          <Plus className="size-5" strokeWidth={2.4} />
          Create “{q.trim()}”
        </button>
      )}
      {groups.map((g) => (
        <section key={g.label ?? 'results'} className="mt-2">
          {g.label && <SectionLabel className="px-2 pt-3 pb-1">{g.label}</SectionLabel>}
          {g.items.map((e) => (
            <ExerciseRow key={e.id} exercise={e} onClick={() => pick(e)} className="rounded-tile px-2" />
          ))}
        </section>
      ))}
      {query && matches.length === 0 && <p className="px-2 py-6 text-center text-subhead text-muted">No matches.</p>}
      <div className="h-6 shrink-0" />
    </Sheet>
  )
}
