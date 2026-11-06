import type { Database } from '@/lib/database.types'
import type { RoundingMode, Unit } from '@/lib/load'
import type { AccentPreference, ThemePreference } from '@/lib/theme'

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

/** theme and accent hold ids; read them through normalizeTheme and normalizeAccent, which handle old or unknown ones. */
export type Profile = Omit<Row<'profiles'>, 'unit' | 'rounding_mode' | 'theme' | 'accent'> & {
  unit: Unit
  rounding_mode: RoundingMode
  theme: ThemePreference
  accent: AccentPreference
}
export type Exercise = Row<'exercises'>
export type TrainingMax = Row<'training_maxes'>
export type MaxKind = 'one_rm' | 'training_max'
export type Workout = Row<'workouts'>
export type WorkoutStatus = 'planned' | 'in_progress' | 'completed'
export type WorkoutBlock = Row<'workout_blocks'>
export type WorkoutSet = Row<'workout_sets'>
export type SetLogRow = Database['public']['Views']['set_log']['Row']
export type ExerciseStats = Database['public']['Functions']['exercise_stats']['Returns'][number]

export type CoachClient = Row<'coach_clients'>
export type Invite = Row<'coach_invites'>
export type WorkoutComment = Row<'workout_comments'> & { author: { display_name: string | null } | null }

/** The coach who assigned a workout, embedded via workouts.assigned_by. */
type CoachRef = { coach: { display_name: string | null } | null }

export type BlockWithSets = WorkoutBlock & { exercise: Exercise | null; workout_sets: WorkoutSet[] }
export type WorkoutDoc = Workout & CoachRef & { workout_blocks: BlockWithSets[] }
export type WorkoutListItem = Workout & CoachRef & { workout_blocks: { type: string }[] }

export type Program = Row<'programs'>
/** A program day: a template on one day of the program (program_day = week * 7 + weekday, Monday = 0). */
export type ProgramDay = WorkoutListItem & { program_day: number }
export type ProgramDoc = Program & { workouts: ProgramDay[] }
export type ProgramListItem = Program & { workouts: { id: string }[] }
export type ProgramRun = Row<'program_runs'> & CoachRef

export const MAX_LABEL: Record<MaxKind, string> = { one_rm: '1RM', training_max: 'Training max' }
