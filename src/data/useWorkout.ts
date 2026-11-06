// The workout page: one nested query plus every block/set mutation.
// Mutations patch the cached document first (instant UI), run one at a time per workout, and
// refetch after structural changes once the queue is empty.
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import type { Database } from '@/lib/database.types'
import { LockedError, must, mustWrite, supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { BlockWithSets, Exercise, WorkoutBlock, WorkoutDoc, WorkoutSet } from './types'

type Tables = Database['public']['Tables']
export type WorkoutPatch = Tables['workouts']['Update']
export type BlockPatch = Omit<Tables['workout_blocks']['Update'], 'id' | 'workout_id' | 'owner_id'>
export type SetPatch = Omit<Tables['workout_sets']['Update'], 'id' | 'block_id' | 'owner_id'>

const DOC_SELECT =
  '*, coach:profiles!workouts_assigned_by_fkey(display_name), workout_blocks(*, exercise:exercises(*), workout_sets(*))'

const byPosition = <T extends { position: number; created_at: string }>(a: T, b: T) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at)

function normalize(doc: WorkoutDoc): WorkoutDoc {
  return {
    ...doc,
    workout_blocks: [...doc.workout_blocks]
      .sort(byPosition)
      .map((b) => ({ ...b, workout_sets: [...b.workout_sets].sort(byPosition) })),
  }
}

export const workoutQuery = (id: string) =>
  queryOptions({
    queryKey: keys.workout(id),
    queryFn: async () => {
      const doc = must(await supabase.from('workouts').select(DOC_SELECT).eq('id', id).maybeSingle())
      return doc ? normalize(doc as WorkoutDoc) : null
    },
  })

export const useWorkout = (id: string) => useQuery(workoutQuery(id))

// ---------- optimistic row builders ----------

const now = () => new Date().toISOString()

export function newBlockRow(fields: Pick<WorkoutBlock, 'workout_id' | 'owner_id' | 'position' | 'type'> & Partial<WorkoutBlock>): WorkoutBlock {
  return {
    id: crypto.randomUUID(),
    title: '',
    body: '',
    exercise_id: null,
    max_kind: 'one_rm',
    notes: '',
    settings: {},
    created_at: now(),
    updated_at: now(),
    ...fields,
  }
}

export function newSetRow(fields: Pick<WorkoutSet, 'block_id' | 'owner_id' | 'position'> & Partial<WorkoutSet>): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    target_reps: null,
    target_percent: null,
    target_weight_kg: null,
    basis_max_kg: null,
    prescribed_load_kg: null,
    actual_reps: null,
    actual_weight_kg: null,
    completed_at: null,
    created_at: now(),
    updated_at: now(),
    ...fields,
  }
}

/** A copy of a set's plan, for "+ Add Set". */
export const copyPlan = (s: WorkoutSet) => ({
  target_reps: s.target_reps,
  target_percent: s.target_percent,
  target_weight_kg: s.target_weight_kg,
})

// owner_id is sent but the database always re-derives it from the parent row.
const blockInsert = ({ exercise: _e, workout_sets: _s, ...row }: BlockWithSets) => row
const setInsert = (row: WorkoutSet) => row

// ---------- document patch helpers ----------

type Doc = WorkoutDoc
const withBlocks = (doc: Doc, f: (blocks: BlockWithSets[]) => BlockWithSets[]): Doc => ({ ...doc, workout_blocks: f(doc.workout_blocks) })
const withBlock = (doc: Doc, blockId: string, f: (b: BlockWithSets) => BlockWithSets) =>
  withBlocks(doc, (bs) => bs.map((b) => (b.id === blockId ? f(b) : b)))
const withSet = (doc: Doc, setId: string, f: (s: WorkoutSet) => WorkoutSet) =>
  withBlocks(doc, (bs) =>
    bs.map((b) => (b.workout_sets.some((s) => s.id === setId) ? { ...b, workout_sets: b.workout_sets.map((s) => (s.id === setId ? f(s) : s)) } : b)),
  )

