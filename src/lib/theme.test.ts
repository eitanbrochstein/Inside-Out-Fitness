import { describe, expect, test } from 'vitest'
import { normalizeAccent, normalizeTheme, resolveAccent, resolveTheme } from './theme'

describe('normalizeTheme', () => {
  test('maps the old light and dark settings to named themes', () => {
    expect(normalizeTheme('dark')).toBe('midnight')
    expect(normalizeTheme('light')).toBe('daylight')
  })

  test('keeps system and known themes; anything else is Midnight', () => {
    expect(normalizeTheme('system')).toBe('system')
    expect(normalizeTheme('chalk')).toBe('chalk')
    expect(normalizeTheme('neon')).toBe('midnight')
    expect(normalizeTheme(null)).toBe('midnight')
  })
})

test('normalizeAccent falls back to the theme’s own', () => {
  expect(normalizeAccent('rose')).toBe('rose')
  expect(normalizeAccent('gold')).toBe('theme')
  expect(normalizeAccent(undefined)).toBe('theme')
})

test('resolveTheme follows the OS for system', () => {
  expect(resolveTheme('system', true)).toBe('midnight')
  expect(resolveTheme('system', false)).toBe('daylight')
  expect(resolveTheme('ember', false)).toBe('ember')
})

test('resolveAccent uses the theme’s own unless one is chosen', () => {
  expect(resolveAccent('theme', 'carbon')).toBe('volt')
  expect(resolveAccent('theme', 'chalk')).toBe('emerald')
  expect(resolveAccent('violet', 'carbon')).toBe('violet')
})
