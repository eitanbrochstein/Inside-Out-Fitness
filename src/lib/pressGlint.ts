/** What lights up when pressed (src/styles/materials.css). */
const GLASS = '.glass-control, .glass-tint, [data-interactive]'

/**
 * Lights glass where it's touched: on press, sets --gx/--gy (the glint's centre) and
 * data-pressed on the control under the finger, holding it briefly so a quick tap still shows.
 * A mouse moves the glint as it hovers. One set of listeners for the whole app; returns a cleanup.
 */
export function installPressGlint(win: Window = window) {
  let pressed: HTMLElement | null = null
  let release = 0
  let frame = 0
  let hover: PointerEvent | null = null

  const glassAt = (event: Event) => (event.target instanceof Element ? event.target.closest<HTMLElement>(GLASS) : null)
  const place = (el: HTMLElement, event: PointerEvent) => {
    const box = el.getBoundingClientRect()
    el.style.setProperty('--gx', `${Math.round(event.clientX - box.left)}px`)
    el.style.setProperty('--gy', `${Math.round(event.clientY - box.top)}px`)
  }

  const onDown = (event: PointerEvent) => {
    const el = glassAt(event)
    if (!el || el.matches(':disabled')) return
    win.clearTimeout(release)
    pressed?.removeAttribute('data-pressed')
    pressed = el
    place(el, event)
    el.setAttribute('data-pressed', '')
  }
  const onUp = () => {
    const el = pressed
    if (!el) return
    pressed = null
    release = win.setTimeout(() => el.removeAttribute('data-pressed'), 120)
  }
  // The browser took the touch for a scroll: no lingering light.
  const onCancel = () => {
    pressed?.removeAttribute('data-pressed')
    pressed = null
  }
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    hover = event
    frame ||= win.requestAnimationFrame(() => {
      frame = 0
      const el = hover && glassAt(hover)
      if (el && hover) place(el, hover)
    })
  }

  win.addEventListener('pointerdown', onDown, { capture: true, passive: true })
  win.addEventListener('pointerup', onUp, { capture: true, passive: true })
  win.addEventListener('pointercancel', onCancel, { capture: true, passive: true })
  win.addEventListener('pointermove', onMove, { passive: true })
  return () => {
    win.removeEventListener('pointerdown', onDown, { capture: true })
    win.removeEventListener('pointerup', onUp, { capture: true })
    win.removeEventListener('pointercancel', onCancel, { capture: true })
    win.removeEventListener('pointermove', onMove)
    win.cancelAnimationFrame(frame)
    win.clearTimeout(release)
  }
}
