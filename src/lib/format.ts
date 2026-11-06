import { toDisplay, type Unit } from './load'

/** "1 set", "3 sets". */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** 950, 1.2K, 12.4K: for axes and tiles. */
export const formatCompact = (n: number) => compact.format(Math.round(n))

/** A training volume (weight × reps) in the display unit, compacted: "12.4K lb". */
export const formatVolume = (kg: number, unit: Unit) => `${formatCompact(toDisplay(kg, unit))} ${unit}`

/** "+12%", "−8%". */
export const formatChange = (fraction: number) => `${fraction >= 0 ? '+' : '−'}${Math.round(Math.abs(fraction) * 100)}%`
