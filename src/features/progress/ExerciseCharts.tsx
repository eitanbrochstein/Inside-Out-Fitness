import { Area, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MAX_LABEL, type MaxKind, type SetLogRow, type TrainingMax } from '@/data/types'
import { repRangeBuckets } from '@/lib/insights'
import { formatNumber, toDisplay, type Unit } from '@/lib/load'
import { BarList } from '@/ui/charts/BarList'
import { ChartTooltip, Swatch } from '@/ui/charts/kit'
import { axisTick, gradient, shortDate, useChartAnimation } from '@/ui/charts/shared'
import type { TrendPoint } from './trend'

const MAX_COLOR = 'var(--muted)'

const yDomain = [(min: number) => Math.max(0, Math.floor((min * 0.9) / 5) * 5), (max: number) => Math.ceil((max * 1.05) / 5) * 5] as [
  (v: number) => number,
  (v: number) => number,
]

/** A session's dot: gold with a ring for a record, otherwise the accent. */
function TrendDot(props: { cx?: number; cy?: number; payload?: TrendPoint }) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || payload?.value == null) return null
  return payload.pr ? (
    <circle cx={cx} cy={cy} r={6} strokeWidth={2} className="fill-pr stroke-surface" />
  ) : (
    <circle cx={cx} cy={cy} r={4} strokeWidth={2} className="fill-accent stroke-surface" />
  )
}

/** Estimated 1RM per session (reps for bodyweight), the stored 1RM as a dashed step, records in gold. */
export function TrendChart({ data, bodyweight, unit }: { data: TrendPoint[]; bodyweight: boolean; unit: Unit }) {
  const animate = useChartAnimation()
  const hasMax = data.some((d) => d.max != null)
  const hasPR = data.some((d) => d.pr)
  const valueLabel = bodyweight ? 'Top set reps' : 'Estimated 1RM'
  const suffix = bodyweight ? '' : ` ${unit}`

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 text-caption text-muted">
        <span className="flex items-center gap-1.5">
          <Swatch color="var(--accent)" />
          {valueLabel}
        </span>
        {hasMax && (
          <span className="flex items-center gap-1.5">
            <Swatch color={MAX_COLOR} dashed />
            Stored 1RM
          </span>
        )}
        {hasPR && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-pr" />
            Record
          </span>
        )}
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={shortDate}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis domain={yDomain} tick={axisTick} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={(p) => {
                const d = p.payload?.[0]?.payload as TrendPoint | undefined
                if (!d) return null
                return (
                  <ChartTooltip
                    active={p.active}
                    title={`${shortDate(d.t)}${d.pr ? ' · Record' : ''}`}
                    rows={[
                      ...(d.value != null ? [{ color: 'var(--accent)', label: valueLabel, value: `${formatNumber(d.value)}${suffix}` }] : []),
                      ...(!bodyweight && d.top != null ? [{ label: 'Top set', value: `${formatNumber(d.top)} × ${d.topReps}` }] : []),
                      ...(d.max != null ? [{ color: MAX_COLOR, dashed: true, label: 'Stored 1RM', value: `${formatNumber(d.max)} ${unit}` }] : []),
                    ]}
                  />
                )
              }}
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--accent)"
              strokeWidth={2}
              fill={gradient.area}
              dot={<TrendDot />}
              activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={animate}
            />
            {hasMax && (
              <Line
                dataKey="max"
                type="stepAfter"
                stroke={MAX_COLOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={animate}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** How each stored max has moved: the 1RM in the accent, the training max dashed. */
export function MaxHistoryChart({ maxes, unit }: { maxes: TrainingMax[]; unit: Unit }) {
  const animate = useChartAnimation()
  const kinds = (['one_rm', 'training_max'] as const).filter((k) => maxes.filter((m) => m.kind === k).length > 1)
  if (!kinds.length) return null
  const days = [...new Set(maxes.map((m) => m.recorded_on))].sort()
  // Step lines need each kind's value carried forward to every date.
  const data = days.map((day) => {
    const row: Record<string, number | null> = { t: new Date(`${day}T12:00:00`).getTime() }
    for (const k of kinds) {
      const m = maxes.filter((x) => x.kind === k && x.recorded_on <= day).sort((a, b) => b.recorded_on.localeCompare(a.recorded_on))[0]
      row[k] = m ? toDisplay(m.value_kg, unit) : null
    }
    return row
  })
  const color = (k: MaxKind) => (k === 'one_rm' ? 'var(--accent)' : MAX_COLOR)

  return (
    <div>
      {kinds.length > 1 && (
        <div className="flex gap-4 px-2 text-caption text-muted">
          {kinds.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <Swatch color={color(k)} dashed={k === 'training_max'} />
              {MAX_LABEL[k]}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={yDomain} tick={axisTick} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={(p) => (
                <ChartTooltip
                  active={p.active}
                  title={p.label != null ? shortDate(Number(p.label)) : ''}
                  rows={kinds.flatMap((k) => {
                    const v = p.payload?.[0]?.payload?.[k] as number | null | undefined
                    return v == null ? [] : [{ color: color(k), dashed: k === 'training_max', label: MAX_LABEL[k], value: `${formatNumber(v)} ${unit}` }]
                  })}
                />
              )}
            />
            {kinds.map((k) => (
              <Line
                key={k}
                dataKey={k}
                type="stepAfter"
                stroke={color(k)}
                strokeWidth={2}
                strokeDasharray={k === 'training_max' ? '5 4' : undefined}
                dot={{ r: 4, fill: color(k), stroke: 'var(--surface)', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={animate}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Sets by rep range: where the training sits between strength and endurance. */
export function RepRanges({ log }: { log: SetLogRow[] }) {
  const buckets = repRangeBuckets(log)
  const total = buckets.reduce((n, b) => n + b.count, 0)
  if (!total) return null
  return (
    <BarList
      label="Sets by rep range"
      items={buckets.map((b) => ({ key: b.label, label: `${b.label} reps`, value: b.count, display: String(b.count) }))}
    />
  )
}
