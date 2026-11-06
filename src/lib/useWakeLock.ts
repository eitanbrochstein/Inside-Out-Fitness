import { useEffect } from 'react'

/** Keeps the screen awake while `active` (e.g. during Train mode). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock?.release()
      } catch {
        // denied (low battery, unsupported context)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release()
    }
  }, [active])
}
