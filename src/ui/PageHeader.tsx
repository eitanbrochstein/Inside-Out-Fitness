import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from './cn'
import { SectionLabel } from './SectionLabel'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: string
  /** Where the back button goes; history back when true. */
  back?: string | true
  actions?: ReactNode
  /** A larger title, lettered in glass (home screens). */
  hero?: boolean
}

export function PageHeader({ title, subtitle, eyebrow, back, actions, hero }: PageHeaderProps) {
  const navigate = useNavigate()
  const goBack = () => {
    if (back === true) {
      if (window.history.state?.idx > 0) navigate(-1)
      else navigate('/', { viewTransition: true })
    } else if (back) navigate(back, { viewTransition: true })
  }

  return (
    <header className="pb-5">
      <div className="flex min-h-11 items-center justify-between">
        {back ? (
          <button
            type="button"
            onClick={goBack}
            className="glass-control flex h-9 select-none items-center gap-0.5 rounded-full pr-3.5 pl-1.5 text-subhead font-semibold text-text active:scale-[0.96]"
          >
            <ChevronLeft className="size-5" strokeWidth={2.2} />
            Back
          </button>
        ) : (
          <SectionLabel>{eyebrow ?? 'Inside Out Training'}</SectionLabel>
        )}
        <div className="-mr-2 flex items-center">{actions}</div>
      </div>
      {back && eyebrow && <SectionLabel className="mt-4">{eyebrow}</SectionLabel>}
      <h1
        className={cn(
          'font-display font-semibold text-balance',
          back && eyebrow ? 'mt-1' : 'mt-3',
          hero ? 'glass-text text-display' : 'text-title',
        )}
      >
        {title}
      </h1>
      {subtitle && <div className="mt-1 text-callout text-muted">{subtitle}</div>}
    </header>
  )
}
