// What an exercise block keeps in workout_blocks.settings: the superset it belongs to and how its sets
// are measured. Both ride along wherever a block is copied (saved, repeated, assigned, programs).
import type { Json } from './database.types'

/** Reps (the default), or time shown in seconds or minutes. Time is always stored in seconds. */
export type Measure = 'reps' | 'sec' | 'min'

export const MEASURES: Measure[] = ['reps', 'sec', 'min']
export const MEASURE_HEAD: Record<Measure, string> = { reps: 'Reps', sec: 'Sec', min: 'Min' }
export const MEASURE_NAME: Record<Measure, string> = { reps: 'Reps', sec: 'Seconds', min: 'Minutes' }

export interface BlockSettings {
  /** Consecutive exercise blocks sharing a group are a superset. */
  group?: string
  measure?: Measure
}

interface HasSettings {
  settings: Json
}

type JsonObject = { [key: string]: Json | undefined }
const isObject = (v: Json): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Reads settings defensively: anything unknown or malformed is ignored. */
export function blockSettings(b: HasSettings): BlockSettings {
  const s = isObject(b.settings) ? b.settings : {}
  return {
    group: typeof s.group === 'string' && s.group ? s.group : undefined,
    measure: s.measure === 'sec' || s.measure === 'min' ? s.measure : undefined,
  }
}

export const measureOf = (b: HasSettings): Measure => blockSettings(b).measure ?? 'reps'
export const isTimed = (b: HasSettings) => measureOf(b) !== 'reps'
export const groupOf = (b: HasSettings) => blockSettings(b).group ?? null

/** The block's settings with a change applied. `null` removes a key; other keys are kept. */
export function withSettings(b: HasSettings, patch: { group?: string | null; measure?: Measure | null }): JsonObject {
  const next: JsonObject = { ...(isObject(b.settings) ? b.settings : {}) }
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || (key === 'measure' && value === 'reps')) delete next[key]
    else next[key] = value
  }
  return next
}

/** A time as typed in a set field: whole seconds, or minutes to two decimals. */
export const toTimeField = (seconds: number | null, measure: Measure) =>
  seconds == null ? null : measure === 'min' ? Math.round((seconds / 60) * 100) / 100 : seconds

/** A typed time back to seconds. */
export const fromTimeField = (value: number | null, measure: Measure) =>
  value == null ? null : Math.max(0, Math.round(measure === 'min' ? value * 60 : value))

interface Groupable extends HasSettings {
  id: string
  type: string
}

export type BlockUnit<B> = { kind: 'single'; key: string; block: B } | { kind: 'group'; key: string; group: string; blocks: B[] }

/**
 * The page's blocks as it shows them: single blocks, and supersets. A superset is a run of two or more
 * consecutive exercise blocks with the same group; a group id left on one block alone is ignored.
 */
export function groupBlocks<B extends Groupable>(blocks: B[]): BlockUnit<B>[] {
  const out: BlockUnit<B>[] = []
  const used = new Set<string>()
  let run: B[] = []
  let runGroup: string | null = null

  const flush = () => {
    if (runGroup && run.length >= 2) {
      const key = used.has(runGroup) ? `group:${runGroup}:${run[0].id}` : `group:${runGroup}`
      used.add(runGroup)
      out.push({ kind: 'group', key, group: runGroup, blocks: run })
    } else {
      for (const block of run) out.push({ kind: 'single', key: block.id, block })
    }
    run = []
    runGroup = null
  }

  for (const block of blocks) {
    const group = block.type === 'exercise' ? groupOf(block) : null
    if (group && group === runGroup) {
      run.push(block)
      continue
    }
    flush()
    if (group) {
      run = [block]
      runGroup = group
    } else {
      out.push({ kind: 'single', key: block.id, block })
    }
  }
  flush()
  return out
}

/** The superset a block is in, in order, or null when it stands alone. */
export function supersetOf<B extends Groupable>(blocks: B[], blockId: string): B[] | null {
  for (const unit of groupBlocks(blocks)) {
    if (unit.kind === 'group' && unit.blocks.some((b) => b.id === blockId)) return unit.blocks
  }
  return null
}

/** Block ids in order with `id` moved (or added) directly after `afterId`. */
export function orderWithAfter(ids: string[], id: string, afterId: string) {
  const rest = ids.filter((x) => x !== id)
  const at = rest.indexOf(afterId)
  return at < 0 ? [...rest, id] : [...rest.slice(0, at + 1), id, ...rest.slice(at + 1)]
}
