import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from './cn'
import { spring } from './motion'

/** The box and its check, for a control that is itself the checkbox (a selectable card). */
export function CheckIndicator({ checked, shape = 'square', className }: { checked: boolean; shape?: 'square' | 'round'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-6 shrink-0 items-center justify-center',
        shape === 'round' ? 'rounded-full' : 'rounded-lg',
        checked ? 'glass-tint' : 'glass-field',
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {checked && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.1 } }}
            transition={spring.pop}
          >
            <Check className="size-4" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  shape,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  shape?: 'square' | 'round'
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative shrink-0 before:absolute before:-inset-2.5', className)}
    >
      <CheckIndicator checked={checked} shape={shape} />
    </button>
  )
}
