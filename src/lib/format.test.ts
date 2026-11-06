import { expect, test } from 'vitest'
import { formatChange, formatCompact, formatVolume, plural } from './format'

test('plural', () => {
  expect(plural(1, 'set')).toBe('1 set')
  expect(plural(3, 'set')).toBe('3 sets')
  expect(plural(2, 'max', 'maxes')).toBe('2 maxes')
})

test('formatCompact', () => {
  expect(formatCompact(950)).toBe('950')
  expect(formatCompact(1234)).toBe('1.2K')
  expect(formatCompact(12_449)).toBe('12.4K')
})

test('formatVolume converts to the display unit', () => {
  expect(formatVolume(1000, 'kg')).toBe('1K kg')
  expect(formatVolume(1000, 'lb')).toBe('2.2K lb')
})

test('formatChange', () => {
  expect(formatChange(0.124)).toBe('+12%')
  expect(formatChange(-0.08)).toBe('−8%')
})
