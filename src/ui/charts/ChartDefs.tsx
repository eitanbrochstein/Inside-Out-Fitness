/** Gradients for every chart, defined once (ids are page-wide) and following the theme. */
export function ChartDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <linearGradient id="accent-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.24 }} />
          <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id="accent-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--accent-2)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--accent)' }} />
        </linearGradient>
        <linearGradient id="accent-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--accent-2)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--accent)' }} />
        </linearGradient>
      </defs>
    </svg>
  )
}
