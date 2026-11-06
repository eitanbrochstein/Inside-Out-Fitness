import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type Variant = 'glass' | 'solid' | 'inset'

const variants: Record<Variant, string> = {
  glass: 'glass-card',
  solid: 'border border-border bg-surface shadow-card',
  inset: 'border border-border bg-surface-2/60',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  /** Presses down and lights up where touched. */
  interactive?: boolean
}

export function Card({ variant = 'glass', interactive, className, ...props }: CardProps) {
  return (
    <div
      data-interactive={interactive || undefined}
      className={cn('rounded-card', variants[variant], interactive && 'select-none active:scale-[0.98]', className)}
      {...props}
    />
  )
}

/** A card's heading row: title and subtitle, with an optional action on the right. */
export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-callout font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-footnote text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
