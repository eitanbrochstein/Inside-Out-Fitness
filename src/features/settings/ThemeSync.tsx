import { useEffect, useMemo } from 'react'
import { useProfile } from '@/data/useProfile'
import { type Appearance, applyAppearance, normalizeAccent, normalizeTheme, writeStoredAppearance } from '@/lib/theme'

/** Applies the profile's appearance to <html> and remembers it for the next cold start. */
export function ThemeSync() {
  const profile = useProfile().data
  const theme = profile?.theme
  const accent = profile?.accent
  const glass = profile?.glass
  const appearance = useMemo<Appearance | null>(
    () => (theme ? { theme: normalizeTheme(theme), accent: normalizeAccent(accent), glass: glass ?? true } : null),
    [theme, accent, glass],
  )

  useEffect(() => {
    if (!appearance) return
    applyAppearance(appearance)
    writeStoredAppearance(appearance)
    if (appearance.theme !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const follow = () => applyAppearance(appearance, { animate: true })
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [appearance])

  return null
}
