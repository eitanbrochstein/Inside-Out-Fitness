import { useMemo, useState } from 'react'
import { Plus, SearchX } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useUserId } from '@/features/auth/AuthProvider'
import type { Exercise } from '@/data/types'
import { CATEGORIES, EQUIPMENT, equipmentLabel, isOwnOrLibrary, newExercise, useCreateExercise, useExercises } from '@/data/useExercises'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { EmptyState } from '@/ui/EmptyState'
import { IconButton } from '@/ui/IconButton'
import { ListGroup } from '@/ui/ListRow'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SearchField } from '@/ui/SearchField'
import { SectionLabel } from '@/ui/SectionLabel'
import { Sheet } from '@/ui/Sheet'
import { Skeleton } from '@/ui/Skeleton'
import { Switch } from '@/ui/Switch'
import { TextField } from '@/ui/TextField'
import { ExerciseRow } from './ExerciseRow'

export function ExercisesPage() {
  const uid = useUserId()
  const navigate = useNavigate()
  const { data, isPending } = useExercises()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const query = q.trim().toLowerCase()
  const visible = useMemo(
    () =>
      (data ?? []).filter(
        (e) =>
          !e.archived_at &&
          isOwnOrLibrary(e, uid) &&
          (!category || e.category === category) &&
          (!query || e.name.toLowerCase().includes(query)),
      ),
    [data, category, query, uid],
  )
  const groups = [
    { label: 'Your exercises', items: visible.filter((e) => e.owner_id) },
    ...CATEGORIES.map((c) => ({ label: c, items: visible.filter((e) => !e.owner_id && e.category === c) })),
  ].filter((g) => g.items.length)

  return (
    <Page>
      <PageHeader
        back="/"
        eyebrow="Exercise Database"
        title="Exercises"
        subtitle="Maxes, records and history"
        actions={
          <IconButton aria-label="New exercise" variant="accent" size="md" onClick={() => setCreating(true)}>
            <Plus className="size-5" strokeWidth={2.4} />
          </IconButton>
        }
      />

      <SearchField value={q} onChange={setQ} placeholder="Search exercises" />
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        <Chip selected={!category} onClick={() => setCategory(null)}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} onClick={() => setCategory(category === c ? null : c)}>
            {c}
          </Chip>
        ))}
      </div>

      {isPending ? (
        <Skeleton className="mt-5 h-96" />
      ) : groups.length ? (
        groups.map((g) => (
          <section key={g.label} className="mt-5">
            <SectionLabel className="mb-2 px-1">{g.label}</SectionLabel>
            <ListGroup>
              {g.items.map((e) => (
                <ExerciseRow key={e.id} exercise={e} onClick={() => navigate(`/exercises/${e.id}`, { viewTransition: true })} />
              ))}
            </ListGroup>
          </section>
        ))
      ) : (
        <div className="mt-5">
          <EmptyState icon={<SearchX />} title="No matches">
            Try another name, or add it as a new exercise.
          </EmptyState>
        </div>
      )}

      <NewExerciseSheet
        open={creating}
        onOpenChange={setCreating}
        initialName={q}
        onCreated={(e) => navigate(`/exercises/${e.id}`, { viewTransition: true })}
      />
    </Page>
  )
}

function NewExerciseSheet({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  onCreated: (e: Exercise) => void
}) {
  const uid = useUserId()
  const create = useCreateExercise()
  const { data } = useExercises()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('Other')
  const [equipment, setEquipment] = useState<string>('barbell')
  const [perHand, setPerHand] = useState(false)

  const trimmed = name.trim()
  const taken = (data ?? []).some((e) => e.name.toLowerCase() === trimmed.toLowerCase())

  const save = () => {
    const e = newExercise(uid, { name: trimmed, category, equipment, load_basis: perHand ? 'per_hand' : 'total' })
    create.mutate(e)
    onOpenChange(false)
    onCreated(e)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setName(initialName)
        onOpenChange(o)
      }}
      title="New exercise"
    >
      <div className="flex flex-col gap-5 pb-3">
        <TextField
          aria-label="Exercise name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={taken ? <span className="text-warn">An exercise with this name already exists.</span> : undefined}
        />
        <div>
          <SectionLabel className="mb-2">Category</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel className="mb-2">Equipment</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((eq) => (
              <Chip key={eq} selected={equipment === eq} onClick={() => setEquipment(eq)}>
                {equipmentLabel(eq)}
              </Chip>
            ))}
          </div>
        </div>
        {(equipment === 'dumbbell' || equipment === 'kettlebell') && (
          <div className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-callout font-semibold">Log weight per hand</span>
              <span className="block text-footnote text-muted">For pairs of dumbbells, e.g. 2 × 30 lb.</span>
            </span>
            <Switch label="Log weight per hand" checked={perHand} onChange={setPerHand} />
          </div>
        )}
        <Button size="lg" block disabled={!trimmed || taken} onClick={save}>
          Create exercise
        </Button>
      </div>
    </Sheet>
  )
}
