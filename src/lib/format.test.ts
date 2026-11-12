import { expect, test } from 'vitest'
import { formatChange, formatCompact, formatSetTime, formatVolume, plural, rpeLabel } from './format'

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

test('formatSetTime', () => {
  expect(formatSetTime(45)).toBe('45 sec')
  expect(formatSetTime(90)).toBe('1:30')
  expect(formatSetTime(605)).toBe('10:05')
  expect(formatSetTime(600)).toBe('10 min')
})

test('rpeLabel', () => {
  expect(rpeLabel(1)).toBe('Very light')
  expect(rpeLabel(5)).toBe('Moderate')
  expect(rpeLabel(8)).toBe('Hard')
  expect(rpeLabel(10)).toBe('Max effort')
  expect(rpeLabel(14)).toBe('Max effort')
})
