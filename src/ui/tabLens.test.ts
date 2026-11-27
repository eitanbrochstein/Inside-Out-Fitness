import { describe, expect, test } from 'vitest'
import { nearestSlot, rubberBand } from './tabLens'

const slots = [
  { left: 0, width: 100 },
  { left: 104, width: 100 },
  { left: 208, width: 100 },
]

describe('nearestSlot', () => {
  test('picks the tab whose centre is closest', () => {
    expect(nearestSlot(50, slots)).toBe(0)
    expect(nearestSlot(140, slots)).toBe(1)
    expect(nearestSlot(170, slots)).toBe(1)
    expect(nearestSlot(240, slots)).toBe(2)
  })

  test('past either end, the end tab', () => {
    expect(nearestSlot(-80, slots)).toBe(0)
    expect(nearestSlot(900, slots)).toBe(2)
  })

  test('no tabs, no slot', () => {
    expect(nearestSlot(10, [])).toBe(-1)
  })
})

describe('rubberBand', () => {
  test('inside the range, unchanged', () => {
    expect(rubberBand(0, 0, 200)).toBe(0)
    expect(rubberBand(120, 0, 200)).toBe(120)
    expect(rubberBand(200, 0, 200)).toBe(200)
  })

  test('past an end, it gives a little, and less the further it goes', () => {
    const near = rubberBand(210, 0, 200) - 200
    const far = rubberBand(300, 0, 200) - 200
    expect(near).toBeGreaterThan(0)
    expect(near).toBeLessThan(10)
    expect(far).toBeGreaterThan(near)
    expect(far).toBeLessThan(100)
    expect(rubberBand(-10, 0, 200)).toBeCloseTo(-near)
  })

  test('never goes past its reach', () => {
    expect(rubberBand(100_000, 0, 200, 40)).toBeLessThan(240)
    expect(rubberBand(-100_000, 0, 200, 40)).toBeGreaterThan(-40)
  })
})
