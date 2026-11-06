// The plan calendar: days are local calendar dates (YYYY-MM-DD) and weeks start on Monday,
// like the rest of the app. Day arithmetic goes through calendar dates, never milliseconds, so a
// daylight-saving change can't shift a day.
import { parseISODate, toISODate } from './dates'

export function addDays(day: string, n: number) {
  const d = parseISODate(day)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

const utc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000)

/** 0 for Monday … 6 for Sunday. */
export const weekdayOf = (day: string) => (parseISODate(day).getDay() + 6) % 7

export const mondayOf = (day: string) => addDays(day, -weekdayOf(day))

/** The seven days of the week starting `monday`. */
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i))

/** The local calendar day of a timestamp. */
export const localDay = (iso: string) => toISODate(new Date(iso))

/** The ISO timestamp of a day's local midnight, for range queries on timestamps. */
export const localMidnight = (day: string) => parseISODate(day).toISOString()

export interface MonthDay {
  day: string
  inMonth: boolean
}

/** Whole Monday-to-Sunday weeks covering `month` (YYYY-MM): five or six rows of seven. */
export function monthGrid(month: string): MonthDay[] {
  const first = `${month}-01`
  const last = addDays(`${addMonths(month, 1)}-01`, -1)
  const start = mondayOf(first)
  const end = addDays(mondayOf(last), 6)
  return Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => {
    const day = addDays(start, i)
    return { day, inMonth: day.startsWith(month) }
  })
}

export const monthOf = (day: string) => day.slice(0, 7)

export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  return toISODate(new Date(y, m - 1 + n, 1)).slice(0, 7)
}

interface Placeable {
  status: string
  scheduled_for: string | null
  completed_at: string | null
  created_at: string
}

const STATUS_ORDER: Record<string, number> = { completed: 0, in_progress: 1, planned: 2 }

/** The day a workout sits on: the day it was finished, else the day it's planned for. */
export const dayOf = (w: Placeable) => (w.status === 'completed' && w.completed_at ? localDay(w.completed_at) : w.scheduled_for)

/** Workouts by day, for the given days only. Within a day: done first, then under way, then planned. */
export function placeOnDays<T extends Placeable>(items: T[], days: string[]): Map<string, T[]> {
  const out = new Map(days.map((d) => [d, [] as T[]]))
  for (const w of items) {
    const day = dayOf(w)
    if (day) out.get(day)?.push(w)
  }
  for (const list of out.values()) {
    list.sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || a.created_at.localeCompare(b.created_at))
  }
  return out
}

/** A planned workout whose day has passed. */
export const isMissed = (w: Placeable, today: string) => w.status === 'planned' && !!w.scheduled_for && w.scheduled_for < today

/**
 * The workout to do next, from the planned and under-way ones: one under way, else today's or the next
 * upcoming, else an unscheduled one, else the most recently missed.
 */
export function pickUpNext<T extends Placeable>(current: T[], today: string): T | undefined {
  const live = current.find((w) => w.status === 'in_progress')
  if (live) return live
  const byDate = [...current].sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? '') || a.created_at.localeCompare(b.created_at))
  return (
    byDate.find((w) => w.scheduled_for && w.scheduled_for >= today) ??
    byDate.find((w) => !w.scheduled_for) ??
    byDate.findLast((w) => w.scheduled_for)
  )
}

// ---------- programs ----------

/** Short weekday name, Monday = 0. */
export const weekdayName = (i: number) => parseISODate(addDays('2024-01-01', i)).toLocaleDateString(undefined, { weekday: 'short' })

/** "Week 2 · Wed" for a program day (week * 7 + weekday, Monday = 0). */
export const programDayLabel = (day: number) => `Week ${Math.floor(day / 7) + 1} · ${weekdayName(day % 7)}`

export interface RunProgress {
  state: 'upcoming' | 'active' | 'done'
  /** The week it's in (1-based), clamped to the run. */
  week: number
  of: number
}

/** Where a program run is on `today`: not started yet, in week n of N, or over. */
export function runProgress(run: { start_date: string; week_count: number }, today: string): RunProgress {
  const days = daysBetween(run.start_date, today)
  const week = Math.floor(days / 7) + 1
  return {
    state: days < 0 ? 'upcoming' : week > run.week_count ? 'done' : 'active',
    week: Math.min(Math.max(week, 1), run.week_count),
    of: run.week_count,
  }
}

/** The Monday a program starts on by default: today on a Monday (the week is still whole), otherwise next Monday. */
export const firstMonday = (today: string) => (weekdayOf(today) === 0 ? today : addDays(mondayOf(today), 7))
