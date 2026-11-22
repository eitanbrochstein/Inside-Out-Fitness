import { useWorkoutPage } from './context'
import { NoteCallout, NoteField } from './Note'

/** The note for the whole workout, at the top of the page: the session's focus, intent or reminders. */
export function WorkoutNote() {
  const { doc, mode, actions, readOnly, notesLocked, noteFrom, isTemplate, isCoach, clientFirstName } = useWorkoutPage()
  if (mode === 'train' || readOnly || notesLocked) {
    return doc.notes.trim() ? <NoteCallout text={doc.notes} from={noteFrom} className="mb-3" /> : null
  }
  const placeholder = clientFirstName
    ? `A note for ${clientFirstName}: focus, intent, reminders…`
    : isTemplate && isCoach
      ? 'A note for your clients: focus, intent, reminders…'
      : 'Workout note: focus, warm-up, reminders…'
  return (
    <NoteField
      value={doc.notes}
      onSave={(notes) => actions.updateWorkout.mutate({ notes })}
      label="Workout note"
      placeholder={placeholder}
      className="mb-3"
    />
  )
}
