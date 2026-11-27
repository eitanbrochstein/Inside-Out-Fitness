import { ClipboardList, House, LineChart, NotebookPen, Users, type LucideIcon } from 'lucide-react'
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type AnimationPlaybackControls,
} from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { matchPath, NavLink, useLocation, useNavigate } from 'react-router'
import { selectionChanged, selectionEnd, selectionStart } from '@/lib/haptics'
import { cn } from './cn'
import { spring } from './motion'
import { nearestSlot, rubberBand, type Slot } from './tabLens'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
}

const personalTabs: Tab[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/workouts', label: 'Workouts', icon: NotebookPen, end: false },
  { to: '/progress', label: 'Progress', icon: LineChart, end: false },
]

const coachingTabs: Tab[] = [
  { to: '/coach', label: 'Coaching', icon: House, end: true },
  { to: '/coach/clients', label: 'Clients', icon: Users, end: false },
  { to: '/coach/templates', label: 'Templates', icon: ClipboardList, end: false },
]

/** How far a finger moves before a press becomes a drag. */
const DRAG_THRESHOLD = 6
/** How much the lens swells while held. */
const LIFT = 1.2
/** On release, the lens carries on for this many seconds of its speed before picking a tab. */
const FLICK = 0.08
/** How long after a pointer release its click is swallowed (the release already navigated). */
const CLICK_GRACE_MS = 350

const itemClass =
  'flex flex-1 select-none flex-col items-center justify-center gap-0.5 rounded-full text-micro font-semibold tracking-normal'

function TabContent({ tab, lit }: { tab: Tab; lit: boolean }) {
  const Icon = tab.icon
  return (
    <>
      <Icon className={cn('size-[22px]', lit && 'text-accent')} />
      <span>{tab.label}</span>
    </>
  )
}

interface Gesture {
  id: number
  startX: number
  rowLeft: number
  /** The tab first pressed. */
  press: number
  /** The tab the lens is over now. */
  over: number
  dragging: boolean
}

/**
 * A floating glass capsule with a lens over the current tab, as on iOS 26. A press swells the lens
 * and moves it under the finger; dragging slides it along the bar, and letting go settles it on the
 * nearest tab and goes there. The lens holds a lit copy of the row, lined up with the real one, so
 * whatever it covers reads as chosen, magnified while it's held.
 *
 * Pointer input is handled here (the clicks that follow are swallowed); the links stay real links
 * for the keyboard and VoiceOver.
 */
