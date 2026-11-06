import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'tinted' | 'ghost' | 'danger' | 'danger-soft'
type Size = 'sm' | 'md' | 'lg'

// Glass variants take their transitions from materials.css; the flat ones set their own.
const flat = 'transition-[scale,opacity,background-color] duration-150 ease-smooth'
const variants: Record<Variant, string> = {
  primary: 'glass-tint',
  secondary: 'glass-control text-text',
  tinted: cn(flat, 'bg-accent-soft text-accent-text active:opacity-80'),
  ghost: cn(flat, 'text-accent-text active:bg-accent-soft'),
  danger: cn(flat, 'bg-danger text-on-danger active:opacity-90'),
  'danger-soft': cn(flat, 'bg-danger-soft text-danger active:opacity-80'),
}

const sizes: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3.5 text-subhead',
  md: 'h-11 px-4 text-callout',
  lg: 'h-[52px] px-5 text-headline',
}

export interface ButtonStyle {
  variant?: Variant
  size?: Size
  block?: boolean
}

export const buttonClass = ({ variant = 'primary', size = 'md', block }: ButtonStyle, className?: string) =>
  cn(
    'inline-flex select-none items-center justify-center gap-2 rounded-button font-semibold active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    block && 'w-full',
    className,
  )
