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

/** A set's time: "45 sec", "1:30", "10 min". */
export function formatSetTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} sec`
  if (s % 60 === 0) return `${s / 60} min`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const RPE_LABELS = ['Very light', 'Very light', 'Light', 'Light', 'Moderate', 'Moderate', 'Hard', 'Hard', 'Very hard', 'Max effort']

/** How a session RPE (1–10) reads in words. */
export const rpeLabel = (rpe: number) => RPE_LABELS[Math.min(10, Math.max(1, Math.round(rpe))) - 1]
