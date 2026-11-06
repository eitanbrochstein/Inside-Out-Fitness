import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { WorkoutListItem } from '@/data/types'
import { useProfile } from '@/data/useProfile'
import { useCopyWorkout, useTemplates } from '@/data/useWorkouts'
import { describeWorkout } from '@/features/workouts/describe'
import { useOpenBlank } from '@/features/workouts/useNewWorkout'
import { formatScheduled, lowerRelative } from '@/lib/dates'
import { ListRow } from '@/ui/ListRow'
import { SearchField } from '@/ui/SearchField'
import { SectionLabel } from '@/ui/SectionLabel'
import { Sheet, SheetAction } from '@/ui/Sheet'

// Past this many saved workouts the sheet gets a search field.
const SEARCH_AFTER = 6

export interface AddWorkoutSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The day it goes on (YYYY-MM-DD). */
  date: string
  /** Open a copied saved workout straight away, rather than staying here with a toast. */
  openAfter?: boolean
  /** Somewhere other than a calendar day (a program's day): its title, and what each choice does. */
  target?: { title: string; onBlank: () => void; onSaved: (w: WorkoutListItem) => void }
}

/** Puts a workout on a day: a blank page (which always opens), or a copy of a saved workout. */
export function AddWorkoutSheet({ open, onOpenChange, date, openAfter = false, target }: AddWorkoutSheetProps) {
  const navigate = useNavigate()
  const saved = useTemplates()
  const isCoach = useProfile().data?.is_coach ?? false
  const openBlank = useOpenBlank()
  const copy = useCopyWorkout()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const day = lowerRelative(formatScheduled(date))

  const all = saved.data ?? []
  const searchable = all.length > SEARCH_AFTER
  const matches = query ? all.filter((w) => w.title.toLowerCase().includes(query)) : all

  const close = () => {
    onOpenChange(false)
    setQ('')
  }

  const blank = () => {
    close()
    if (target) target.onBlank()
    else openBlank({ scheduledFor: date })
  }

  const fromSaved = (w: WorkoutListItem) => {
    close()
    if (target) return target.onSaved(w)
    const id = crypto.randomUUID()
    const go = () => navigate(`/w/${id}`, { viewTransition: true })
    copy.mutate(
      { source: w.id, id, scheduledFor: date },
      { onSuccess: () => (openAfter ? go() : toast(`Added to ${day}`, { action: { label: 'Open', onClick: go } })) },
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={target?.title ?? (openAfter ? 'New workout' : `Add to ${day}`)}
      description="Start from a saved workout or a blank page."
      tall={searchable}
    >
      {searchable && (
        <div className="sticky top-0 z-10 -mx-5 bg-(--glass-panel) px-5 pb-2">
          <SearchField value={q} onChange={setQ} placeholder="Search saved workouts" />
        </div>
      )}
      {!query && (
        <SheetAction icon={<Plus strokeWidth={2.4} />} onClick={blank}>
          Blank workout
        </SheetAction>
      )}
      {matches.length > 0 && (
        <section className="mt-1">
          {!query && <SectionLabel className="px-2 pt-3 pb-1">{isCoach ? 'Templates' : 'Saved workouts'}</SectionLabel>}
          {matches.map((w) => (
            <ListRow
              key={w.id}
              onClick={() => fromSaved(w)}
              className="rounded-tile px-2"
              title={<span className="font-medium">{w.title || 'Untitled workout'}</span>}
              subtitle={[w.subtitle, describeWorkout(w)].filter(Boolean).join(' · ')}
            />
          ))}
        </section>
      )}
      {query && matches.length === 0 && <p className="px-2 py-6 text-center text-subhead text-muted">No matches.</p>}
      <div className="h-4 shrink-0" />
    </Sheet>
  )
}
