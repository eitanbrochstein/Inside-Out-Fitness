import { describe, expect, test } from 'vitest'
import { blockRecords, formatClock, formatDuration, sessionRecords, sessionTotals, setRecordKind, setVolumeKg, type SessionSet } from './session'

const set = (position: number, weight: number | null, reps: number | null, done = true): SessionSet => ({
  id: `s${position}`,
  position,
  completed_at: done ? '2026-10-19T10:00:00Z' : null,
  actual_weight_kg: weight,
  actual_reps: reps,
})

test('setVolumeKg doubles per-hand loads and ignores bodyweight', () => {
  expect(setVolumeKg(100, 5, false)).toBe(500)
  expect(setVolumeKg(30, 10, true)).toBe(600)
  expect(setVolumeKg(null, 12, false)).toBe(0)
})

test('sessionTotals counts logged sets only', () => {
  const totals = sessionTotals([
    { type: 'text', exercise: null, workout_sets: [] },
    { type: 'exercise', exercise: { load_basis: 'total' }, workout_sets: [set(0, 100, 5), set(1, 100, 5, false)] },
    { type: 'exercise', exercise: { load_basis: 'per_hand' }, workout_sets: [set(0, 30, 10), set(1, 30, 8)] },
  ])
  expect(totals).toEqual({ setsDone: 3, setsTotal: 4, reps: 23, volumeKg: 500 + 600 + 480, exercisesDone: 1, exercisesTotal: 2 })
})

describe('setRecordKind', () => {
  const best = { weightKg: 100, e1rmKg: 116.67, reps: 5 }

  test('heavier is a weight record; more reps can be an e1RM record', () => {
    expect(setRecordKind({ weightKg: 102.5, reps: 1 }, best)).toBe('weight')
    expect(setRecordKind({ weightKg: 95, reps: 8 }, best)).toBe('e1rm')
    expect(setRecordKind({ weightKg: 100, reps: 5 }, best)).toBeNull()
  })

  test('bodyweight compares reps', () => {
    expect(setRecordKind({ weightKg: null, reps: 13 }, { weightKg: null, e1rmKg: null, reps: 12 })).toBe('reps')
    expect(setRecordKind({ weightKg: null, reps: 12 }, { weightKg: null, e1rmKg: null, reps: 12 })).toBeNull()
  })
})

describe('blockRecords', () => {
  test('each set must also beat the sets before it today', () => {
    const records = blockRecords([set(1, 105, 3), set(0, 110, 3), set(2, 100, 5, false)], { weightKg: 100, e1rmKg: 116.67, reps: 5 })
    expect([...records]).toEqual([['s0', 'weight']])
  })

  test('the first session of an exercise sets the baseline', () => {
    expect(blockRecords([set(0, 100, 5)], undefined).size).toBe(0)
  })
})

test('sessionRecords keeps the strongest record per exercise', () => {
  const blocks = [
    { type: 'exercise', exercise_id: 'bench', exercise: { load_basis: 'total' }, workout_sets: [set(0, 102.5, 3), set(1, 105, 3)] },
    { type: 'exercise', exercise_id: 'row', exercise: { load_basis: 'total' }, workout_sets: [set(0, 60, 10)] },
  ]
  const prior = { weightKg: 100, e1rmKg: 116.67, reps: 5 }
  const records = sessionRecords(blocks, (id) => (id === 'bench' ? prior : undefined))
  expect(records.map((r) => [r.block.exercise_id, r.set.id, r.kind])).toEqual([['bench', 's1', 'weight']])
})

test('formatClock and formatDuration', () => {
  expect(formatClock(245_000)).toBe('4:05')
  expect(formatClock(3_723_000)).toBe('1:02:03')
  expect(formatDuration(48 * 60_000)).toBe('48 min')
  expect(formatDuration(72 * 60_000)).toBe('1 h 12 min')
  expect(formatDuration(60 * 60_000)).toBe('1 h')
})
