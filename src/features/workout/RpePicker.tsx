import { rpeLabel } from '@/lib/format'
import { tick } from '@/lib/haptics'
import { cn } from '@/ui/cn'

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1)

/** Session RPE, 1–10: how hard the whole workout felt. Tapping the chosen number again clears it. */
export function RpePicker({ value, onChange }: { value: number | null; onChange: (rpe: number | null) => void }) {
  return (
    <div>
      <div role="radiogroup" aria-label="Session RPE, 1 to 10" className="grid grid-cols-5 gap-1.5 min-[420px]:grid-cols-10 min-[420px]:gap-1">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}, ${rpeLabel(n)}`}
            onClick={() => {
              tick()
              onChange(value === n ? null : n)
            }}
            className={cn(
              'h-11 select-none rounded-tile text-callout font-semibold tabular-nums transition-transform active:scale-[0.94]',
              value === n ? 'glass-tint' : 'glass-control text-muted',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-2 text-footnote text-muted" aria-live="polite">
        {value != null ? (
          <>
            <span className="font-semibold text-text">RPE {value}</span> · {rpeLabel(value)}
          </>
        ) : (
          '1 is very light, 10 is everything you had.'
        )}
      </p>
    </div>
  )
}
