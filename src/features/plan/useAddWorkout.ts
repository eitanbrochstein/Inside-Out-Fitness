import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/AuthProvider'
import { useAssignTemplate } from '@/data/useCoaching'
import { useTemplates } from '@/data/useWorkouts'
import { useOpenBlank } from '@/features/workouts/useNewWorkout'
import { formatScheduled, lowerRelative, todayISO } from '@/lib/dates'
import type { AddWorkoutSheetProps } from './AddWorkoutSheet'

/**
 * Adding a workout: a choice of saved workouts or a blank page. With nothing saved yet there's nothing
 * to choose, so a blank page opens straight away. With a client's `ownerId` it goes on their calendar,
 * assigned. Render `<AddWorkoutSheet {...sheet} />`.
 */
export function useAddWorkout(ownerId?: string) {
  const uid = useUserId()
  const navigate = useNavigate()
  const saved = useTemplates()
  const openBlank = useOpenBlank()
  const assign = useAssignTemplate()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(() => ({ date: todayISO(), openAfter: true }))
  const client = ownerId && ownerId !== uid ? ownerId : null

  /** A day of the plan: a saved workout lands there with a toast, `openAfter` opens it instead. */
  const addOn = (date: string, openAfter = false) => {
    if (!saved.data?.length) return openBlank({ scheduledFor: date, ownerId })
    setTarget({ date, openAfter })
    setOpen(true)
  }

  const day = lowerRelative(formatScheduled(target.date))
  const sheet: AddWorkoutSheetProps = {
    open,
    onOpenChange: setOpen,
    ...target,
    target: client
      ? {
          title: `Add to ${day}`,
          onBlank: () => openBlank({ scheduledFor: target.date, ownerId: client }),
          onSaved: (w) =>
            assign.mutate(
              { templateId: w.id, clientIds: [client], scheduledFor: target.date },
              {
                onSuccess: (ids) =>
                  toast(`Added ${w.title || 'workout'} to ${day}`, {
                    action: ids?.[0] ? { label: 'Open', onClick: () => navigate(`/w/${ids[0]}`, { viewTransition: true }) } : undefined,
                  }),
              },
            ),
        }
      : undefined,
  }
  return { add: () => addOn(todayISO(), true), addOn, sheet }
}
