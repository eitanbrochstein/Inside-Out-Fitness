import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/AuthProvider'
import { MAX_LABEL, type MaxKind } from '@/data/types'
import { useExerciseMap } from '@/data/useExercises'
import { useAddMax, useCurrentMaxes } from '@/data/useMaxes'
import { useUnits } from '@/data/useProfile'
import { formatDay, parseISODate, todayISO } from '@/lib/dates'
import { formatWeight, fromDisplay } from '@/lib/load'
import { Button } from '@/ui/Button'
import { NumberField } from '@/ui/NumberField'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { Sheet } from '@/ui/Sheet'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseId: string | null
  kind?: MaxKind
  /** Whose max: yourself by default, or a client when coaching. */
  ownerId?: string
  ownerName?: string
  /** A value to start from, in the display unit (the 1RM calculator's estimate). */
  initialValue?: number
  /** Saved with the max, e.g. where an estimate came from. */
  note?: string
}

/** Records a new 1RM or training max. Remount (via key) to reset between exercises. */
export function MaxSheet({
  open,
  onOpenChange,
  exerciseId,
  kind: initialKind = 'one_rm',
  ownerId,
  ownerName,
  initialValue,
  note,
}: Props) {
  const uid = useUserId()
  const navigate = useNavigate()
  const owner = ownerId ?? uid
  const exercise = useExerciseMap().get(exerciseId ?? '')
  const maxes = useCurrentMaxes(owner)
  const add = useAddMax()
  const { unit } = useUnits()
  const [kind, setKind] = useState<MaxKind>(initialKind)
  const [value, setValue] = useState<number | null>(initialValue ?? null)

  const current = maxes.get(exerciseId, kind)
  const perHand = exercise?.load_basis === 'per_hand'

  const save = () => {
    if (!exerciseId || value == null || value <= 0) return
    add.mutate({
      id: crypto.randomUUID(),
      owner_id: owner,
      exercise_id: exerciseId,
      kind,
      value_kg: fromDisplay(value, unit),
      recorded_on: todayISO(),
      note: note ?? null,
      created_at: new Date().toISOString(),
    })
    toast.success(`${MAX_LABEL[kind]} updated`, { description: 'Planned workouts now use the new value.' })
    setValue(null)
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={ownerName ? `${ownerName} · ${exercise?.name ?? 'Max'}` : (exercise?.name ?? 'Max')}
      description={
        ownerName
          ? `Updates ${ownerName}'s future prescriptions. Their completed workouts keep the loads they lifted.`
          : 'Changing a max updates future prescriptions. Completed workouts keep the loads you lifted.'
      }
    >
      <div className="flex flex-col gap-4 pt-1 pb-3">
        <SegmentedControl<MaxKind>
          aria-label="Max type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'one_rm', label: '1RM' },
            { value: 'training_max', label: 'Training max' },
          ]}
        />
        <div className="flex items-center justify-between text-callout">
          <span className="text-muted">Current</span>
          <span className="font-semibold tabular-nums">
            {current
              ? `${formatWeight(current.value_kg, unit, { perHand })} · ${formatDay(parseISODate(current.recorded_on), { relative: true })}`
              : 'Not set'}
          </span>
        </div>
        <label className="flex items-center gap-3">
          <NumberField
            aria-label={`New ${MAX_LABEL[kind]} in ${unit}`}
            value={value}
            onCommit={setValue}
            placeholder={`New ${MAX_LABEL[kind]}`}
            className="h-14 flex-1 text-title-2 font-bold"
            onKeyUp={(e) => {
              const v = Number((e.target as HTMLInputElement).value.replace(',', '.'))
              setValue(Number.isFinite(v) && v > 0 ? v : null)
            }}
          />
          <span className="w-16 text-headline font-semibold text-muted">{unit}{perHand && ' / hand'}</span>
        </label>
        <Button size="lg" block disabled={value == null || value <= 0} onClick={save}>
          Save {MAX_LABEL[kind]}
        </Button>
        {!ownerId && initialValue == null && exerciseId && (
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              navigate(`/tools/1rm?exercise=${exerciseId}`, { viewTransition: true })
            }}
            className="flex h-10 items-center justify-center gap-2 text-callout font-semibold text-accent-text active:opacity-60"
          >
            <Calculator className="size-4" />
            Estimate from a set
          </button>
        )}
      </div>
    </Sheet>
  )
}
