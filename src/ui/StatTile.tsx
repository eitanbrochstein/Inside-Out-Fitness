import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Card } from './Card'
import { cn } from './cn'

export interface Delta {
  text: string
  dir: 'up' | 'down' | 'flat'
}

const deltas = {
  up: { icon: ArrowUpRight, className: 'text-success' },
  down: { icon: ArrowDownRight, className: 'text-danger' },
  flat: { icon: ArrowRight, className: 'text-muted' },
}

/** One number with its label; optional change since last time and a small chart below. */
export function StatTile({
  label,
  value,
  unit,
  delta,
  icon,
  children,
  className,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  delta?: Delta
  icon?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const D = delta && deltas[delta.dir]
  return (
    <Card className={cn('flex min-w-0 flex-col gap-1 p-4', className)}>
      <div className="flex items-center gap-1.5 text-caption font-semibold text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-title-2 font-semibold">{value}</span>
        {unit && <span className="text-footnote font-medium text-muted">{unit}</span>}
      </div>
      {delta && D && (
        <span className={cn('flex items-center gap-0.5 text-caption font-semibold', D.className)}>
          <D.icon className="size-3.5" strokeWidth={2.4} />
          {delta.text}
        </span>
      )}
      {children}
    </Card>
  )
}
