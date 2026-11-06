// One-line summaries shown on collapsed exercise cards.
import { formatNumber, formatWeight, isPercentSet, toDisplay, type LoadContext, type SetPlan } from './load'
import { plural } from './format'
import { topSet } from './progress'

export interface SummarySet extends SetPlan {
  target_reps: number | null
  actual_reps: number | null
  actual_weight_kg: number | null
  completed_at: string | null
}

export type SummaryMode = 'edit' | 'train' | 'done'

export function exerciseSummary(args: {
  sets: SummarySet[]
  mode: SummaryMode
  ctx: LoadContext
  lastPerformedKg?: number | null
}): string {
  const { sets, mode, ctx, lastPerformedKg } = args
  const n = sets.length
  if (n === 0) return 'No sets yet'

  const done = sets.filter((s) => s.completed_at)
  if (mode === 'train') return `${done.length} of ${plural(n, 'set')}`
  if (mode === 'done') {
    const top = topSet(done.map((s) => ({ weightKg: s.actual_weight_kg, reps: s.actual_reps ?? 0 })))
    if (!top) return 'Not logged'
    const load = top.weightKg == null ? 'bodyweight' : formatWeight(top.weightKg, ctx.unit)
    return `${plural(done.length, 'set')} · top ${load} × ${top.reps}`
  }

  const reps = sets[0].target_reps
  const sameReps = reps != null && sets.every((s) => s.target_reps === reps)
  const head = sameReps ? `${n} × ${reps}` : plural(n, 'set')

  const percents = sets.filter(isPercentSet).map((s) => s.target_percent!)
  const weights = sets.filter((s) => !isPercentSet(s) && s.target_weight_kg != null).map((s) => toDisplay(s.target_weight_kg!, ctx.unit))

  if (percents.length === 0 && weights.length === 0) {
    return lastPerformedKg == null ? head : `${head} · ${formatWeight(lastPerformedKg, ctx.unit)} last performed`
  }

  if (percents.length === n) {
    const unique = new Set(percents)
    if (unique.size === 1) return `${head} · ${formatNumber(percents[0])}%`
    if (n <= 5) return `${head} · ${percents.map((p) => `${formatNumber(p)}%`).join(' / ')}`
    return `${head} · ${formatNumber(Math.min(...percents))}–${formatNumber(Math.max(...percents))}%`
  }

  if (weights.length === n) {
    const lo = Math.min(...weights)
    const hi = Math.max(...weights)
    return `${head} · ${lo === hi ? formatNumber(lo) : `${formatNumber(lo)}–${formatNumber(hi)}`} ${ctx.unit}`
  }

  const labels = sets.flatMap((s) =>
    isPercentSet(s)
      ? [`${formatNumber(s.target_percent!)}%`]
      : s.target_weight_kg != null
        ? [formatWeight(s.target_weight_kg, ctx.unit)]
        : [],
  )
  return `${head} · ${labels.slice(0, 4).join(' / ')}${labels.length > 4 ? ' …' : ''}`
}
