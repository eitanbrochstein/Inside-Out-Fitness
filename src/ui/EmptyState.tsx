import type { ReactNode } from 'react'
import { Card } from './Card'

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-9 text-center">
      {icon && (
        <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text [&_svg]:size-6">{icon}</span>
      )}
      {title && <p className="text-headline font-semibold">{title}</p>}
      <p className="text-callout text-muted text-balance">{children}</p>
      {action && <div className="mt-1">{action}</div>}
    </Card>
  )
}
