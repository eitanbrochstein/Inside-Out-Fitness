import type { ReactNode } from 'react'
import { cn } from './cn'

/** A toggle pill: glass, or the accent's gradient when selected. */
export function Chip({
  selected,
  onClick,
  icon,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 select-none items-center gap-1.5 rounded-full px-3.5 text-subhead font-semibold active:scale-[0.96]',
        selected ? 'glass-tint' : 'glass-control text-muted',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'pr' | 'live'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-muted',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  pr: 'bg-pr-soft text-pr',
  live: 'glass-tint',
}

/** A small label: status, origin, a personal record. */
export function Badge({ tone = 'neutral', pulse, children, className }: { tone?: Tone; pulse?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-micro font-bold uppercase',
        tones[tone],
        className,
      )}
    >
      {pulse && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  )
}
