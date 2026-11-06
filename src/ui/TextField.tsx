import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from './cn'

interface TextFieldProps extends ComponentProps<'input'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
}

/** A text input set into the page, with an optional label above and hint or error below. */
export function TextField({ label, hint, error, leading, trailing, className, id, ...props }: TextFieldProps) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const note = error ?? hint
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="px-1 text-footnote font-semibold text-muted">
          {label}
        </label>
      )}
      <div className={cn('glass-field flex h-12 items-center gap-2 rounded-field px-3.5', error && 'border-danger', className)}>
        {leading && <span className="flex shrink-0 text-faint">{leading}</span>}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-text outline-none"
          {...props}
        />
        {trailing}
      </div>
      {note && <p className={cn('px-1 text-footnote', error ? 'text-danger' : 'text-muted')}>{note}</p>}
    </div>
  )
}
