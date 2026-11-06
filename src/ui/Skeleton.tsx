import { cn } from './cn'

/** A placeholder with light sweeping across it. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-card bg-surface-2/70 bg-[linear-gradient(100deg,transparent_30%,color-mix(in_srgb,var(--text)_6%,transparent)_50%,transparent_70%)] bg-size-[200%_100%]',
        className,
      )}
    />
  )
}