export const allSets = (doc: Doc) => doc.workout_blocks.flatMap((b) => b.workout_sets)

// ---------- mutations ----------

interface DocContext {
  workoutId: string
  /** Called when a guarded write is refused (the client started the workout). */
  onLocked?: () => void
}

function useDocMutation<V>(
  { workoutId, onLocked }: DocContext,
  mutationFn: (v: V) => Promise<unknown>,
  patch: ((doc: Doc, v: V) => Doc) | null,
  opts: { refetch?: boolean; onSuccess?: () => void } = {},
) {
  const qc = useQueryClient()
  const key = keys.workout(workoutId)
  const mutationKey = ['workout', workoutId]
  return useMutation({
    mutationKey,
    scope: { id: `workout:${workoutId}` },
    mutationFn,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: key })
      if (patch) qc.setQueryData<Doc | null>(key, (doc) => (doc ? patch(doc, v) : doc))
    },
    onSuccess: opts.onSuccess,
    onError: (error) => {
      if (error instanceof LockedError) onLocked?.()
      qc.invalidateQueries({ queryKey: key })
    },
    onSettled: () => {
      if (opts.refetch && qc.isMutating({ mutationKey }) === 1) qc.invalidateQueries({ queryKey: key })
    },
  })
}

/**
 * Every edit to one workout. `ownerId` is whose lists refresh after a change. `guarded` is for a coach
 * editing a client's workout: the database refuses those once the client starts, and `onLocked` hears it.
 */
