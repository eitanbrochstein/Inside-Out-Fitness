import { useState, type ReactNode } from 'react'
import { Trophy } from 'lucide-react'
import type { WorkoutDoc } from '@/data/types'
import { useExerciseMap } from '@/data/useExercises'
import { usePersonalRecords } from '@/data/useInsights'
import { useUnits } from '@/data/useProfile'
import { formatVolume } from '@/lib/format'
import { formatWeight, type Unit } from '@/lib/load'
import { formatDuration, sessionTotals, type RecordKind } from '@/lib/session'
import { Card } from '@/ui/Card'
import { cn } from '@/ui/cn'
import { SectionLabel } from '@/ui/SectionLabel'

export interface SummaryRecord {
  key: string
  exercise: string
  kind: RecordKind
  weightKg: number | null
  reps: number | null
  perHand?: boolean
}

const KIND: Record<RecordKind, string> = { weight: 'Heaviest', e1rm: 'Est. 1RM', reps: 'Most reps' }

function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-tile bg-(--glass-control) px-3 py-2.5">
      <div className="text-caption text-muted">{label}</div>
      <div className="mt-0.5 font-display text-headline font-semibold">{value}</div>
    </div>
  )
}

/** A workout in numbers: time, sets, volume, and any records set. */
export function SessionSummary({ doc, unit, records, className }: { doc: WorkoutDoc; unit: Unit; records: SummaryRecord[]; className?: string }) {
  const t = sessionTotals(doc.workout_blocks)
  // Mounted when shown, so "now" is when the summary opened.
  const [openedAt] = useState(() => Date.now())
  const end = doc.completed_at ? new Date(doc.completed_at).getTime() : openedAt
  const duration = doc.started_at ? end - new Date(doc.started_at).getTime() : null

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Time" value={duration != null ? formatDuration(duration) : '—'} />
        <Figure
          label="Sets"
          value={
            <>
              {t.setsDone}
              <span className="text-callout text-faint">/{t.setsTotal}</span>
            </>
          }
        />
        <Figure label="Volume" value={formatVolume(t.volumeKg, unit)} />
      </div>
      {records.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {records.map((r) => (
            <li key={r.key} className="flex items-center gap-3 rounded-tile bg-pr-soft px-3 py-2.5">
              <Trophy className="size-[18px] shrink-0 text-pr" />
              <span className="min-w-0 flex-1 truncate text-callout font-semibold">{r.exercise}</span>
              <span className="shrink-0 text-footnote text-muted tabular-nums">
                {KIND[r.kind]} · {r.weightKg == null ? `${r.reps} reps` : `${formatWeight(r.weightKg, unit, { perHand: r.perHand })} × ${r.reps}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** At the top of a finished workout: its numbers, and the records it set at the time. */
export function CompletedSummary({ doc }: { doc: WorkoutDoc }) {
  const { unit } = useUnits()
  const exercises = useExerciseMap()
  const records = usePersonalRecords({ ownerId: doc.owner_id, workoutId: doc.id })
  return (
    <Card className="mb-5 p-4">
      <SectionLabel className="mb-3">Session</SectionLabel>
      <SessionSummary
        doc={doc}
        unit={unit}
        records={(records.data ?? []).map((r) => {
          const exercise = exercises.get(r.exerciseId)
          return {
            key: `${r.exerciseId}:${r.kind}`,
            exercise: exercise?.name ?? 'Exercise',
            kind: r.kind,
            weightKg: r.weightKg,
            reps: r.reps,
            perHand: exercise?.load_basis === 'per_hand',
          }
        })}
      />
    </Card>
  )
}
