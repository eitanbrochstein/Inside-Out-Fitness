import { cn } from './cn'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-subhead font-bold text-accent-text ring-1 ring-accent-ring/40 ring-inset',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
