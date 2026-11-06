// Pure helpers behind the dashboards: weekly totals, the activity heatmap, streaks, the muscle-group
// split, rep ranges and records. Weeks start on Monday and days are local, like the rest of the app.
import { startOfWeek, type SessionPoint } from './progress'

export interface CategoryTotals {
  sets: number
  reps: number
  volume_kg: number
}

/** One logged workout (training_summary). */
export interface SummaryRow {
  workoutId: string
  title: string
  status: string
  startedAt: string | null
  performedAt: string
  setCount: number
  repCount: number
  volumeKg: number
  categories: Record<string, CategoryTotals>
}

const DAY = 86_400_000

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Monday of the first of `weeks` weeks ending with the week containing `now`. */
const firstWeek = (weeks: number, now: Date) => addDays(startOfWeek(now), -7 * (weeks - 1))

export interface WeekTotals {
  weekStart: Date
  sessions: number
  sets: number
  volumeKg: number
}

/** Sessions, sets and volume per week, oldest first, ending with the current week. */
export function weeklyTotals(rows: SummaryRow[], weeks: number, now = new Date()): WeekTotals[] {
  const first = firstWeek(weeks, now)
  const out = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(first, 7 * i), sessions: 0, sets: 0, volumeKg: 0 }))
  for (const r of rows) {
    const i = Math.round((startOfWeek(new Date(r.performedAt)).getTime() - first.getTime()) / (7 * DAY))
    const slot = out[i]
    if (!slot) continue
    slot.sessions++
    slot.sets += r.setCount
    slot.volumeKg += r.volumeKg
  }
  return out
}

export interface DayActivity {
  day: string
  date: Date
  sessions: number
  sets: number
  volumeKg: number
  /** After today: drawn empty, never as a rest day. */
  future: boolean
}

/** Every day of `weeks` whole weeks (Monday to Sunday) ending with this one, oldest first. */
export function dailyActivity(rows: SummaryRow[], weeks: number, now = new Date()): DayActivity[] {
  const first = firstWeek(weeks, now)
  const today = dayKey(now)
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(first, i)
    const day = dayKey(date)
    return { day, date, sessions: 0, sets: 0, volumeKg: 0, future: day > today }
  })
  const byDay = new Map(days.map((d) => [d.day, d]))
  for (const r of rows) {
    const d = byDay.get(dayKey(new Date(r.performedAt)))
    if (!d) continue
    d.sessions++
    d.sets += r.setCount
    d.volumeKg += r.volumeKg
  }
  return days
}

/** Maps a value to a heatmap level 1–4 by the quartiles of the non-zero values; 0 stays 0. */
export function heatLevels(values: number[]): (value: number) => 0 | 1 | 2 | 3 | 4 {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  const [q1, q2, q3] = sorted.length ? [at(0.25), at(0.5), at(0.75)] : [0, 0, 0]
  return (v) => (v <= 0 ? 0 : v < q1 ? 1 : v < q2 ? 2 : v < q3 ? 3 : 4)
}

/** Sessions this week against the weekly goal. */
export function weekProgress(rows: SummaryRow[], goal: number, now = new Date()) {
  const done = weeklyTotals(rows, 1, now)[0].sessions
  return { done, goal, ratio: goal > 0 ? Math.min(done / goal, 1) : 0 }
}

/**
 * Weeks in a row that met the goal, counting back from last week. This week adds one once its
 * goal is met, and never breaks the streak while it's still under way. Capped by the rows' window.
 */
export function weekStreak(rows: SummaryRow[], goal: number, weeks: number, now = new Date()) {
  const totals = weeklyTotals(rows, weeks, now)
  const current = totals.at(-1)!
  let streak = current.sessions >= goal ? 1 : 0
  for (let i = totals.length - 2; i >= 0 && totals[i].sessions >= goal; i--) streak++
  return streak
}

/** Muscle groups in chart order. Core and Full body fold into Other. */
export const CATEGORY_GROUPS = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Other'] as const
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]

const groupOf = (category: string): CategoryGroup =>
  (CATEGORY_GROUPS as readonly string[]).includes(category) ? (category as CategoryGroup) : 'Other'

/** Sets per muscle group over the last `weeks` weeks, in chart order, groups with sets only. */
export function categorySplit(rows: SummaryRow[], weeks: number, now = new Date()) {
  const since = firstWeek(weeks, now).getTime()
  const sets = new Map<CategoryGroup, number>()
  for (const r of rows) {
    if (new Date(r.performedAt).getTime() < since) continue
    for (const [category, t] of Object.entries(r.categories)) {
      const g = groupOf(category)
      sets.set(g, (sets.get(g) ?? 0) + t.sets)
    }
  }
  const total = [...sets.values()].reduce((a, b) => a + b, 0)
  return CATEGORY_GROUPS.filter((g) => sets.get(g)).map((key) => ({ key, sets: sets.get(key)!, share: sets.get(key)! / total }))
}

export const REP_RANGES = [
  { label: '1–3', min: 1, max: 3 },
  { label: '4–6', min: 4, max: 6 },
  { label: '7–10', min: 7, max: 10 },
  { label: '11–15', min: 11, max: 15 },
  { label: '16+', min: 16, max: Infinity },
] as const

/** How many sets fell in each rep range. */
export function repRangeBuckets(sets: { reps: number | null }[]) {
  const counts = REP_RANGES.map((r) => ({ label: r.label, count: 0 }))
  for (const s of sets) {
    const i = REP_RANGES.findIndex((r) => s.reps != null && s.reps >= r.min && s.reps <= r.max)
    if (i >= 0) counts[i].count++
  }
  return counts
}

/** Flags sessions (oldest first) that beat every earlier one: on e1RM, or on reps for bodyweight. */
export function markPRs(points: SessionPoint[]): (SessionPoint & { pr: boolean })[] {
  let best = -Infinity
  return points.map((p, i) => {
    const value = p.topWeightKg == null ? p.topReps : (p.e1rmKg ?? -Infinity)
    const pr = i > 0 && value > best + 0.01
    best = Math.max(best, value)
    return { ...p, pr }
  })
}

/** This week against last, as a fraction (null when last week had nothing). */
export function weekDelta(values: number[]) {
  const current = values.at(-1) ?? 0
  const previous = values.at(-2) ?? 0
  return { current, previous, change: previous > 0 ? (current - previous) / previous : null }
}
