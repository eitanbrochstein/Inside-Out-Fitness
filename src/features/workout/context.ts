import { createContext, use } from 'react'
import type { BlockWithSets, ExerciseStats, MaxKind, WorkoutDoc } from '@/data/types'
import type { useCurrentMaxes } from '@/data/useMaxes'
import type { WorkoutActions } from '@/data/useWorkout'
import type { LoadContext, Rounding, Unit } from '@/lib/load'
import type { PriorBest } from '@/lib/session'
import type { SummaryMode } from '@/lib/summary'

export type Mode = 'edit' | 'train'

export interface WorkoutPageState {
  doc: WorkoutDoc
  actions: WorkoutActions
  mode: Mode
  /** A coach viewing a client's workout they can't change (not theirs to plan, or already started). */
  readOnly: boolean
  /** Templates (saved workouts) have no owner max: percent sets resolve when a copy is started or assigned. */
  isTemplate: boolean
  /** Coaches call saved workouts templates and assign them to clients. */
  isCoach: boolean
  statsHref: (exerciseId: string) => string
  summaryMode: SummaryMode
  units: { unit: Unit; rounding: Rounding }
  maxes: ReturnType<typeof useCurrentMaxes>
  stats: Map<string, ExerciseStats>
  expanded: Set<string>
  toggle: (blockId: string) => void
  openBlockActions: (block: BlockWithSets) => void
  openMaxSheet: (exerciseId: string, kind: MaxKind) => void
  /** Reps, seconds or minutes for an exercise's sets. */
  openMeasureSheet: (block: BlockWithSets) => void
  /** Picks an exercise to pair with `block`: added below its superset, or making one with it. */
  addPaired: (block: BlockWithSets) => void
  deleteBlockWithUndo: (block: BlockWithSets) => void
}

export const WorkoutPageContext = createContext<WorkoutPageState | null>(null)

export function useWorkoutPage() {
  const ctx = use(WorkoutPageContext)
  if (!ctx) throw new Error('useWorkoutPage outside WorkoutPageContext')
  return ctx
}

/** Load-math context for one exercise block. */
export function loadContextFor(state: Pick<WorkoutPageState, 'maxes' | 'units' | 'isTemplate'>, block: BlockWithSets): LoadContext {
  return {
    currentMaxKg: state.isTemplate ? null : (state.maxes.get(block.exercise_id, block.max_kind)?.value_kg ?? null),
    unit: state.units.unit,
    rounding: state.units.rounding,
  }
}

/** An exercise's best from earlier sessions, for spotting records as sets are logged. */
export function priorBest(state: Pick<WorkoutPageState, 'stats'>, exerciseId: string | null): PriorBest | undefined {
  const s = exerciseId ? state.stats.get(exerciseId) : undefined
  return s && { weightKg: s.best_weight_kg, e1rmKg: s.best_e1rm_kg, reps: s.best_reps }
}

/** Records show while training; a finished workout's come from its history instead. */
export const showsLiveRecords = (state: Pick<WorkoutPageState, 'doc' | 'isTemplate' | 'readOnly'>) =>
  state.doc.status !== 'completed' && !state.isTemplate && !state.readOnly
