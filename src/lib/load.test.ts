import { describe, expect, it } from 'vitest'
import {
  estimate1RM,
  formatWeight,
  freezeSet,
  fromDisplay,
  percentLoad,
  plannedLoadKg,
  roundToIncrement,
  toDisplay,
  type LoadContext,
  type SetPlan,
} from './load'

const lb5: LoadContext['rounding'] = { increment: 5, mode: 'nearest' }
const kg25: LoadContext['rounding'] = { increment: 2.5, mode: 'nearest' }
const lbKg = (lb: number) => fromDisplay(lb, 'lb')

const plan = (p: Partial<SetPlan>): SetPlan => ({
  target_percent: null,
  target_weight_kg: null,
  basis_max_kg: null,
  prescribed_load_kg: null,
  ...p,
})

describe('percentLoad', () => {
  it('matches the wireframe: 225 lb × 60 / 75 / 85% → 135 / 170 / 190', () => {
    const loads = [60, 75, 85].map(
      (percent) => percentLoad({ maxKg: lbKg(225), percent, unit: 'lb', rounding: lb5 })?.display,
    )
    expect(loads).toEqual([135, 170, 190])
  })

  it('matches the assignment wireframe: 185 × 80% → 150', () => {
    expect(percentLoad({ maxKg: lbKg(185), percent: 80, unit: 'lb', rounding: lb5 })?.display).toBe(150)
  })

  it('rounds an exact tie up after the lb → kg → lb round trip (230 × 75% → 175)', () => {
    expect(percentLoad({ maxKg: lbKg(230), percent: 75, unit: 'lb', rounding: lb5 })?.display).toBe(175)
  })

  it('supports rounding down', () => {
    const r = percentLoad({ maxKg: lbKg(225), percent: 75, unit: 'lb', rounding: { increment: 5, mode: 'down' } })
    expect(r?.display).toBe(165)
  })

  it('works in kg with fractional percents and increments', () => {
    expect(percentLoad({ maxKg: 100, percent: 72.5, unit: 'kg', rounding: kg25 })?.display).toBe(72.5)
    expect(percentLoad({ maxKg: 140, percent: 83, unit: 'kg', rounding: kg25 })?.display).toBe(115)
  })

  it('returns kg that converts back to the rounded display value', () => {
    const r = percentLoad({ maxKg: lbKg(225), percent: 75, unit: 'lb', rounding: lb5 })!
    expect(toDisplay(r.kg, 'lb')).toBe(170)
  })

  it('returns null without a max or a positive percent', () => {
    expect(percentLoad({ maxKg: null, percent: 75, unit: 'lb', rounding: lb5 })).toBeNull()
    expect(percentLoad({ maxKg: lbKg(225), percent: 0, unit: 'lb', rounding: lb5 })).toBeNull()
  })
})

describe('roundToIncrement', () => {
  it('rounds half up and handles float noise', () => {
    expect(roundToIncrement(172.5, 5, 'nearest')).toBe(175)
    expect(roundToIncrement(172.49, 5, 'nearest')).toBe(170)
    expect(roundToIncrement(0.1 + 0.2, 0.1, 'down')).toBe(0.3)
  })
})

describe('plannedLoadKg / freezeSet', () => {
  const ctx = (maxLb: number | null): LoadContext => ({
    currentMaxKg: maxLb == null ? null : lbKg(maxLb),
    unit: 'lb',
    rounding: lb5,
  })

  it('uses the typed weight for manual sets, unrounded', () => {
    const set = plan({ target_weight_kg: lbKg(72.5) })
    expect(toDisplay(plannedLoadKg(set, ctx(225))!, 'lb')).toBe(72.5)
  })

  it('follows the current max for unfrozen percent sets', () => {
    const set = plan({ target_percent: 75 })
    expect(toDisplay(plannedLoadKg(set, ctx(225))!, 'lb')).toBe(170)
    expect(toDisplay(plannedLoadKg(set, ctx(245))!, 'lb')).toBe(185)
  })

  it('keeps a frozen load when the max changes later', () => {
    const set = plan({ target_percent: 75 })
    const frozen = { ...set, ...freezeSet(set, ctx(225))! }
    expect(toDisplay(plannedLoadKg(frozen, ctx(300))!, 'lb')).toBe(170)
  })

  it('only freezes unfrozen percent sets that have a max', () => {
    expect(freezeSet(plan({ target_weight_kg: 50 }), ctx(225))).toBeNull()
    expect(freezeSet(plan({ target_percent: 75 }), ctx(null))).toBeNull()
    expect(freezeSet(plan({ target_percent: 75, basis_max_kg: 100, prescribed_load_kg: 75 }), ctx(225))).toBeNull()
  })

  it('returns null for a percent set with no max', () => {
    expect(plannedLoadKg(plan({ target_percent: 75 }), ctx(null))).toBeNull()
  })
})

describe('estimate1RM (Epley)', () => {
  it('estimates within 1–12 reps', () => {
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 2)
    expect(estimate1RM(100, 15)).toBeNull()
    expect(estimate1RM(0, 5)).toBeNull()
    expect(estimate1RM(100, 0)).toBeNull()
  })
})

describe('formatWeight', () => {
  it('trims decimals and adds the unit', () => {
    expect(formatWeight(lbKg(137.5), 'lb')).toBe('137.5 lb')
    expect(formatWeight(lbKg(135), 'lb')).toBe('135 lb')
    expect(formatWeight(32.5, 'kg', { perHand: true })).toBe('32.5 kg / hand')
  })
})
