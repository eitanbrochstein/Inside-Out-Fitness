import { useMemo, useState } from 'react'
import { ChevronRight, Ellipsis, LineChart, Plus, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/AuthProvider'
import { ExercisePickerSheet } from '@/features/exercises/ExercisePickerSheet'
import { MaxSheet } from '@/features/exercises/MaxSheet'
import { AddWorkoutSheet } from '@/features/plan/AddWorkoutSheet'
import { PlanCalendar } from '@/features/plan/PlanCalendar'
import { useAddWorkout } from '@/features/plan/useAddWorkout'
import { WorkoutActionsSheet } from '@/features/workout/Sheets'
import { WorkoutRow } from '@/features/workouts/WorkoutRow'
import { MAX_LABEL, type MaxKind, type TrainingMax } from '@/data/types'
import { useClients, useEndCoaching } from '@/data/useCoaching'
import { useExerciseMap } from '@/data/useExercises'
import { useMaxes } from '@/data/useMaxes'
import { useUnits } from '@/data/useProfile'
import { useWorkoutList } from '@/data/useWorkouts'
import { formatDay, parseISODate } from '@/lib/dates'
import { formatWeight } from '@/lib/load'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { IconButton } from '@/ui/IconButton'
import { ListGroup, ListRow } from '@/ui/ListRow'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'

export function ClientPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const uid = useUserId()
  const clients = useClients()
  const client = clients.byId.get(clientId!)
  const { addOn, sheet } = useAddWorkout(clientId)
  const history = useWorkoutList('history', clientId)
  const maxes = useMaxes(clientId)
  const exercises = useExerciseMap()
  const { unit } = useUnits()
  const end = useEndCoaching()
  const [showAll, setShowAll] = useState(false)
  const [menu, setMenu] = useState(false)
  const [picking, setPicking] = useState(false)
  const [maxSheet, setMaxSheet] = useState<{ open: boolean; exerciseId: string | null; kind: MaxKind; n: number }>({
    open: false,
    exerciseId: null,
    kind: 'one_rm',
    n: 0,
  })

  // Latest max per exercise and kind, by exercise name.
  const currentMaxes = useMemo(() => {
    const seen = new Map<string, TrainingMax>()
    for (const m of maxes.data ?? []) if (!seen.has(`${m.exercise_id}:${m.kind}`)) seen.set(`${m.exercise_id}:${m.kind}`, m)
    return [...seen.values()].sort((a, b) =>
      (exercises.get(a.exercise_id)?.name ?? '').localeCompare(exercises.get(b.exercise_id)?.name ?? ''),
    )
  }, [maxes.data, exercises])

  if (clients.isPending) {
    return (
      <Page>
        <PageHeader back="/coach/clients" title={<Skeleton className="h-8 w-48 rounded-lg" />} />
      </Page>
    )
  }
  if (!client) {
    return (
      <Page>
        <PageHeader back="/coach/clients" title="Client not found" />
        <EmptyState>This person isn't connected to you anymore.</EmptyState>
      </Page>
    )
  }

  const historyRows = showAll ? history.data : history.data?.slice(0, 5)
  const openMax = (exerciseId: string, kind: MaxKind = 'one_rm') => setMaxSheet({ open: true, exerciseId, kind, n: Date.now() })

  return (
    <Page>
      <PageHeader
        back="/coach/clients"
        eyebrow="Client"
        title={client.name}
        subtitle={`Client since ${formatDay(new Date(client.since))}`}
        actions={
          <IconButton aria-label="Client actions" onClick={() => setMenu(true)}>
            <Ellipsis className="size-[22px]" />
          </IconButton>
        }
      />

      <div className="flex gap-3">
        <Button
          size="lg"
          className="flex-1 whitespace-nowrap"
          onClick={() => navigate(`/coach/assign?client=${client.id}`, { viewTransition: true })}
        >
          <Send className="size-[18px]" /> Assign
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1 whitespace-nowrap"
          onClick={() => navigate(`/coach/clients/${client.id}/progress`, { viewTransition: true })}
        >
          <LineChart className="size-[18px]" /> Progress
        </Button>
      </div>

      <SectionLabel className="mt-7 mb-2 px-1">Plan</SectionLabel>
      <PlanCalendar ownerId={client.id} onAdd={addOn} />

      <SectionLabel className="mt-7 mb-2 px-1">History</SectionLabel>
      {history.isPending ? (
        <Skeleton className="h-24" />
      ) : historyRows?.length ? (
        <div className="flex flex-col gap-3">
          {historyRows.map((w) => (
            <WorkoutRow key={w.id} w={w} />
          ))}
          {!showAll && (history.data?.length ?? 0) > 5 && (
            <Button variant="ghost" onClick={() => setShowAll(true)}>
              Show all {history.data!.length}
            </Button>
          )}
        </div>
      ) : (
        <p className="px-1 text-callout text-muted">No completed workouts yet.</p>
      )}

      <SectionLabel className="mt-7 mb-2 px-1">Maxes</SectionLabel>
      <ListGroup>
        {currentMaxes.map((m) => (
          <ListRow
            key={m.id}
            onClick={() => openMax(m.exercise_id, m.kind as MaxKind)}
            title={exercises.get(m.exercise_id)?.name ?? 'Exercise'}
            subtitle={`${MAX_LABEL[m.kind as MaxKind]} · ${formatDay(parseISODate(m.recorded_on), { relative: true })}`}
            trailing={
              <>
                <span className="text-body font-bold tabular-nums">{formatWeight(m.value_kg, unit)}</span>
                <ChevronRight className="size-[18px] shrink-0 text-faint" />
              </>
            }
          />
        ))}
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full items-center gap-2 px-4 py-3.5 text-callout font-semibold text-accent-text transition-colors active:bg-(--glass-press)"
        >
          <Plus className="size-4" strokeWidth={2.4} /> Record a max
        </button>
      </ListGroup>

      <AddWorkoutSheet {...sheet} />
      <ExercisePickerSheet open={picking} onOpenChange={setPicking} title="Record a max for…" onPick={(e) => window.setTimeout(() => openMax(e.id), 250)} />
      <MaxSheet
        key={maxSheet.n}
        open={maxSheet.open}
        onOpenChange={(open) => setMaxSheet((s) => ({ ...s, open }))}
        exerciseId={maxSheet.exerciseId}
        kind={maxSheet.kind}
        ownerId={client.id}
        ownerName={client.name}
      />
      <WorkoutActionsSheet
        open={menu}
        onOpenChange={setMenu}
        title={client.name}
        items={[]}
        destructive={{
          label: 'Remove client…',
          warning: `You'll lose access to ${client.name}'s journal. Workouts you assigned stay with them.`,
          confirm: 'Remove client',
          onConfirm: () => {
            end.mutate({ coachId: uid, clientId: client.id })
            setMenu(false)
            toast(`${client.name} removed`)
            navigate('/coach/clients', { replace: true, viewTransition: true })
          },
        }}
      />
    </Page>
  )
}
