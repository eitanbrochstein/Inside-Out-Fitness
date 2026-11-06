import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Debounced save that never loses the last edit: pending values are flushed on blur (call `flush`),
 * unmount, tab hide and page hide.
 */
export function useAutosave<T>(save: (value: T) => void, delay = 500) {
  const saveRef = useRef(save)
  const pending = useRef<{ value: T } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    saveRef.current = save
  })

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const p = pending.current
    pending.current = null
    if (p) saveRef.current(p.value)
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    },
    [delay, flush],
  )

  useEffect(() => {
    const onHide = () => flush()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  return { schedule, flush }
}

/** Local editable copy of a server value that follows the server while the field isn't focused. */
export function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const [synced, setSynced] = useState(value)
  if (!focused && value !== synced) {
    setSynced(value)
    setDraft(value)
  }
  return { draft, setDraft, focused, setFocused }
}
