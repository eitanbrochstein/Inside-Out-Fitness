import { useState, type InputHTMLAttributes } from 'react'
import { cn } from './cn'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  onCommit: (value: number | null) => void
  decimals?: boolean
}

const show = (v: number | null) => (v == null ? '' : String(Math.round(v * 100) / 100))

/** Numeric input that edits a local draft and commits on blur or Enter. Selects its contents on focus. */
export function NumberField({ value, onCommit, decimals = true, className, ...props }: Props) {
  const [draft, setDraft] = useState(show(value))
  const [focused, setFocused] = useState(false)
  const [synced, setSynced] = useState(value)
  if (!focused && value !== synced) {
    setSynced(value)
    setDraft(show(value))
  }

  const commit = () => {
    const trimmed = draft.trim().replace(',', '.')
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (parsed != null && !Number.isFinite(parsed)) {
      setDraft(show(value))
      return
    }
    if (parsed !== value) onCommit(parsed)
  }

  return (
    <input
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(decimals ? /[^\d.,]/g : /\D/g, ''))}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={cn(
        'glass-field h-11 w-full min-w-0 rounded-field px-2 text-center tabular-nums disabled:border-transparent disabled:bg-transparent disabled:bg-none disabled:text-text disabled:shadow-none',
        className,
      )}
      {...props}
    />
  )
}
