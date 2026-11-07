import { syncStatusBar } from './native'

/**
 * Named themes and accents. Each one's colours live in src/styles/themes.css; the script in
 * index.html repeats the id → mode/colour/accent map so the right theme paints before React loads
 * (themes.test.ts keeps the three in step).
 */
export const THEMES = [
  { id: 'midnight', label: 'Midnight', mode: 'dark', accent: 'electric', themeColor: '#070b18' },
  { id: 'carbon', label: 'Carbon', mode: 'dark', accent: 'volt', themeColor: '#050506' },
  { id: 'ember', label: 'Ember', mode: 'dark', accent: 'blaze', themeColor: '#0d0806' },
  { id: 'daylight', label: 'Daylight', mode: 'light', accent: 'electric', themeColor: '#eef2f9' },
  { id: 'chalk', label: 'Chalk', mode: 'light', accent: 'emerald', themeColor: '#f5f2ec' },
] as const

export const ACCENTS = [
  { id: 'electric', label: 'Electric' },
  { id: 'volt', label: 'Volt' },
  { id: 'blaze', label: 'Blaze' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'violet', label: 'Violet' },
  { id: 'rose', label: 'Rose' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']
export type ThemeMode = (typeof THEMES)[number]['mode']
export type ThemePreference = 'system' | ThemeId
export type AccentId = (typeof ACCENTS)[number]['id']
/** 'theme' wears the theme's own accent. */
export type AccentPreference = 'theme' | AccentId

/** What "System" becomes in each OS mode. */
export const SYSTEM_THEMES: Record<ThemeMode, ThemeId> = { dark: 'midnight', light: 'daylight' }

export interface Appearance {
  theme: ThemePreference
  accent: AccentPreference
  glass: boolean
}

export const DEFAULT_APPEARANCE: Appearance = { theme: 'midnight', accent: 'theme', glass: true }

const STORAGE_KEY = 'appearance'

export const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value)
export const isAccentId = (value: unknown): value is AccentId => ACCENTS.some((a) => a.id === value)
export const themeInfo = (id: ThemeId) => THEMES.find((t) => t.id === id)!

/** Reads a stored or legacy value ('light' and 'dark' predate named themes). */
export function normalizeTheme(value: unknown): ThemePreference {
  if (value === 'dark') return 'midnight'
  if (value === 'light') return 'daylight'
  return value === 'system' || isThemeId(value) ? value : DEFAULT_APPEARANCE.theme
}

export const normalizeAccent = (value: unknown): AccentPreference => (isAccentId(value) ? value : 'theme')

export const resolveTheme = (preference: ThemePreference, prefersDark: boolean): ThemeId =>
  preference === 'system' ? SYSTEM_THEMES[prefersDark ? 'dark' : 'light'] : preference

export const resolveAccent = (accent: AccentPreference, theme: ThemeId): AccentId =>
  accent === 'theme' ? themeInfo(theme).accent : accent

export const systemPrefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true

function setMeta(name: string, content: string) {
  document.querySelector(`meta[name="${name}"]`)?.setAttribute('content', content)
}

/**
 * Puts an appearance on <html>: the attributes themes.css keys on, the browser's chrome colour and
 * the status bar (an installed web app reads that at launch, so a change there shows on its next cold start).
 * `animate` cross-fades the change where the browser can; `onApply` runs with it, inside the fade.
 */
export function applyAppearance(appearance: Appearance, { animate = false, onApply }: { animate?: boolean; onApply?: () => void } = {}) {
  const theme = themeInfo(resolveTheme(appearance.theme, systemPrefersDark()))
  const root = document.documentElement
  const apply = () => {
    root.dataset.theme = theme.mode
    root.dataset.scheme = theme.id
    root.dataset.accent = resolveAccent(appearance.accent, theme.id)
    root.dataset.glass = appearance.glass ? 'on' : 'off'
    setMeta('theme-color', theme.themeColor)
    setMeta('apple-mobile-web-app-status-bar-style', theme.mode === 'dark' ? 'black-translucent' : 'default')
    syncStatusBar()
    onApply?.()
  }
  const unchanged =
    root.dataset.scheme === theme.id &&
    root.dataset.accent === resolveAccent(appearance.accent, theme.id) &&
    root.dataset.glass === (appearance.glass ? 'on' : 'off')
  if (animate && !unchanged && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Marks the transition as a theme change, which cross-fades rather than moving the page.
    root.dataset.vt = 'theme'
    document.startViewTransition(apply).finished.finally(() => delete root.dataset.vt)
  } else {
    apply()
  }
}

export function readStoredAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Record<keyof Appearance, unknown>>
      return { theme: normalizeTheme(stored.theme), accent: normalizeAccent(stored.accent), glass: stored.glass !== false }
    }
    const legacy = localStorage.getItem('theme')
    if (legacy) return { ...DEFAULT_APPEARANCE, theme: normalizeTheme(legacy) }
  } catch {
    // storage unavailable or unreadable
  }
  return DEFAULT_APPEARANCE
}

export function writeStoredAppearance(appearance: Appearance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
    localStorage.removeItem('theme')
  } catch {
    // storage unavailable
  }
}
