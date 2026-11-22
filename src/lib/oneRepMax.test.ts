import { describe, expect, it } from 'vitest'
import { estimateAll, FORMULAS, MAX_REPS } from './oneRepMax'

const byId = (weight: number, reps: number) =>
  Object.fromEntries(estimateAll(weight, reps)!.results.map((r) => [r.id, r.value]))

describe('estimateAll', () => {
  it('has the ten formulas, each once', () => {
    expect(FORMULAS.map((f) => f.id)).toEqual([
      'epley', 'brzycki', 'lander', 'oconner', 'lombardi', 'mayhew', 'wathen', 'adams', 'baechle', 'brown',
    ])
  })

  it('100 × 5 by each formula', () => {
    const e = byId(100, 5)
    expect(e.epley).toBeCloseTo(116.67, 2) // 100 × (1 + 5/30)
    expect(e.brzycki).toBeCloseTo(112.5, 2) // 100 × 36 / 32
    expect(e.lander).toBeCloseTo(113.71, 2) // 10000 / (101.3 − 13.356)
    expect(e.oconner).toBeCloseTo(112.5, 2) // 100 × (1 + 5/40)
    expect(e.lombardi).toBeCloseTo(117.46, 2) // 100 × 5^0.1
    expect(e.mayhew).toBeCloseTo(119.01, 2) // 100 / (0.522 + 0.419 e^−0.275)
    expect(e.wathen).toBeCloseTo(116.58, 2) // 100 / (0.488 + 0.538 e^−0.375)
    expect(e.adams).toBeCloseTo(111.11, 2) // 100 / 0.9
    expect(e.baechle).toBeCloseTo(116.5, 2) // 100 × 1.165
    expect(e.brown).toBeCloseTo(114.89, 2) // 100 × (0.9849 + 0.164)
  })

  it('averages the ten and reports the spread', () => {
    const est = estimateAll(100, 5)!
    expect(est.average).toBeCloseTo(115.09, 2)
    expect(est.min).toBeCloseTo(111.11, 2) // Adams
    expect(est.max).toBeCloseTo(119.01, 2) // Mayhew
  })

  it('scales with the weight, whatever the unit', () => {
    expect(byId(225, 5).epley).toBeCloseTo(262.5, 2)
    expect(byId(102.5, 3).brzycki).toBeCloseTo((102.5 * 36) / 34, 6)
  })

  it('a single rep is already a 1RM, by every formula', () => {
    const est = estimateAll(140, 1)!
    expect(est.results.every((r) => r.value === 140)).toBe(true)
    expect(est.average).toBe(140)
  })

  it('stays finite and positive up to the rep limit', () => {
    const est = estimateAll(50, MAX_REPS)!
    expect(est.results.every((r) => Number.isFinite(r.value) && r.value > 50)).toBe(true)
  })

  it('rejects a missing weight and reps outside 1–30', () => {
    expect(estimateAll(0, 5)).toBeNull()
    expect(estimateAll(-10, 5)).toBeNull()
    expect(estimateAll(Number.NaN, 5)).toBeNull()
    expect(estimateAll(100, 0)).toBeNull()
    expect(estimateAll(100, MAX_REPS + 1)).toBeNull()
    expect(estimateAll(100, 2.5)).toBeNull()
  })
})
