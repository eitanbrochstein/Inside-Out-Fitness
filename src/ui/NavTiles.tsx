import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { riseDelay } from './motion'

export interface NavTile {
  to: string
  title: string
  sub?: ReactNode
  icon: LucideIcon
}

/** Two-column grid of glass tiles leading to the main areas. */
export function NavTiles({ items }: { items: NavTile[] }) {
  return (
    <nav className="grid grid-cols-2 gap-3">
      {items.map(({ to, title, sub, icon: Icon }, i) => (
        <Link
          key={to}
          to={to}
          viewTransition
          data-interactive
          style={riseDelay(i)}
          className="glass-card flex min-h-[120px] animate-rise select-none flex-col justify-between gap-3 rounded-card p-4 active:scale-[0.97]"
        >
          <span className="flex size-10 items-center justify-center rounded-tile bg-accent-soft text-accent-text">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-callout font-semibold">{title}</span>
            <span className="mt-0.5 block truncate text-footnote text-muted">{sub ?? ' '}</span>
          </span>
        </Link>
      ))}
    </nav>
  )
}
