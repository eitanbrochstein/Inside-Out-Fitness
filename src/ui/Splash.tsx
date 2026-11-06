import { useEffect, useState } from 'react'
import { Logo } from './Logo'

/** Shown while the app works out who's signed in; appears only if that takes a moment. */
export function Splash() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div role="status" aria-label="Loading" className="fixed inset-0 grid place-items-center">
      {visible && <Logo className="size-16 animate-pop" />}
    </div>
  )
}
