import { useNavigate } from 'react-router'
import { useCreateProgram } from '@/data/usePrograms'

/** Creates an empty one-week program and opens it, ready for a title. */
export function useNewProgram() {
  const navigate = useNavigate()
  const create = useCreateProgram()
  return () => {
    const id = crypto.randomUUID()
    create.mutate(id)
    navigate(`/programs/${id}`, { viewTransition: true, state: { fresh: true } })
  }
}
