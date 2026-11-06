import { ClipboardList, House, LineChart, NotebookPen, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink, useLocation } from 'react-router'
import { cn } from './cn'
import { spring } from './motion'

const personalTabs = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/workouts', label: 'Workouts', icon: NotebookPen, end: false },
  { to: '/progress', label: 'Progress', icon: LineChart, end: false },
]

const coachingTabs = [
  { to: '/coach', label: 'Coaching', icon: House, end: true },
  { to: '/coach/clients', label: 'Clients', icon: Users, end: false },
  { to: '/coach/templates', label: 'Templates', icon: ClipboardList, end: false },
]

/** A floating glass capsule; the current tab sits under a lens that slides between them. */
export function TabBar() {
  const { pathname } = useLocation()
  const coaching = pathname.startsWith('/coach')
  const tabs = coaching ? coachingTabs : personalTabs
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-bar) pb-safe px-4"
    >
      <div className="glass-surface pointer-events-auto mx-auto flex h-16 max-w-md gap-1 rounded-full border p-1.5">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            viewTransition
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 select-none flex-col items-center justify-center gap-0.5 rounded-full text-micro font-semibold tracking-normal transition-colors duration-150',
                isActive ? 'text-text' : 'text-faint active:text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId={coaching ? 'tab-lens-coach' : 'tab-lens'}
                    className="glass-lens absolute inset-0 rounded-full"
                    transition={spring.snappy}
                  />
                )}
                <Icon className={cn('relative size-[22px] transition-colors duration-150', isActive && 'text-accent')} />
                <span className="relative">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
