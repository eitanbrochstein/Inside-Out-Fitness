import { describe, expect, it } from 'vitest'
import { fromDisplay, type LoadContext } from './load'
import { exerciseSummary, type SummarySet } from './summary'

const lb = (x: number) => fromDisplay(x, 'lb')
const ctx: LoadContext = { currentMaxKg: lb(225), unit: 'lb', rounding: { increment: 5, mode: 'nearest' } }

const set = (p: Partial<SummarySet>): SummarySet => ({
  target_reps: null,
  target_percent: null,
  target_weight_kg: null,
  basis_max_kg: null,
  prescribed_load_kg: null,
  actual_reps: null,
  actual_weight_kg: null,
  completed_at: null,
  ...p,
})

describe('exerciseSummary', () => {
  it('lists percents when every set is percent-based (wireframe 2)', () => {
    const sets = [set({ target_reps: 8, target_percent: 60 }), set({ target_reps: 5, target_percent: 75 }), set({ target_reps: 3, target_percent: 85 })]
    expect(exerciseSummary({ sets, mode: 'edit', ctx })).toBe('3 sets · 60% / 75% / 85%')
  })

  it('collapses identical sets', () => {
    const sets = Array.from({ length: 3 }, () => set({ target_reps: 10, target_weight_kg: lb(75) }))
    expect(exerciseSummary({ sets, mode: 'edit', ctx })).toBe('3 × 10 · 75 lb')
    const pct = Array.from({ length: 5 }, () => set({ target_reps: 5, target_percent: 80 }))
    expect(exerciseSummary({ sets: pct, mode: 'edit', ctx })).toBe('5 × 5 · 80%')
  })

  it('shows a weight range for varied manual sets', () => {
    const sets = [set({ target_reps: 5, target_weight_kg: lb(135) }), set({ target_reps: 5, target_weight_kg: lb(185) })]
    expect(exerciseSummary({ sets, mode: 'edit', ctx })).toBe('2 × 5 · 135–185 lb')
  })

  it('falls back to last performed when nothing is planned', () => {
    const sets = Array.from({ length: 3 }, () => set({ target_reps: 10 }))
    expect(exerciseSummary({ sets, mode: 'edit', ctx, lastPerformedKg: lb(75) })).toBe('3 × 10 · 75 lb last performed')
    expect(exerciseSummary({ sets, mode: 'edit', ctx })).toBe('3 × 10')
  })

  it('mixes percent and manual labels', () => {
    const sets = [set({ target_reps: 5, target_percent: 75 }), set({ target_reps: 8, target_weight_kg: lb(135) })]
    expect(exerciseSummary({ sets, mode: 'edit', ctx })).toBe('2 sets · 75% / 135 lb')
  })

  it('shows progress while training and the top set when done', () => {
    const sets = [
      set({ target_reps: 5, actual_reps: 5, actual_weight_kg: lb(170), completed_at: 'x' }),
      set({ target_reps: 3, actual_reps: 3, actual_weight_kg: lb(190), completed_at: 'x' }),
      set({ target_reps: 3 }),
    ]
    expect(exerciseSummary({ sets, mode: 'train', ctx })).toBe('2 of 3 sets')
    expect(exerciseSummary({ sets, mode: 'done', ctx })).toBe('2 sets · top 190 lb × 3')
  })

  it('handles empty blocks', () => {
    expect(exerciseSummary({ sets: [], mode: 'edit', ctx })).toBe('No sets yet')
    expect(exerciseSummary({ sets: [set({ target_reps: 5 })], mode: 'done', ctx })).toBe('Not logged')
  })
})
