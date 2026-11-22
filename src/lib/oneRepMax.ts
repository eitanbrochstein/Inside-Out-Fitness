// Estimated one-rep max from a set of w × r, by ten published formulas. Unit-agnostic: the result is
// in whatever unit the weight is. Records and charts keep using Epley (estimate1RM in load.ts, mirrored
// in SQL), so this module is the calculator's alone.

export interface Formula {
  id: string
  name: string
  blurb: string
  estimate: (w: number, r: number) => number
}

export const FORMULAS: Formula[] = [
  {
    id: 'epley',
    name: 'Epley',
    blurb: 'Balanced linear estimate; widely used for general lifting.',
    estimate: (w, r) => w * (1 + r / 30),
  },
  {
    id: 'brzycki',
    name: 'Brzycki',
    blurb: 'More conservative at higher reps; popular for lower-rep sets.',
    estimate: (w, r) => (w * 36) / (37 - r),
  },
  {
    id: 'lander',
    name: 'Lander',
    blurb: 'Middle-ground estimate between aggressive and conservative curves.',
    estimate: (w, r) => (100 * w) / (101.3 - 2.67123 * r),
  },
  {
    id: 'oconner',
    name: "O'Conner",
    blurb: 'Simple, conservative linear formula.',
    estimate: (w, r) => w * (1 + r / 40),
  },
  {
    id: 'lombardi',
    name: 'Lombardi',
    blurb: 'Power-based formula that scales higher on endurance rep counts.',
    estimate: (w, r) => w * r ** 0.1,
  },
  {
    id: 'mayhew',
    name: 'Mayhew',
    blurb: 'Exponential formula often referenced for bench press.',
    estimate: (w, r) => w / (0.522 + 0.419 * Math.exp(-0.055 * r)),
  },
  {
    id: 'wathen',
    name: 'Wathen',
    blurb: 'Exponential formula used across compound lifts.',
    estimate: (w, r) => w / (0.488 + 0.538 * Math.exp(-0.075 * r)),
  },
  {
    id: 'adams',
    name: 'Adams',
    blurb: 'Linear-style denominator estimate.',
    estimate: (w, r) => w / (1 - 0.02 * r),
  },
  {
    id: 'baechle',
    name: 'Baechle',
    blurb: 'Close to Epley with a slightly steeper slope.',
    estimate: (w, r) => w * (1 + 0.033 * r),
  },
  {
    id: 'brown',
    name: 'Brown',
    blurb: 'Regression-based linear formula.',
    estimate: (w, r) => w * (0.9849 + 0.0328 * r),
  },
]

/** Every denominator above stays positive through 30 reps; past ~10 the estimates spread apart. */
export const MAX_REPS = 30
export const RELIABLE_REPS = 10

export interface OneRepMaxEstimate {
  results: { id: string; name: string; value: number }[]
  average: number
  min: number
  max: number
}

/** All ten estimates for w × r, or null for a weight that isn't positive or reps outside 1–30. A single
 * rep is already a 1RM, so every formula returns the weight itself. */
export function estimateAll(weight: number, reps: number): OneRepMaxEstimate | null {
  if (!(weight > 0) || !Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return null
  const results = FORMULAS.map((f) => ({ id: f.id, name: f.name, value: reps === 1 ? weight : f.estimate(weight, reps) }))
  const values = results.map((r) => r.value)
  return {
    results,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  }
}
