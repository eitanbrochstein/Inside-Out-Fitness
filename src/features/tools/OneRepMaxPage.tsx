import { useState } from 'react'
import { Check, Save } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ExercisePickerSheet } from '@/features/exercises/ExercisePickerSheet'
import { MaxSheet } from '@/features/exercises/MaxSheet'
import { useExerciseMap } from '@/data/useExercises'
import { useUnits } from '@/data/useProfile'
import { formatNumber, roundToIncrement } from '@/lib/load'
import { estimateAll, FORMULAS, MAX_REPS, RELIABLE_REPS } from '@/lib/oneRepMax'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { cn } from '@/ui/cn'
import { NumberField } from '@/ui/NumberField'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'

const AVERAGE = 'average'
const METHOD_KEY = 'one-rep-max-method'
const PERCENTS = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50]

const methodName = (id: string) => (id === AVERAGE ? 'Average' : (FORMULAS.find((f) => f.id === id)?.name ?? 'Average'))

/** The headline formula is remembered on this device only. */
function readMethod() {
  try {
    const saved = localStorage.getItem(METHOD_KEY)
    if (saved && (saved === AVERAGE || FORMULAS.some((f) => f.id === saved))) return saved
  } catch {
    // Storage can be blocked; the average is a fine default.
  }
  return AVERAGE
}

function saveMethod(id: string) {
  try {
    localStorage.setItem(METHOD_KEY, id)
  } catch {
    // Not remembered this time.
  }
}

const positive = (raw: string | null) => {
  const v = Number(raw?.replace(',', '.'))
  return raw && Number.isFinite(v) && v > 0 ? v : null
}
const wholeReps = (raw: string | null) => {
  const v = Number(raw)
  return raw && Number.isInteger(v) && v >= 1 ? v : null
}
const oneDecimal = (x: number) => formatNumber(Math.round(x * 10) / 10)

/**
 * Estimated 1RM from a set by ten formulas. `?exercise=` names the exercise to save a max for, and
 * `?w=` (in your unit) and `?r=` fill in the set.
 */
