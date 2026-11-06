// Shared chart settings: recessive axes and dates. Text uses text tokens, never series colours.
import { useReducedMotion } from 'motion/react'
import { formatCompact } from '@/lib/format'

export const axisTick = { fill: 'var(--faint)', fontSize: 11 }

export const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export const compactTick = (v: number) => formatCompact(v)

/** Charts draw in, unless the reader asked for less motion. */
export const useChartAnimation = () => !useReducedMotion()

/** Gradients defined once in <ChartDefs>, for marks to reference. */
export const gradient = {
  /** A wash of the accent fading down: area fills. */
  area: 'url(#accent-area)',
  /** The accent's companion into the accent, left to right: rings and lines. */
  stroke: 'url(#accent-stroke) var(--accent)',
  /** A column lit at its top: the current period. */
  bar: 'url(#accent-bar)',
}
