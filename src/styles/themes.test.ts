import { describe, expect, test } from 'vitest'
import html from '../../index.html?raw'
import { ACCENTS, SYSTEM_THEMES, THEMES } from '@/lib/theme'
import { ACCENT_TOKENS, blockFor, blocks, DERIVED_TOKENS, ids, SOLID_TOKENS, THEME_TOKENS } from './themeBlocks'

const missing = (decls: Map<string, string> | undefined, tokens: string[]) => tokens.filter((t) => !decls?.has(t))

describe('theme blocks', () => {
  test.each(THEMES.map((t) => [t.id, t] as const))('%s declares the full set', (id, theme) => {
    const block = blockFor(`[data-scheme='${id}']`)
    expect(missing(block?.decls, THEME_TOKENS)).toEqual([])
    expect(block?.decls.get('--theme-color')).toBe(theme.themeColor)
    expect(DERIVED_TOKENS.filter((t) => block?.decls.has(t))).toEqual([])
    expect(ACCENT_TOKENS.filter((t) => block?.decls.has(t))).toEqual([])
  })

  test('only the registered themes and accents have CSS', () => {
    expect(ids('data-scheme')).toEqual(new Set(THEMES.map((t) => t.id)))
    expect(ids('data-accent')).toEqual(new Set(ACCENTS.map((a) => a.id)))
  })
})

describe('accent blocks', () => {
  test.each(ACCENTS.map((a) => [a.id] as const))('%s declares the full set on dark and light pages', (id) => {
    const dark = blockFor(`[data-accent='${id}']`)
    const light = blockFor(`[data-theme='light'][data-accent='${id}']`)
    expect(missing(dark?.decls, ACCENT_TOKENS)).toEqual([])
    expect(missing(light?.decls, ACCENT_TOKENS)).toEqual([])
    expect(light?.selectors).toContain(`[data-theme='light'] [data-accent='${id}']:not([data-theme='dark'])`)
  })
})

describe('derived and solid blocks', () => {
  test('the derived block mixes every derived token wherever a theme or accent is set', () => {
    const derived = blocks.find((b) => b.decls.has('--glass-light'))
    expect(derived?.selectors).toEqual([':root', '[data-scheme]', '[data-accent]'])
    expect(missing(derived?.decls, DERIVED_TOKENS)).toEqual([])
  })

  test('glass off and reduced transparency turn the same tokens solid', () => {
    const solid = blocks.filter((b) => b.decls.get('--glass-backdrop') === 'none')
    expect(solid).toHaveLength(2)
    for (const block of solid) expect([...block.decls.keys()].sort()).toEqual([...SOLID_TOKENS].sort())
    expect(solid[0].decls).toEqual(solid[1].decls)
  })
})

describe('index.html', () => {
  const script = html.slice(html.indexOf('var THEMES'), html.indexOf('var a = {}'))

  test('its pre-paint map matches THEMES', () => {
    const entries = [...script.matchAll(/(\w+): \['(dark|light)', '(#[0-9a-f]{6})', '(\w+)'\]/g)].map(([, id, mode, color, accent]) => ({
      id,
      mode,
      themeColor: color,
      accent,
    }))
    expect(entries).toEqual(THEMES.map(({ id, mode, themeColor, accent }) => ({ id, mode, themeColor, accent })))
  })

  test('its system and accent lists match', () => {
    expect(script).toContain(`var SYSTEM = { dark: '${SYSTEM_THEMES.dark}', light: '${SYSTEM_THEMES.light}' }`)
    expect(script).toContain(`var ACCENTS = [${ACCENTS.map((a) => `'${a.id}'`).join(', ')}]`)
  })
})
