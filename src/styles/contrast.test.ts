import { describe, expect, test } from 'vitest'
import { ACCENTS, THEMES } from '@/lib/theme'
import { blockFor } from './themeBlocks'

// WCAG 2 contrast for every theme, and for every accent on every theme.

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const hex = (decls: Map<string, string> | undefined, token: string) => {
  const value = decls?.get(token)
  if (!value || !/^#[0-9a-f]{6}$/.test(value)) throw new Error(`${token} is not a 6-digit hex: ${value}`)
  return value
}

/** Each pair that falls short, as "fg on bg 3.21 < 4.5". */
function failures(decls: Map<string, string> | undefined, pairs: [string, string, number][], extra?: Map<string, string>) {
  const get = (t: string) => (extra?.has(t) ? hex(extra, t) : hex(decls, t))
  return pairs
    .map(([fg, bg, min]) => [fg, bg, min, contrast(get(fg), get(bg))] as const)
    .filter(([, , min, ratio]) => ratio < min)
    .map(([fg, bg, min, ratio]) => `${fg} on ${bg} ${ratio.toFixed(2)} < ${min}`)
}

const SURFACES = ['--surface', '--surface-2', '--bg']

describe.each(THEMES.map((t) => [t.id] as const))('%s', (id) => {
  const theme = blockFor(`[data-scheme='${id}']`)?.decls

  test('text, status and chart colours', () => {
    const pairs: [string, string, number][] = SURFACES.flatMap((s) => [
      ['--text', s, 7],
      ['--muted', s, 4.5],
      ['--faint', s, 3],
      ['--danger', s, 4.5],
      ['--warn', s, 3],
      ['--success', s, 3],
      ['--pr', s, 3],
    ] as [string, string, number][])
    pairs.push(['--on-danger', '--danger', 4.5])
    expect(failures(theme, pairs)).toEqual([])
  })

  test.each(ACCENTS.map((a) => [a.id] as const))('with %s', (accentId) => {
    const mode = THEMES.find((t) => t.id === id)!.mode
    const accent = blockFor(mode === 'dark' ? `[data-accent='${accentId}']` : `[data-theme='light'][data-accent='${accentId}']`)?.decls
    const pairs: [string, string, number][] = SURFACES.flatMap((s) => [
      ['--accent-text', s, 4.5],
      ['--accent', s, 3],
    ] as [string, string, number][])
    pairs.push(['--on-accent', '--accent-fill', 4.5])
    expect(failures(theme, pairs, accent)).toEqual([])

    // The label sits over the whole gradient: hold it to 3:1 (large-text level) at every stop.
    const on = hex(accent, '--on-accent')
    const stops = [...(accent?.get('--accent-gradient') ?? '').matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0])
    expect(stops).toHaveLength(3)
    expect(stops.filter((s) => contrast(on, s) < 3)).toEqual([])
  })
})
