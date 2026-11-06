import { describe, expect, test } from 'vitest'
import {
  addDays,
  addMonths,
  daysBetween,
  dayOf,
  firstMonday,
  isMissed,
  localDay,
  localMidnight,
  mondayOf,
  monthGrid,
  pickUpNext,
  placeOnDays,
  programDayLabel,
  runProgress,
  weekDays,
  weekdayOf,
} from './calendar'

const w = (over: Partial<{ id: string; status: string; scheduled_for: string | null; completed_at: string | null; created_at: string }>) => ({
  id: 'w',
  status: 'planned',
  scheduled_for: null,
  completed_at: null,
  created_at: '2026-10-01T00:00:00.000Z',
  ...over,
})

describe('days and weeks', () => {
  test('mondayOf for a Sunday, a Monday and a Saturday', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26')
    expect(mondayOf('2026-10-26')).toBe('2026-10-26')
    expect(mondayOf('2026-10-31')).toBe('2026-10-26')
    expect(weekdayOf('2026-11-01')).toBe(6)
  })

  test('a week across the daylight-saving change has seven consecutive days', () => {
    // US clocks go back on Sunday 1 November 2026; Europe's went back on 25 October.
    expect(weekDays('2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(daysBetween('2026-11-02', '2026-10-26')).toBe(-7)
  })

  test('adds across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addMonths('2026-11', 1)).toBe('2026-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  test('local days and midnights round-trip', () => {
    expect(localDay(localMidnight('2026-11-01'))).toBe('2026-11-01')
    expect(localDay(new Date(2026, 9, 31, 23, 59).toISOString())).toBe('2026-10-31')
  })
})

describe('monthGrid', () => {
  test('November 2026 starts on Monday 26 October and covers whole weeks', () => {
    const grid = monthGrid('2026-11')
    expect(grid[0]).toEqual({ day: '2026-10-26', inMonth: false })
    expect(grid.length % 7).toBe(0)
    expect(grid.at(-1)?.day).toBe('2026-12-06')
    expect(grid.filter((d) => d.inMonth)).toHaveLength(30)
  })

  test('a month starting on a Monday has no leading days', () => {
    expect(monthGrid('2027-02')[0]).toEqual({ day: '2027-02-01', inMonth: true })
    expect(monthGrid('2027-02')).toHaveLength(28)
  })
})

describe('placeOnDays', () => {
  const days = weekDays('2026-10-26')

  test('planned by their date, completed by the day they were finished', () => {
    const planned = w({ id: 'p', scheduled_for: '2026-10-28' })
    const late = w({ id: 'c', status: 'completed', scheduled_for: '2026-10-27', completed_at: new Date(2026, 9, 29, 18).toISOString() })
    const placed = placeOnDays([planned, late], days)
    expect(placed.get('2026-10-28')?.map((x) => x.id)).toEqual(['p'])
    expect(placed.get('2026-10-27')).toEqual([])
    expect(placed.get('2026-10-29')?.map((x) => x.id)).toEqual(['c'])
  })

  test('drops undated and out-of-range workouts', () => {
    const placed = placeOnDays([w({ id: 'u' }), w({ id: 'next', scheduled_for: '2026-11-02' })], days)
    expect([...placed.values()].flat()).toEqual([])
  })

  test('within a day: done, then under way, then planned, then by creation', () => {
    const day = '2026-10-30'
    const items = [
      w({ id: 'p2', scheduled_for: day, created_at: '2026-10-02T00:00:00.000Z' }),
      w({ id: 'p1', scheduled_for: day, created_at: '2026-10-01T00:00:00.000Z' }),
      w({ id: 'live', status: 'in_progress', scheduled_for: day }),
      w({ id: 'done', status: 'completed', scheduled_for: day, completed_at: new Date(2026, 9, 30, 9).toISOString() }),
    ]
    expect(placeOnDays(items, days).get(day)?.map((x) => x.id)).toEqual(['done', 'live', 'p1', 'p2'])
  })

  test('dayOf falls back to the planned date', () => {
    expect(dayOf(w({ status: 'completed', scheduled_for: '2026-10-28' }))).toBe('2026-10-28')
    expect(dayOf(w({}))).toBeNull()
  })
})

describe('pickUpNext', () => {
  const today = '2026-10-31'
  const missed = w({ id: 'missed', scheduled_for: '2026-10-22' })
  const older = w({ id: 'older', scheduled_for: '2026-10-19' })
  const todays = w({ id: 'today', scheduled_for: today })
  const tomorrow = w({ id: 'tomorrow', scheduled_for: '2026-11-01' })
  const undated = w({ id: 'undated' })

  test('a workout under way comes first', () => {
    expect(pickUpNext([todays, w({ id: 'live', status: 'in_progress', scheduled_for: '2026-10-20' })], today)?.id).toBe('live')
  })

  test("today's beats a missed one, and the next upcoming beats an undated one", () => {
    expect(pickUpNext([missed, tomorrow, todays], today)?.id).toBe('today')
    expect(pickUpNext([undated, missed, tomorrow], today)?.id).toBe('tomorrow')
  })

  test('then undated, then the most recently missed', () => {
    expect(pickUpNext([missed, undated], today)?.id).toBe('undated')
    expect(pickUpNext([older, missed], today)?.id).toBe('missed')
    expect(pickUpNext([], today)).toBeUndefined()
  })

  test('isMissed is for planned workouts before today only', () => {
    expect(isMissed(missed, today)).toBe(true)
    expect(isMissed(todays, today)).toBe(false)
    expect(isMissed(w({ status: 'in_progress', scheduled_for: '2026-10-22' }), today)).toBe(false)
    expect(isMissed(undated, today)).toBe(false)
  })
})

describe('programs', () => {
  test('a program starts today on a Monday, otherwise next Monday', () => {
    expect(firstMonday('2026-11-02')).toBe('2026-11-02')
    expect(firstMonday('2026-11-01')).toBe('2026-11-02')
    expect(firstMonday('2026-11-04')).toBe('2026-11-09')
  })

  test('program days read as week and weekday', () => {
    expect(programDayLabel(0)).toBe('Week 1 · Mon')
    expect(programDayLabel(9)).toBe('Week 2 · Wed')
    expect(programDayLabel(363)).toBe('Week 52 · Sun')
  })

  test('a run is upcoming, then in week n of N, then over', () => {
    const run = { start_date: '2026-11-02', week_count: 4 }
    expect(runProgress(run, '2026-11-01')).toEqual({ state: 'upcoming', week: 1, of: 4 })
    expect(runProgress(run, '2026-11-02')).toEqual({ state: 'active', week: 1, of: 4 })
    expect(runProgress(run, '2026-11-15')).toEqual({ state: 'active', week: 2, of: 4 })
    expect(runProgress(run, '2026-11-29')).toEqual({ state: 'active', week: 4, of: 4 })
    expect(runProgress(run, '2026-11-30')).toEqual({ state: 'done', week: 4, of: 4 })
  })
})
