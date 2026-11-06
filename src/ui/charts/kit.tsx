// The chart tooltip and legend. Values lead in the tooltip; series are keyed by a short line of
// their colour, and text stays in text tokens.

export function ChartTooltip({
  active,
  title,
  rows,
}: {
  active?: boolean
  title: string
  rows: { color?: string; label: string; value: string; dashed?: boolean }[]
}) {
  if (!active || rows.length === 0) return null
  return (
    <div className="glass-panel min-w-36 rounded-tile border px-3 py-2.5 text-footnote">
      <div className="mb-1.5 text-muted">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5">
          {r.color ? <Swatch color={r.color} dashed={r.dashed} /> : <span className="w-3.5 shrink-0" />}
          <span className="font-semibold text-text tabular-nums">{r.value}</span>
          <span className="ml-auto pl-3 text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return dashed ? (
    <svg width="14" height="4" aria-hidden className="shrink-0">
      <line x1="0" y1="2" x2="14" y2="2" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  ) : (
    <span aria-hidden className="h-[3px] w-3.5 shrink-0 rounded-full" style={{ background: color }} />
  )
}

export function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <Swatch color={i.color} dashed={i.dashed} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
