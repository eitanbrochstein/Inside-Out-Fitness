/** Where one tab sits along the bar, in px from the row's left edge. */
export interface Slot {
  left: number
  width: number
}

/** The tab whose centre is closest to `x` (a point along the row), or -1 when there are none. */
export function nearestSlot(x: number, slots: readonly Slot[]): number {
  let best = -1
  let bestDistance = Infinity
  slots.forEach((slot, i) => {
    const distance = Math.abs(slot.left + slot.width / 2 - x)
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  })
  return best
}

/**
 * Clamps `value` to [min, max] the way iOS does at a scroll edge: past either end it still moves,
 * but less and less, and never more than `reach` px.
 */
export function rubberBand(value: number, min: number, max: number, reach = 40): number {
  const resist = (over: number) => reach * (1 - 1 / ((over * 0.55) / reach + 1))
  if (value < min) return min - resist(min - value)
  if (value > max) return max + resist(value - max)
  return value
}
