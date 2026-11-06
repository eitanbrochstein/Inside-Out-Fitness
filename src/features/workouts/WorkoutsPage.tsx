import { useState } from 'react'
import { History, Plus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useWorkoutList } from '@/data/useWorkouts'
import { Library, NewInLibrarySheet } from '@/features/library/Library'
import { AddWorkoutSheet } from '@/features/plan/AddWorkoutSheet'
import { PlanCalendar } from '@/features/plan/PlanCalendar'
import { useAddWorkout } from '@/features/plan/useAddWorkout'
import { EmptyState } from '@/ui/EmptyState'
import { IconButton } from '@/ui/IconButton'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { riseDelay } from '@/ui/motion'
import { Skeleton } from '@/ui/Skeleton'
import { WorkoutRow } from './WorkoutRow'

type Scope = 'plan' | 'history' | 'saved'

const PATHS: Record<Scope, string> = { plan: '/workouts', history: '/workouts/history', saved: '/workouts/saved' }

export function WorkoutsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const scope: Scope = location.pathname.endsWith('/history') ? 'history' : location.pathname.endsWith('/saved') ? 'saved' : 'plan'
  const { add, addOn, sheet } = useAddWorkout()
  const [addingSaved, setAddingSaved] = useState(false)

  return (
    <Page>
      <PageHeader
        title="Workouts"
        actions={
          scope === 'saved' ? (
            <IconButton aria-label="New saved workout or program" variant="accent" size="md" onClick={() => setAddingSaved(true)}>
              <Plus className="size-5" strokeWidth={2.4} />
            </IconButton>
          ) : (
            <IconButton aria-label="New workout" variant="accent" size="md" onClick={add}>
              <Plus className="size-5" strokeWidth={2.4} />
            </IconButton>
          )
        }
      />
      <SegmentedControl
        aria-label="Workout list"
        className="mb-5"
        value={scope}
        onChange={(s) => navigate(PATHS[s], { replace: true })}
        options={[
          { value: 'plan', label: 'Plan' },
          { value: 'history', label: 'History' },
          { value: 'saved', label: 'Saved' },
        ]}
      />

      {scope === 'plan' ? (
        <PlanCalendar onAdd={addOn} />
      ) : scope === 'saved' ? (
        <Library audience="personal" />
      ) : (
        <HistoryList />
      )}
      <AddWorkoutSheet {...sheet} />
      <NewInLibrarySheet open={addingSaved} onOpenChange={setAddingSaved} audience="personal" />
    </Page>
  )
}

function HistoryList() {
  const list = useWorkoutList('history')

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
    )
  }

  if (list.data?.length) {
    return (
      <div className="flex flex-col gap-3">
        {list.data.map((w, i) => (
          <div key={w.id} className="animate-rise" style={riseDelay(i)}>
            <WorkoutRow w={w} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <EmptyState icon={<History />} title="No history yet">
      Completed workouts show up here.
    </EmptyState>
  )
}
