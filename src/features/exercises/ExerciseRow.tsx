import type { Exercise } from '@/data/types'
import { equipmentLabel } from '@/data/useExercises'
import { useCurrentMaxes } from '@/data/useMaxes'
import { useUnits } from '@/data/useProfile'
import { formatWeight } from '@/lib/load'
import { ListRow } from '@/ui/ListRow'

export function ExerciseRow({ exercise, onClick, className }: { exercise: Exercise; onClick: () => void; className?: string }) {
  const maxes = useCurrentMaxes()
  const { unit } = useUnits()
  const max = maxes.get(exercise.id, 'one_rm')
  return (
    <ListRow
      onClick={onClick}
      className={className}
      title={<span className="font-medium">{exercise.name}</span>}
      subtitle={
        <>
          {equipmentLabel(exercise.equipment)}
          {exercise.load_basis === 'per_hand' && ' · per hand'}
          {max && ` · 1RM ${formatWeight(max.value_kg, unit)}`}
          {exercise.owner_id && ' · Custom'}
        </>
      }
    />
  )
}
