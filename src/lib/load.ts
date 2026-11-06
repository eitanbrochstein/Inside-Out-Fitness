// Load math. All weights are stored in kg; conversion happens only at the UI edge.

export type Unit = 'lb' | 'kg'
export type RoundingMode = 'nearest' | 'down'
export type Rounding = { increment: number; mode: RoundingMode } // increment is in the display unit

export const KG_PER_LB = 0.45359237

/** The plan + frozen columns of a workout set. Percent set ⇔ target_percent is set. */
export interface SetPlan {
  target_percent: number | null
  target_weight_kg: number | null
  basis_max_kg: number | null
  prescribed_load_kg: number | null
}

export interface LoadContext {
  currentMaxKg: number | null
  unit: Unit
  rounding: Rounding
}

// Kills float drift from lb → kg → lb round trips (e.g. 229.99999999999997).
export const round4 = (x: number) => Math.round(x * 1e4) / 1e4

export const toDisplay = (kg: number, unit: Unit) => round4(unit === 'kg' ? kg : kg / KG_PER_LB)
export const fromDisplay = (value: number, unit: Unit) => (unit === 'kg' ? value : value * KG_PER_LB)

export function roundToIncrement(x: number, increment: number, mode: RoundingMode) {
  const steps = mode === 'nearest' ? Math.floor(x / increment + 0.5 + 1e-9) : Math.floor(x / increment + 1e-9)
  return round4(steps * increment)
}

export function percentLoad(args: {
  maxKg: number | null
  percent: number
  unit: Unit
  rounding: Rounding
}): { kg: number; display: number } | null {
  const { maxKg, percent, unit, rounding } = args
  if (maxKg == null || !(percent > 0)) return null
  const display = roundToIncrement((toDisplay(maxKg, unit) * percent) / 100, rounding.increment, rounding.mode)
  return { kg: fromDisplay(display, unit), display }
}

export const isPercentSet = (set: Pick<SetPlan, 'target_percent'>) => set.target_percent != null

/** The prescribed load for a set: frozen load, else typed load, else % of the frozen or current max. */
export function plannedLoadKg(set: SetPlan, ctx: LoadContext): number | null {
  if (set.prescribed_load_kg != null) return set.prescribed_load_kg
  if (!isPercentSet(set)) return set.target_weight_kg
  return (
    percentLoad({
      maxKg: set.basis_max_kg ?? ctx.currentMaxKg,
      percent: set.target_percent!,
      unit: ctx.unit,
      rounding: ctx.rounding,
    })?.kg ?? null
  )
}

/** Values to persist when a percent set is completed, so later max changes don't rewrite history. */
export function freezeSet(set: SetPlan, ctx: LoadContext): Pick<SetPlan, 'basis_max_kg' | 'prescribed_load_kg'> | null {
  if (!isPercentSet(set) || set.basis_max_kg != null || ctx.currentMaxKg == null) return null
  const load = percentLoad({ maxKg: ctx.currentMaxKg, percent: set.target_percent!, unit: ctx.unit, rounding: ctx.rounding })
  if (!load) return null
  return { basis_max_kg: ctx.currentMaxKg, prescribed_load_kg: load.kg }
}

/** Epley estimate; only trusted for 1–12 reps. */
export function estimate1RM(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps >= 1) || reps > 12) return null
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

export const formatNumber = (x: number) => String(Math.round(x * 100) / 100)

export function formatWeight(kg: number, unit: Unit, opts: { perHand?: boolean } = {}) {
  return `${formatNumber(toDisplay(kg, unit))} ${unit}${opts.perHand ? ' / hand' : ''}`
}

export const defaultIncrement = (unit: Unit) => (unit === 'kg' ? 2.5 : 5)
