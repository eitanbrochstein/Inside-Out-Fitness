import { useId } from 'react'
import { motion } from 'motion/react'
import { cn } from './cn'
import { spring } from './motion'

interface Option<T extends string> {
  value: T
  label: string
}

/** A glass track whose chosen option sits under a sliding lens. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  'aria-label'?: string
}) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('glass-control flex rounded-tile p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative h-9 flex-1 select-none rounded-[10px] text-subhead font-semibold transition-colors duration-150',
              active ? 'text-text' : 'text-muted',
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="glass-lens absolute inset-0 rounded-[10px]" transition={spring.snappy} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
