import { describe, expect, it } from 'vitest'
import type { Json } from './database.types'
import { blockSettings, fromTimeField, groupBlocks, measureOf, orderWithAfter, supersetOf, toTimeField, withSettings } from './blocks'

const block = (id: string, settings: Json = {}, type = 'exercise') => ({ id, type, settings })

describe('blockSettings', () => {
  it('reads groups and measures, ignoring anything malformed', () => {
    expect(blockSettings(block('a', { group: 'g', measure: 'sec' }))).toEqual({ group: 'g', measure: 'sec' })
    expect(blockSettings(block('a', { group: 3, measure: 'hours' }))).toEqual({ group: undefined, measure: undefined })
    expect(blockSettings(block('a', null))).toEqual({ group: undefined, measure: undefined })
    expect(blockSettings(block('a', ['x']))).toEqual({ group: undefined, measure: undefined })
    expect(measureOf(block('a'))).toBe('reps')
  })

  it('changes one key and keeps the rest', () => {
    const b = block('a', { group: 'g', timer: 90 })
    expect(withSettings(b, { measure: 'min' })).toEqual({ group: 'g', timer: 90, measure: 'min' })
    expect(withSettings(b, { group: null })).toEqual({ timer: 90 })
    // Reps is the default, so it isn't stored.
    expect(withSettings(block('a', { measure: 'sec' }), { measure: 'reps' })).toEqual({})
  })
})

describe('time fields', () => {
  it('shows seconds as typed, or minutes to two decimals', () => {
    expect(toTimeField(45, 'sec')).toBe(45)
    expect(toTimeField(90, 'min')).toBe(1.5)
    expect(toTimeField(100, 'min')).toBe(1.67)
    expect(toTimeField(null, 'min')).toBeNull()
  })

  it('stores whole seconds', () => {
    expect(fromTimeField(1.5, 'min')).toBe(90)
    expect(fromTimeField(1.67, 'min')).toBe(100)
    expect(fromTimeField(45.4, 'sec')).toBe(45)
    expect(fromTimeField(null, 'sec')).toBeNull()
  })
})

describe('groupBlocks', () => {
  it('pairs consecutive exercises sharing a group', () => {
    const units = groupBlocks([block('a', { group: 'g' }), block('b', { group: 'g' }), block('c')])
    expect(units.map((u) => (u.kind === 'group' ? u.blocks.map((b) => b.id) : u.block.id))).toEqual([['a', 'b'], 'c'])
  })

  it('treats a group left on one block as a single block', () => {
    const units = groupBlocks([block('a', { group: 'g' }), block('b'), block('c', { group: 'h' })])
    expect(units.every((u) => u.kind === 'single')).toBe(true)
  })

  it('splits a group at anything between, and never groups text', () => {
    const units = groupBlocks([
      block('a', { group: 'g' }),
      block('t', { group: 'g' }, 'text'),
      block('b', { group: 'g' }),
      block('c', { group: 'g' }),
    ])
    expect(units.map((u) => u.kind)).toEqual(['single', 'single', 'group'])
    // The same group showing twice still gets distinct keys.
    const twice = groupBlocks([block('a', { group: 'g' }), block('b', { group: 'g' }), block('x'), block('c', { group: 'g' }), block('d', { group: 'g' })])
    expect(new Set(twice.map((u) => u.key)).size).toBe(twice.length)
  })

  it('finds the superset a block is in', () => {
    const blocks = [block('a', { group: 'g' }), block('b', { group: 'g' }), block('c', { group: 'g' }), block('d')]
    expect(supersetOf(blocks, 'b')?.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(supersetOf(blocks, 'd')).toBeNull()
  })
})

describe('orderWithAfter', () => {
  it('moves or adds an id directly after another', () => {
    expect(orderWithAfter(['a', 'b', 'c'], 'x', 'a')).toEqual(['a', 'x', 'b', 'c'])
    expect(orderWithAfter(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(orderWithAfter(['a', 'b'], 'x', 'missing')).toEqual(['a', 'b', 'x'])
  })
})