export function useWorkoutActions(workoutId: string, opts: { ownerId?: string; guarded?: boolean; onLocked?: () => void } = {}) {
  const qc = useQueryClient()
  const uid = useUserId()
  const owner = opts.ownerId ?? uid
  const guarded = !!opts.guarded
  const ctx: DocContext = { workoutId, onLocked: opts.onLocked }
  const refreshLists = () => qc.invalidateQueries({ queryKey: keys.workouts(owner) })
  const refreshStats = () => qc.invalidateQueries({ queryKey: keys.stats(owner) })

  const updateWorkout = useDocMutation(
    ctx,
    async (patch: WorkoutPatch) => mustWrite(await supabase.from('workouts').update(patch).eq('id', workoutId).select('id'), guarded),
    (doc, patch) => ({ ...doc, ...patch }),
    { onSuccess: refreshLists },
  )

  const addBlock = useDocMutation(
    ctx,
    async (block: BlockWithSets) => {
      mustWrite(await supabase.from('workout_blocks').insert(blockInsert(block)), guarded)
      if (block.workout_sets.length) mustWrite(await supabase.from('workout_sets').insert(block.workout_sets.map(setInsert)), guarded)
    },
    (doc, block) => withBlocks(doc, (bs) => [...bs, block].sort(byPosition)),
    { refetch: true },
  )

  const updateBlock = useDocMutation(
    ctx,
    async ({ id, patch }: { id: string; patch: BlockPatch }) =>
      mustWrite(await supabase.from('workout_blocks').update(patch).eq('id', id).select('id'), guarded),
    (doc, { id, patch }) => withBlock(doc, id, (b) => ({ ...b, ...patch })),
  )

  const changeExercise = useDocMutation(
    ctx,
    async ({ id, exercise }: { id: string; exercise: Exercise }) =>
      mustWrite(await supabase.from('workout_blocks').update({ exercise_id: exercise.id }).eq('id', id).select('id'), guarded),
    (doc, { id, exercise }) => withBlock(doc, id, (b) => ({ ...b, exercise_id: exercise.id, exercise })),
  )

  const deleteBlock = useDocMutation(
    ctx,
    async (block: BlockWithSets) => mustWrite(await supabase.from('workout_blocks').delete().eq('id', block.id).select('id'), guarded),
    (doc, block) => withBlocks(doc, (bs) => bs.filter((b) => b.id !== block.id)),
  )

  const duplicateBlock = useDocMutation(
    ctx,
    async ({ source, copy }: { source: BlockWithSets; copy: BlockWithSets }) =>
      mustWrite(
        await supabase.rpc('duplicate_block', {
          p_block: source.id,
          p_new_id: copy.id,
          p_set_ids: copy.workout_sets.map((s) => s.id),
        }),
        guarded,
      ),
    (doc, { source, copy }) =>
      withBlocks(doc, (bs) =>
        [...bs.map((b) => (b.position > source.position ? { ...b, position: b.position + 1 } : b)), copy].sort(byPosition),
      ),
    { refetch: true },
  )

  const reorderBlocks = useDocMutation(
    ctx,
    async (ids: string[]) => must(await supabase.rpc('reorder_blocks', { p_workout: workoutId, p_ids: ids })),
    (doc, ids) =>
      withBlocks(doc, (bs) =>
        ids.flatMap((id, position) => {
          const b = bs.find((x) => x.id === id)
          return b ? [{ ...b, position }] : []
        }),
      ),
  )

  const addSet = useDocMutation(
    ctx,
    async (set: WorkoutSet) => mustWrite(await supabase.from('workout_sets').insert(setInsert(set)), guarded),
    (doc, set) => withBlock(doc, set.block_id, (b) => ({ ...b, workout_sets: [...b.workout_sets, set].sort(byPosition) })),
  )

  const updateSet = useDocMutation(
    ctx,
    async ({ id, patch }: { id: string; patch: SetPatch }) =>
      mustWrite(await supabase.from('workout_sets').update(patch).eq('id', id).select('id'), guarded),
    (doc, { id, patch }) => withSet(doc, id, (s) => ({ ...s, ...patch })),
  )

  const deleteSet = useDocMutation(
    ctx,
    async (set: WorkoutSet) => mustWrite(await supabase.from('workout_sets').delete().eq('id', set.id).select('id'), guarded),
    (doc, set) => withBlock(doc, set.block_id, (b) => ({ ...b, workout_sets: b.workout_sets.filter((s) => s.id !== set.id) })),
  )

  const finishWorkout = useDocMutation(
    ctx,
    async (freezes: { id: string; basis_max_kg: number; prescribed_load_kg: number }[]) =>
      must(await supabase.rpc('finish_workout', { p_workout: workoutId, p_freezes: freezes })),
    (doc, freezes) => {
      const frozen = new Map(freezes.map((f) => [f.id, f]))
      const patched = withBlocks(doc, (bs) =>
        bs.map((b) => ({ ...b, workout_sets: b.workout_sets.map((s) => ({ ...s, ...frozen.get(s.id) })) })),
      )
      return { ...patched, status: 'completed', completed_at: doc.completed_at ?? now(), started_at: doc.started_at ?? now() }
    },
    {
      refetch: true,
      onSuccess: () => {
        refreshLists()
        refreshStats()
      },
    },
  )

  return {
    updateWorkout,
    addBlock,
    updateBlock,
    changeExercise,
    deleteBlock,
    /** Re-inserts a deleted block with its original ids, position and sets. */
    restoreBlock: addBlock,
    duplicateBlock,
    reorderBlocks,
    addSet,
    updateSet,
    deleteSet,
    restoreSet: addSet,
    finishWorkout,
    uid,
  }
}

export type WorkoutActions = ReturnType<typeof useWorkoutActions>

/** A copy of a block with fresh ids, placed directly below it. */
export function duplicateOf(block: BlockWithSets): BlockWithSets {
  const id = crypto.randomUUID()
  return {
    ...newBlockRow({ ...block, id, position: block.position + 1 }),
    exercise: block.exercise,
    workout_sets: block.workout_sets.map((s) =>
      newSetRow({ block_id: id, owner_id: s.owner_id, position: s.position, ...copyPlan(s) }),
    ),
  }
}