export function OneRepMaxPage() {
  const [params] = useSearchParams()
  const exercises = useExerciseMap()
  const { unit, rounding } = useUnits()
  const [weight, setWeight] = useState(() => positive(params.get('w')))
  const [reps, setReps] = useState(() => wholeReps(params.get('r')))
  const [method, setMethod] = useState(readMethod)
  const [picking, setPicking] = useState(false)
  const [maxSheet, setMaxSheet] = useState<{ open: boolean; exerciseId: string | null; n: number }>({
    open: false,
    exerciseId: null,
    n: 0,
  })

  const exercise = exercises.get(params.get('exercise') ?? '')
  const perHand = exercise?.load_basis === 'per_hand'
  const unitLabel = `${unit}${perHand ? ' / hand' : ''}`
  const est = weight != null && reps != null ? estimateAll(weight, reps) : null
  const headline = est ? (method === AVERAGE ? est.average : (est.results.find((r) => r.id === method)?.value ?? est.average)) : null

  const choose = (id: string) => {
    setMethod(id)
    saveMethod(id)
  }
  const openMaxSheet = (exerciseId: string) => setMaxSheet({ open: true, exerciseId, n: Date.now() })

  return (
    <Page>
      <PageHeader back eyebrow="Tools" title="1RM calculator" subtitle={exercise?.name ?? 'Estimate your max from a set'} />

      <Card className="p-4">
        <div className="flex items-end gap-3">
          <label className="min-w-0 flex-[3]">
            <span className="mb-1.5 block text-caption font-semibold text-muted">Weight ({unitLabel})</span>
            <NumberField
              aria-label={`Weight in ${unit}`}
              value={weight}
              onCommit={(v) => setWeight(v != null && v > 0 ? v : null)}
              onKeyUp={(e) => setWeight(positive((e.target as HTMLInputElement).value))}
              placeholder="0"
              className="h-14 text-title-2 font-bold"
            />
          </label>
          <span className="pb-4 text-title-3 font-semibold text-faint" aria-hidden>
            ×
          </span>
          <label className="min-w-0 flex-[2]">
            <span className="mb-1.5 block text-caption font-semibold text-muted">Reps</span>
            <NumberField
              aria-label="Reps"
              decimals={false}
              value={reps}
              onCommit={(v) => setReps(v != null && v >= 1 ? v : null)}
              onKeyUp={(e) => setReps(wholeReps((e.target as HTMLInputElement).value))}
              placeholder="0"
              className="h-14 text-title-2 font-bold"
            />
          </label>
        </div>
        {reps != null && reps > MAX_REPS && (
          <p className="mt-3 text-footnote text-warn">Up to {MAX_REPS} reps. Past that, a set says little about a single.</p>
        )}
      </Card>

      <Card className="mt-3 p-5" aria-live="polite">
        <div className="text-caption font-semibold text-muted">
          Estimated 1RM · {method === AVERAGE ? 'average of all 10' : methodName(method)}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-display font-semibold tabular-nums">{headline != null ? oneDecimal(headline) : '—'}</span>
          <span className="text-headline font-semibold text-muted">{unitLabel}</span>
        </div>
        <p className="mt-1 text-footnote text-muted tabular-nums">
          {est && reps! > 1
            ? `The ten formulas range ${oneDecimal(est.min)}–${oneDecimal(est.max)} ${unit}.`
            : est
              ? 'A single is already your 1RM.'
              : 'Enter a weight and the reps you did with it.'}
        </p>
        {est && reps! > RELIABLE_REPS && (
          <p className="mt-2 text-footnote text-warn">Above {RELIABLE_REPS} reps the formulas disagree more. Treat it as a rough guide.</p>
        )}
        <Button
          size="lg"
          block
          className="mt-4"
          disabled={headline == null}
          onClick={() => (exercise ? openMaxSheet(exercise.id) : setPicking(true))}
        >
          <Save className="size-5" />
          Save as max
        </Button>
      </Card>

      <SectionLabel className="mt-7 mb-2 px-1">Formulas</SectionLabel>
      <Card className="divide-y divide-border overflow-hidden">
        <FormulaRow
          name="Average"
          blurb="All ten formulas, averaged."
          value={est?.average ?? null}
          selected={method === AVERAGE}
          onSelect={() => choose(AVERAGE)}
        />
        {FORMULAS.map((f) => (
          <FormulaRow
            key={f.id}
            name={f.name}
            blurb={f.blurb}
            value={est?.results.find((r) => r.id === f.id)?.value ?? null}
            selected={method === f.id}
            onSelect={() => choose(f.id)}
          />
        ))}
      </Card>
      <p className="mt-2 px-1 text-footnote text-faint">Tap a formula to use it for the estimate above.</p>

      {headline != null && (
        <>
          <SectionLabel className="mt-7 mb-2 px-1">Percentages</SectionLabel>
          <Card className="grid grid-cols-2 gap-x-6 px-4 py-2">
            {PERCENTS.map((p) => (
              <div key={p} className="flex h-10 items-center justify-between border-b border-border text-callout tabular-nums [&:nth-last-child(-n+2)]:border-b-0">
                <span className="text-muted">{p}%</span>
                <span className="font-semibold">
                  {formatNumber(roundToIncrement((headline * p) / 100, rounding.increment, rounding.mode))} {unit}
                </span>
              </div>
            ))}
          </Card>
          <p className="mt-2 px-1 text-footnote text-faint">
            Rounded to {rounding.increment} {unit}, as in Settings.
          </p>
        </>
      )}

      <ExercisePickerSheet open={picking} onOpenChange={setPicking} title="Save a max for…" onPick={(e) => openMaxSheet(e.id)} />
      {headline != null && (
        <MaxSheet
          key={maxSheet.n}
          open={maxSheet.open}
          onOpenChange={(open) => setMaxSheet((s) => ({ ...s, open }))}
          exerciseId={maxSheet.exerciseId}
          initialValue={roundToIncrement(headline, rounding.increment, 'nearest')}
          note={`Est. from ${formatNumber(weight!)} ${unit} × ${reps} (${methodName(method)})`}
        />
      )}
    </Page>
  )
}

function FormulaRow({
  name,
  blurb,
  value,
  selected,
  onSelect,
}: {
  name: string
  blurb: string
  value: number | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="flex min-h-[60px] w-full select-none items-center gap-3 px-4 py-3 text-left transition-colors duration-150 active:bg-(--glass-press)"
    >
      <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', selected ? 'glass-tint text-on-accent' : 'border border-border-strong')}>
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">{name}</span>
        <span className="mt-0.5 block text-footnote text-muted">{blurb}</span>
      </span>
      <span className={cn('shrink-0 text-callout tabular-nums', selected ? 'font-bold' : 'font-semibold text-muted')}>
        {value != null ? oneDecimal(value) : '—'}
      </span>
    </button>
  )
}
