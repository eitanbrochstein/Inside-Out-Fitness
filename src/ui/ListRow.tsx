import type { HTMLAttributes, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link, type To } from 'react-router'
import { Card } from './Card'
import { cn } from './cn'

interface ListRowProps {
  /** Where the row goes; or `onClick` for an action; neither for a plain row. */
  to?: To
  state?: unknown
  onClick?: () => void
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Small text on the right, before `trailing`. */
  meta?: ReactNode
  trailing?: ReactNode | 'chevron'
  /** A row that is its own card rather than one of a ListGroup's. */
  standalone?: boolean
  className?: string
}

/** One row of a list: in a ListGroup, or standing alone as a card. */
export function ListRow({ to, state, onClick, leading, title, subtitle, meta, trailing, standalone, className }: ListRowProps) {
  const pressable = !!(to || onClick)
  const classes = cn(
    'flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left',
    pressable && 'select-none',
    standalone
      ? cn('glass-card rounded-card', pressable && 'active:scale-[0.98]')
      : pressable && 'transition-colors duration-150 active:bg-(--glass-press)',
    className,
  )
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-footnote text-muted">{subtitle}</span>}
      </span>
      {meta && <span className="shrink-0 text-footnote text-muted tabular-nums">{meta}</span>}
      {trailing === 'chevron' ? <ChevronRight className="size-[18px] shrink-0 text-faint" /> : trailing}
    </>
  )
  const interactive = standalone && pressable ? true : undefined

  if (to)
    return (
      <Link to={to} state={state} viewTransition data-interactive={interactive} className={classes}>
        {body}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} data-interactive={interactive} className={classes}>
        {body}
      </button>
    )
  return <div className={classes}>{body}</div>
}

/** Rows sharing one card, divided by hairlines. */
export function ListGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn('divide-y divide-border overflow-hidden', className)} {...props} />
}
