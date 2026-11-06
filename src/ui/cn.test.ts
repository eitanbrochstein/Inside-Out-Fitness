import { describe, expect, test } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  test('a later class replaces an earlier one that sets the same thing', () => {
    expect(cn('size-11', 'size-10')).toBe('size-10')
    expect(cn('text-primary', 'text-danger')).toBe('text-danger')
    expect(cn('px-5 text-[17px]', 'px-2 text-[15px]')).toBe('px-2 text-[15px]')
  })

  test('knows the type ramp is a size, not a colour', () => {
    expect(cn('text-callout', 'text-muted')).toBe('text-callout text-muted')
    expect(cn('text-callout text-muted', 'text-title')).toBe('text-muted text-title')
    expect(cn('text-[13px]', 'text-footnote')).toBe('text-footnote')
  })

  test('knows the radius, shadow, font and safe-area tokens', () => {
    expect(cn('rounded-card', 'rounded-full')).toBe('rounded-full')
    expect(cn('shadow-card', 'shadow-none')).toBe('shadow-none')
    expect(cn('font-sans', 'font-display')).toBe('font-display')
    expect(cn('font-display font-semibold')).toBe('font-display font-semibold')
    expect(cn('pb-safe', 'pb-4')).toBe('pb-4')
    expect(cn('pt-safe', 'p-0')).toBe('p-0')
  })

  test('skips falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
})
