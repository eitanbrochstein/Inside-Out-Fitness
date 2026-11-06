import { useNavigate } from 'react-router'
import { useCreateWorkout, type NewWorkout } from '@/data/useWorkouts'

/** Creates an empty workout (or template), dated today unless told otherwise, and opens it ready for a title. */
export function useOpenBlank(kind: 'workout' | 'template' = 'workout') {
  const navigate = useNavigate()
  const create = useCreateWorkout()
  return (options: Omit<NewWorkout, 'id' | 'kind'> = {}) => {
    const id = crypto.randomUUID()
    create.mutate({ id, kind: options.program ? 'template' : kind, ...options })
    navigate(`/w/${id}`, { viewTransition: true, state: { fresh: true } })
  }
}

/** The same for today, as a click handler. */
export function useNewWorkout(kind: 'workout' | 'template' = 'workout') {
  const openBlank = useOpenBlank(kind)
  return () => openBlank()
}
