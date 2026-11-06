import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../cn'
import { gradient } from './shared'

const PAD = 4

/** A smooth path through the points: each corner rounded by a curve through its midpoints. */
function smooth(points: [number, number][]) {
  if (points.length < 2) return ''
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    d += ` Q${x},${y} ${(x + nx) / 2},${(y + ny) / 2}`
  }
  const [lx, ly] = points.at(-1)!
  return `${d} L${lx},${ly}`
}

/** A small trend line from zero, with the latest value marked. */
export function Sparkline({ data, height = 40, label, className }: { data: number[]; height?: number; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const max = Math.max(...data, 0) || 1
  const step = data.length > 1 ? (width - PAD * 2) / (data.length - 1) : 0
  const points = data.map((v, i): [number, number] => [PAD + i * step, PAD + (1 - v / max) * (height - PAD * 2)])
  const line = smooth(points)
  const last = points.at(-1)

  return (
    <div ref={ref} role="img" aria-label={label} className={cn('w-full', className)} style={{ height }}>
      {width > 0 && last && (
        <svg width={width} height={height} aria-hidden className="overflow-visible">
          <path d={`${line} L${last[0]},${height} L${PAD},${height} Z`} style={{ fill: gradient.area }} />
          <path d={line} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: gradient.stroke }} />
          <circle cx={last[0]} cy={last[1]} r={4} strokeWidth={2} className="fill-accent stroke-surface" />
        </svg>
      )}
    </div>
  )
}
