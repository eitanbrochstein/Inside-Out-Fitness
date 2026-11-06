import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/** Standard page column: 20px gutters, safe-area top, phone-width max, room for the tab bar. Named for page transitions (motion.css). */
export function Page({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <main className={cn('pt-safe mx-auto w-full max-w-lg px-5 pb-(--chrome-bottom) [view-transition-name:page]', className)} {...props} />
  )
}
