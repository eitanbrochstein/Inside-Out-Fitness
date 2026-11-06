import { useNavigate } from 'react-router'
import { useProfile } from '@/data/useProfile'
import { SegmentedControl } from '@/ui/SegmentedControl'

type Mode = 'personal' | 'coaching'

/** Personal / Coaching toggle. Only coaches see it; everyone else gets the plain subtitle. */
export function ModeSwitch({ value }: { value: Mode }) {
  const navigate = useNavigate()
  const isCoach = useProfile().data?.is_coach
  if (!isCoach) return <>Personal mode</>
  return (
    <SegmentedControl<Mode>
      aria-label="Mode"
      className="mt-2 max-w-64"
      value={value}
      onChange={(m) => navigate(m === 'coaching' ? '/coach' : '/', { viewTransition: true })}
      options={[
        { value: 'personal', label: 'Personal' },
        { value: 'coaching', label: 'Coaching' },
      ]}
    />
  )
}
