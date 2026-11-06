/**
 * Frosted glass under the iOS status bar, so content scrolling beneath it stays legible. It is as
 * tall as the safe area, so it vanishes where there is none (light themes, desktop); no shadow, or
 * that would show at zero height.
 */
export function StatusBarVeil() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-(--z-veil) h-[env(safe-area-inset-top)] bg-(--glass-fill) [-webkit-backdrop-filter:var(--glass-backdrop)] [backdrop-filter:var(--glass-backdrop)]"
    />
  )
}
