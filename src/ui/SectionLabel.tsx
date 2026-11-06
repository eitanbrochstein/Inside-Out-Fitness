import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export function SectionLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-micro font-semibold uppercase text-faint', className)} {...props} />
}
