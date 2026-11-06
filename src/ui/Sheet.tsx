import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { cn } from './cn'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Pinned below the scrolling content (the sheet's main action). */
  footer?: ReactNode
  /** Tall sheets (pickers) get a fixed height so the list can scroll. */
  tall?: boolean
}

/** Bottom sheet used for every secondary flow (pickers, editors, actions). */
export function Sheet({ open, onOpenChange, title, description, children, footer, tall }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-(--z-scrim) bg-scrim" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            'glass-panel fixed inset-x-0 bottom-0 z-(--z-sheet) mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-sheet border-t outline-none',
            tall && 'h-[88dvh]',
          )}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border-strong" />
          <div className="shrink-0 px-5 pt-3 pb-3">
            <Drawer.Title className="font-display text-title-3 font-semibold">{title}</Drawer.Title>
            {description && <Drawer.Description className="mt-1 text-subhead text-muted">{description}</Drawer.Description>}
          </div>
          <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto px-5', !footer && 'pb-safe')}>{children}</div>
          {footer && <div className="pb-safe shrink-0 border-t border-border px-5 pt-3">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/** A full-width row inside an action sheet. */
export function SheetAction({
  icon,
  children,
  onClick,
  danger,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-[52px] w-full select-none items-center gap-3 rounded-tile px-3 text-left text-body font-medium transition-colors duration-150 active:bg-(--glass-press)',
        danger ? 'text-danger' : 'text-text',
      )}
    >
      {icon && (
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-[10px] [&_svg]:size-[18px]',
            danger ? 'bg-danger-soft text-danger' : 'bg-surface-3/70 text-muted',
          )}
        >
          {icon}
        </span>
      )}
      {children}
    </button>
  )
}
