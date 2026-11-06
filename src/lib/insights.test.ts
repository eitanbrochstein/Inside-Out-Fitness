import { describe, expect, test } from 'vitest'
import {
  categorySplit,
  dailyActivity,
  dayKey,
  heatLevels,
  markPRs,
  repRangeBuckets,
  weekDelta,
  weeklyTotals,
  weekProgress,
  weekStreak,
  type SummaryRow,
} from './insights'

// Monday 19 October 2026, mid-morning.
const now = new Date(2026, 9, 19, 10)

const row = (date: Date, over: Partial<SummaryRow> = {}): SummaryRow => ({
  workoutId: date.toISOString(),
  title: '',
  status: 'completed',
  startedAt: null,
  performedAt: date.toISOString(),
  setCount: 10,
  repCount: 50,
  volumeKg: 1000,
  categories: { Chest: { sets: 6, reps: 30, volume_kg: 600 }, Back: { sets: 4, reps: 20, volume_kg: 400 } },
  ...over,
})

describe('weeklyTotals', () => {
  test('buckets by Monday week, oldest first', () => {
    const rows = [row(new Date(2026, 9, 19, 8)), row(new Date(2026, 9, 18, 20)), row(new Date(2026, 9, 13))]
    const weeks = weeklyTotals(rows, 3, now)
    expect(weeks.map((w) => dayKey(w.weekStart))).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
    expect(weeks.map((w) => w.sessions)).toEqual([0, 2, 1])
    expect(weeks[1].volumeKg).toBe(2000)
    expect(weeks[1].sets).toBe(20)
  })

  test('ignores rows outside the window', () => {
    expect(weeklyTotals([row(new Date(2026, 5, 1))], 4, now).every((w) => w.sessions === 0)).toBe(true)
  })
})

describe('dailyActivity', () => {
  test('whole weeks of local days, future days flagged', () => {
    const days = dailyActivity([row(new Date(2026, 9, 19, 8)), row(new Date(2026, 9, 19, 18))], 2, now)
    expect(days).toHaveLength(14)
    expect(days[0].day).toBe('2026-10-12')
    expect(days.at(-1)!.day).toBe('2026-10-25')
    const today = days.find((d) => d.day === '2026-10-19')!
    expect(today.sessions).toBe(2)
    expect(today.future).toBe(false)
    expect(days.find((d) => d.day === '2026-10-20')!.future).toBe(true)
  })
})

test('heatLevels splits non-zero values by quartile', () => {
  const level = heatLevels([0, 4, 8, 12, 16, 0])
  expect([0, 4, 8, 12, 16].map(level)).toEqual([0, 1, 2, 3, 4])
  expect(heatLevels([])(5)).toBe(4)
})

describe('weekProgress and weekStreak', () => {
  const weeksAgo = (n: number, day = 1) => new Date(2026, 9, 19 - 7 * n + day, 9)

  test('progress caps at the goal', () => {
    const rows = [row(weeksAgo(0, 0)), row(new Date(2026, 9, 19, 9, 30))]
    expect(weekProgress(rows, 3, now)).toEqual({ done: 2, goal: 3, ratio: 2 / 3 })
    expect(weekProgress([...rows, row(weeksAgo(0, 0)), row(weeksAgo(0, 0))], 3, now).ratio).toBe(1)
  })

  test('counts back from last week; this week only adds once met', () => {
    const rows = [weeksAgo(1), weeksAgo(1, 2), weeksAgo(2), weeksAgo(2, 2), weeksAgo(4), weeksAgo(4, 2)].map((d) => row(d))
    expect(weekStreak(rows, 2, 8, now)).toBe(2)
    expect(weekStreak([...rows, row(weeksAgo(0, 0)), row(new Date(2026, 9, 19, 9))], 2, 8, now)).toBe(3)
    expect(weekStreak([], 2, 8, now)).toBe(0)
  })
})

test('categorySplit folds groups and keeps chart order', () => {
  const rows = [
    row(new Date(2026, 9, 14), { categories: { Core: { sets: 2, reps: 20, volume_kg: 0 }, Legs: { sets: 6, reps: 30, volume_kg: 900 } } }),
    row(new Date(2026, 9, 16), { categories: { 'Full body': { sets: 2, reps: 10, volume_kg: 100 } } }),
    row(new Date(2026, 6, 1), { categories: { Chest: { sets: 99, reps: 1, volume_kg: 1 } } }),
  ]
  expect(categorySplit(rows, 4, now)).toEqual([
    { key: 'Legs', sets: 6, share: 0.6 },
    { key: 'Other', sets: 4, share: 0.4 },
  ])
})

test('repRangeBuckets', () => {
  const sets = [1, 3, 5, 5, 8, 12, 20, null].map((reps) => ({ reps }))
  expect(repRangeBuckets(sets).map((b) => b.count)).toEqual([2, 2, 1, 1, 1])
})

describe('markPRs', () => {
  const point = (e1rmKg: number | null, topWeightKg: number | null = 100, topReps = 5) => ({
    workoutId: String(e1rmKg),
    date: '',
    topWeightKg,
    topReps,
    e1rmKg,
    setCount: 1,
  })

  test('the first session is a baseline; later ones must beat every earlier one', () => {
    expect(markPRs([point(110), point(105), point(115), point(115)]).map((p) => p.pr)).toEqual([false, false, true, false])
  })

  test('bodyweight sessions compare reps', () => {
    expect(markPRs([point(null, null, 10), point(null, null, 12)]).map((p) => p.pr)).toEqual([false, true])
  })
})

test('weekDelta', () => {
  expect(weekDelta([100, 200, 150])).toEqual({ current: 150, previous: 200, change: -0.25 })
  expect(weekDelta([0, 50]).change).toBeNull()
})
