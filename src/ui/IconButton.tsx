import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

type Size = 'sm' | 'md' | 'lg'
type Variant = 'plain' | 'glass' | 'accent'

// Smaller buttons keep a 44px touch target with an invisible margin.
const sizes: Record<Size, string> = {
  sm: 'size-9 before:-inset-1',
  md: 'size-10 before:-inset-0.5',
  lg: 'size-11',
}

const variants: Record<Variant, string> = {
  plain: 'text-muted transition-[scale,background-color,color] duration-150 ease-smooth active:bg-(--glass-press)',
  glass: 'glass-control text-text',
  accent: 'glass-tint',
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string
  size?: Size
  variant?: Variant
}

export function IconButton({ size = 'lg', variant = 'plain', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center rounded-full before:absolute active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
