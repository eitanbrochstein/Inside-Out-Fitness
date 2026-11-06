import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { motion } from 'motion/react'
import type { WorkoutDoc } from '@/data/types'
import { formatClock, sessionTotals } from '@/lib/session'
import { spring } from '@/ui/motion'

/** Above the Finish button while training: time since the first set, and sets done so far. */
export function TrainStrip({ doc }: { doc: WorkoutDoc }) {
  const { setsDone, setsTotal } = sessionTotals(doc.workout_blocks)
  const ratio = setsTotal ? setsDone / setsTotal : 0
  return (
    <div className="flex items-center gap-3 px-3 pt-1 pb-2.5">
      <span className="flex w-16 shrink-0 items-center gap-1 text-caption font-semibold text-muted tabular-nums">
        <Timer className="size-3.5" />
        {doc.started_at ? <Elapsed since={doc.started_at} /> : '0:00'}
      </span>
      <span
        role="progressbar"
        aria-label="Sets done"
        aria-valuemin={0}
        aria-valuemax={setsTotal}
        aria-valuenow={setsDone}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent-soft"
      >
        <motion.span
          className="block h-full rounded-full bg-[linear-gradient(90deg,var(--accent-2),var(--accent))]"
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={spring.soft}
        />
      </span>
      <span className="shrink-0 text-caption font-semibold tabular-nums">
        {setsDone}
        <span className="text-faint">/{setsTotal} sets</span>
      </span>
    </div>
  )
}

/** Ticks on its own, so the rest of the page doesn't re-render every second. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return <>{formatClock(now - new Date(since).getTime())}</>
}
