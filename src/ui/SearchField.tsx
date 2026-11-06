import { Search, X } from 'lucide-react'
import { cn } from './cn'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoFocus?: boolean
  className?: string
}

export function SearchField({ value, onChange, placeholder, autoFocus, className }: SearchFieldProps) {
  return (
    <label className={cn('glass-field flex h-11 items-center gap-2 rounded-field pr-1 pl-3 text-faint', className)}>
      <Search className="size-[18px] shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoCorrect="off"
        autoFocus={autoFocus}
        className="h-full min-w-0 flex-1 bg-transparent text-text outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-faint active:text-text"
        >
          <X className="size-4" />
        </button>
      )}
    </label>
  )
}
