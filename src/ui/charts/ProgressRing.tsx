import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '../cn'
import { spring } from '../motion'
import { gradient } from './shared'

/** A ring that fills to `value` (0–1), lit by the accent's gradient, with anything in its middle. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  label,
  children,
  className,
}: {
  value: number
  size?: number
  stroke?: number
  label: string
  children?: ReactNode
  className?: string
}) {
  const v = Math.max(0, Math.min(1, value))
  const r = (size - stroke) / 2
  const c = size / 2
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="stroke-accent-soft" />
        {v > 0 && (
          <motion.circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{ stroke: gradient.stroke }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: v }}
            transition={spring.soft}
          />
        )}
      </svg>
      {children && <div className="relative text-center leading-none">{children}</div>}
    </div>
  )
}
