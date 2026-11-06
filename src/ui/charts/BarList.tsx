import { motion } from 'motion/react'
import { cn } from '../cn'
import { spring } from '../motion'

export interface BarListItem {
  key: string
  label: string
  value: number
  display: string
}

/** Horizontal bars from a shared baseline, one hue: labels left, values right. */
export function BarList({ items, label }: { items: BarListItem[]; label: string }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3">
          <span className="truncate text-footnote text-muted">{i.label}</span>
          <span className="h-2.5">
            <motion.span
              className={cn('block h-full rounded-r-[4px] bg-accent', i.value > 0 && 'min-w-0.5')}
              initial={{ width: 0 }}
              animate={{ width: `${(i.value / max) * 100}%` }}
              transition={spring.soft}
            />
          </span>
          <span className="min-w-8 text-right text-footnote font-semibold tabular-nums">{i.display}</span>
        </li>
      ))}
    </ul>
  )
}
