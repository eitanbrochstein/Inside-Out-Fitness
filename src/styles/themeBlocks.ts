// Reads src/styles/themes.css for the theme tests.
import css from './themes.css?raw'

export interface Block {
  selectors: string[]
  decls: Map<string, string>
}

/** Every innermost rule in themes.css, comments stripped. */
export const blocks: Block[] = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selectors: selector
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  decls: new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim().replace(/\s+/g, ' ')])),
}))

export const blockFor = (selector: string) => blocks.find((b) => b.selectors.includes(selector))

export const ids = (attribute: string) => new Set([...css.matchAll(new RegExp(`${attribute}='([\\w-]+)'`, 'g'))].map((m) => m[1]))

/** What every theme block declares. */
export const THEME_TOKENS = [
  '--bg', '--bg-top', '--glow', '--surface', '--surface-2', '--surface-3', '--card-fill', '--field-fill',
  '--border', '--border-strong', '--text', '--muted', '--faint',
  '--danger', '--on-danger', '--warn', '--success', '--pr',
  '--grid', '--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-other',
  '--elev-sm', '--elev-card', '--elev-float', '--scrim',
  '--glass-fill', '--glass-panel', '--glass-light-base', '--glass-light-tint',
  '--glass-control-pct', '--glass-press-pct', '--glass-highlight-pct', '--glass-sheen-pct', '--glass-glint-pct',
  '--glass-edge-base', '--glass-edge-tint', '--glass-edge-pct',
  '--glass-shade', '--glass-shadow', '--glass-backdrop', '--glass-text-top', '--glass-text-bottom',
  '--theme-color',
]

/** What every accent block declares, on dark pages and light. */
export const ACCENT_TOKENS = ['--accent', '--accent-2', '--accent-fill', '--accent-gradient', '--accent-text', '--on-accent']

/** Mixed once in the derived block; themes and accents only set what they're mixed from. */
export const DERIVED_TOKENS = [
  '--accent-soft', '--accent-ring', '--accent-bloom', '--danger-soft', '--warn-soft', '--success-soft', '--pr-soft',
  '--app-bg', '--glass-light', '--glass-control', '--glass-press', '--glass-highlight', '--glass-sheen', '--glass-glint',
  '--glass-edge', '--glass-tint-highlight', '--glass-tint-sheen', '--glass-tint-shade',
  '--heat-0', '--heat-1', '--heat-2', '--heat-3', '--heat-4',
]

/** What glass-off and reduced transparency turn solid. */
export const SOLID_TOKENS = [
  '--card-fill', '--glass-fill', '--glass-panel', '--glass-control', '--glass-press', '--glass-edge',
  '--glass-highlight', '--glass-sheen', '--glass-glint', '--glass-shade', '--glass-tint-highlight', '--glass-tint-sheen',
  '--glass-backdrop', '--glass-text-top', '--glass-text-bottom',
]
