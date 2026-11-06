import type { Transition } from 'motion/react'

/** The app's motion, in step with the CSS tokens: one curve, three durations, a few springs. */
export const ease = [0.2, 0.8, 0.2, 1] as const

export const duration = { fast: 0.15, base: 0.25, slow: 0.4 }

export const spring = {
  /** Sliding indicators: the segmented control, the tab bar's lens. */
  snappy: { type: 'spring', stiffness: 500, damping: 38 },
  /** Sheets and panels. */
  sheet: { type: 'spring', stiffness: 420, damping: 40 },
  /** Rings and bars filling up. */
  soft: { type: 'spring', stiffness: 260, damping: 30 },
  /** Checks and badges appearing. */
  pop: { type: 'spring', stiffness: 600, damping: 22 },
} satisfies Record<string, Transition>

/** The first few items of a list rise in one after another (with `animate-rise`); later ones just appear. */
export const riseDelay = (index: number) => ({ animationDelay: `${Math.min(index, 8) * 40}ms` })
