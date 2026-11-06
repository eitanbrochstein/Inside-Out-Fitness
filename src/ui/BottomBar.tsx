import type { ReactNode } from 'react'
import { cn } from './cn'

/** A floating glass bar for a page's main actions; `top` holds a strip above them (progress). */
export function BottomBar({ children, top, className }: { children: ReactNode; top?: ReactNode; className?: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-bar) pb-safe px-3">
      <div className="glass-surface pointer-events-auto mx-auto max-w-lg rounded-[28px] border p-2">
        {top}
        <div className={cn('flex gap-2', className)}>{children}</div>
      </div>
    </div>
  )
}
