import { cn } from './cn'

/** The app mark: a barbell on a tile of the accent's gradient. */
export function Logo({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('glass-tint inline-flex size-14 items-center justify-center rounded-[30%]', className)}>
      <svg viewBox="0 0 64 64" className="size-[78%]" fill="currentColor">
        <rect x="12" y="22" width="6" height="20" rx="2" />
        <rect x="46" y="22" width="6" height="20" rx="2" />
        <rect x="19" y="26" width="5" height="12" rx="1.5" />
        <rect x="40" y="26" width="5" height="12" rx="1.5" />
        <rect x="24" y="30" width="16" height="4" rx="1" />
      </svg>
    </span>
  )
}