export function TabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const coaching = pathname.startsWith('/coach')
  const tabs = coaching ? coachingTabs : personalTabs
  const active = tabs.findIndex((tab) => matchPath({ path: tab.to, end: tab.end }, pathname))

  const rowRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [lifted, setLifted] = useState(false)

  const gesture = useRef<Gesture | null>(null)
  const slide = useRef<AnimationPlaybackControls | null>(null)
  const swallowClick = useRef(false)
  const swallowTimer = useRef<number | undefined>(undefined)

  // The lens: where it is, how big, and a stretch along the way it's moving when it moves fast.
  const x = useMotionValue(0)
  const lensWidth = useMotionValue(0)
  const rowWidth = useMotionValue(0)
  const lift = useMotionValue(1)
  /** 1 once the lens has somewhere to be, 0 before the tabs are measured or when no tab is current. */
  const shown = useMotionValue(0)
  const speed = useVelocity(x)
  const stretch = useSpring(
    useTransform(speed, (v) => (reduceMotion ? 0 : Math.min(Math.abs(v) / 4000, 0.18))),
    { stiffness: 400, damping: 30 },
  )
  const scaleX = useTransform(() => lift.get() * (1 + stretch.get()))
  const scaleY = useTransform(() => lift.get() * (1 - stretch.get() / 3))
  const copyX = useTransform(x, (v) => -v)

  // The real row is masked out under the lens, so its unlit icons don't show through the glass.
  const holeStart = useTransform(() => x.get() + (lensWidth.get() * (1 - scaleX.get() * shown.get())) / 2)
  const holeEnd = useTransform(() => x.get() + (lensWidth.get() * (1 + scaleX.get() * shown.get())) / 2)
  const rowMask = useMotionTemplate`linear-gradient(90deg, #000 ${holeStart}px, transparent ${holeStart}px, transparent ${holeEnd}px, #000 ${holeEnd}px)`

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => {
      const next = tabs.map((_, i) => {
        const el = tabRefs.current[i]
        return { left: el?.offsetLeft ?? 0, width: el?.offsetWidth ?? 0 }
      })
      rowWidth.set(row.clientWidth)
      lensWidth.set(next[0]?.width ?? 0)
      setSlots((prev) =>
        prev.length === next.length && prev.every((s, i) => s.left === next[i].left && s.width === next[i].width)
          ? prev
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [tabs, rowWidth, lensWidth])

  const slideTo = useCallback(
    (index: number, instant = false) => {
      const slot = slots[index]
      if (!slot) return
      slide.current?.stop()
      if (instant || reduceMotion) x.jump(slot.left)
      else slide.current = animate(x, slot.left, spring.snappy)
    },
    [slots, reduceMotion, x],
  )

  const setLift = (on: boolean) => {
    setLifted(on)
    if (!reduceMotion) animate(lift, on ? LIFT : 1, spring.snappy)
  }

  // Follow the route. The first placement, a resize and a switch between the personal and coaching
  // tabs jump; a new tab slides. A drag in progress owns the lens.
  const placed = useRef<{ active: number; coaching: boolean } | null>(null)
  useLayoutEffect(() => {
    if (active < 0 || !slots[active] || gesture.current) return
    const prev = placed.current
    placed.current = { active, coaching }
    slideTo(active, !prev || prev.coaching !== coaching || prev.active === active)
  }, [active, coaching, slots, slideTo])

  useEffect(() => () => window.clearTimeout(swallowTimer.current), [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const row = rowRef.current
    if (gesture.current || !e.isPrimary || e.button !== 0 || !row || !slots.length) return
    swallowClick.current = false
    // Keep the moves (and the release) coming even when the pointer leaves the bar.
    e.currentTarget.setPointerCapture(e.pointerId)
    const rowLeft = row.getBoundingClientRect().left
    const press = nearestSlot(e.clientX - rowLeft, slots)
    gesture.current = { id: e.pointerId, startX: e.clientX, rowLeft, press, over: press, dragging: false }
    setLift(true)
    slideTo(press)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    if (!g.dragging) {
      if (Math.abs(e.clientX - g.startX) < DRAG_THRESHOLD) return
      g.dragging = true
      selectionStart()
    }
    const width = slots[g.press].width
    const target = rubberBand(e.clientX - g.rowLeft - width / 2, slots[0].left, slots[slots.length - 1].left)
    slide.current?.stop()
    if (reduceMotion) x.set(target)
    else slide.current = animate(x, target, spring.follow)
    const over = nearestSlot(target + width / 2, slots)
    if (over !== g.over) {
      g.over = over
      selectionChanged()
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    gesture.current = null
    setLift(false)

    // The click that follows this release would navigate again (or, after a drag, to the wrong tab).
    swallowClick.current = true
    window.clearTimeout(swallowTimer.current)
    swallowTimer.current = window.setTimeout(() => (swallowClick.current = false), CLICK_GRACE_MS)

    if (g.dragging) {
      selectionEnd()
      const width = slots[g.press].width
      const target = nearestSlot(x.get() + x.getVelocity() * FLICK + width / 2, slots)
      slideTo(target)
      if (target !== active) navigate(tabs[target].to)
      return
    }
    // A tap: go to that tab, or back to its top level from deeper in it (Workouts › History).
    slideTo(g.press)
    if (g.press !== active || pathname !== tabs[g.press].to) navigate(tabs[g.press].to)
  }

  const onPointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    gesture.current = null
    setLift(false)
    if (g.dragging) selectionEnd()
    if (active >= 0) slideTo(active)
  }

  // Only the bar's own capture ending counts; a link losing the touch's implicit capture to the bar
  // (which happens on every press) bubbles up here too.
  const onLostPointerCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onPointerCancel(e)
  }

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return
    swallowClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  const showLens = slots.length > 0 && (active >= 0 || lifted)
  useLayoutEffect(() => shown.set(showLens ? 1 : 0), [showLens, shown])

  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-bar) pb-safe px-4">
      <div
        className="glass-surface pointer-events-auto mx-auto h-16 max-w-md touch-none select-none rounded-full border p-1.5 [-webkit-touch-callout:none]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onClickCapture={onClickCapture}
      >
        <div ref={rowRef} className="relative h-full">
          <motion.div className="flex h-full gap-1" style={{ maskImage: rowMask, WebkitMaskImage: rowMask }}>
            {tabs.map((tab, i) => (
              <NavLink
                key={tab.to}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                to={tab.to}
                end={tab.end}
                draggable={false}
                className={cn(itemClass, 'text-faint')}
              >
                <TabContent tab={tab} lit={false} />
              </NavLink>
            ))}
          </motion.div>

          <motion.div
            aria-hidden
            data-lifted={lifted || undefined}
            className="glass-lens pointer-events-none absolute inset-y-0 left-0 isolate overflow-hidden rounded-full"
            style={{ x, scaleX, scaleY, width: lensWidth, opacity: shown }}
          >
            <motion.div className="absolute inset-y-0 left-0 flex gap-1 text-text" style={{ x: copyX, width: rowWidth }}>
              {tabs.map((tab) => (
                <div key={tab.to} className={itemClass}>
                  <TabContent tab={tab} lit />
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </nav>
  )
}
