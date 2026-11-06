// Dates: `scheduled_for` is a local calendar date (YYYY-MM-DD); timestamps are ISO strings.

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayISO = () => toISODate(new Date())

export function parseISODate(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const dayDiff = (a: Date, b: Date) =>
  Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 86_400_000)

export function formatDay(date: Date, opts: { relative?: boolean } = {}) {
  if (opts.relative) {
    const diff = dayDiff(date, new Date())
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff === -1) return 'Yesterday'
  }
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export const formatScheduled = (value: string) => formatDay(parseISODate(value), { relative: true })
export const formatTimestamp = (iso: string, relative = true) => formatDay(new Date(iso), { relative })

/** "Today" → "today" mid-sentence; dates stay as they are. */
export const lowerRelative = (day: string) => (/^(Today|Yesterday|Tomorrow)$/.test(day) ? day.toLowerCase() : day)
