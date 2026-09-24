import { describe, expect, it } from 'vitest'
import { advance, buildOrder, extendOrder, nextRepeatMode } from './queue'

const all = () => true

describe('buildOrder', () => {
  it('is the identity when not shuffled', () => {
    expect(buildOrder(4, false, 2)).toEqual([0, 1, 2, 3])
  })

  it('is a permutation with the start index first when shuffled', () => {
    const order = buildOrder(50, true, 17)
    expect(order[0]).toBe(17)
    expect([...order].sort((a, b) => a - b)).toEqual(buildOrder(50, false))
  })

  it('handles empty lists', () => {
    expect(buildOrder(0, true, 0)).toEqual([])
  })
})

describe('extendOrder', () => {
  it('appends the new indices after the existing order', () => {
    expect(extendOrder([2, 0, 1], 5, false)).toEqual([2, 0, 1, 3, 4])
  })

  it('shuffles only the new indices', () => {
    const extended = extendOrder([2, 0, 1], 10, true)
    expect(extended.slice(0, 3)).toEqual([2, 0, 1])
    expect(extended.slice(3).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9])
  })

  it('returns the same order when nothing was added', () => {
    const order = [1, 0]
    expect(extendOrder(order, 2, true)).toBe(order)
  })
})

describe('advance', () => {
  const order = [0, 1, 2, 3]

  it('moves forward and back', () => {
    expect(advance({ order, position: 1, direction: 1, repeat: 'off', isPlayable: all })).toBe(2)
    expect(advance({ order, position: 1, direction: -1, repeat: 'off', isPlayable: all })).toBe(0)
  })

  // The Angular version ran off the end of the list here and tried to play `undefined`.
  it('stops at either end when repeat is off', () => {
    expect(advance({ order, position: 3, direction: 1, repeat: 'off', isPlayable: all })).toBeNull()
    expect(advance({ order, position: 0, direction: -1, repeat: 'off', isPlayable: all })).toBeNull()
  })

  it('wraps around when repeating', () => {
    expect(advance({ order, position: 3, direction: 1, repeat: 'all', isPlayable: all })).toBe(0)
    expect(advance({ order, position: 0, direction: -1, repeat: 'one', isPlayable: all })).toBe(3)
  })

  it('skips unplayable tracks', () => {
    const isPlayable = (i: number) => i !== 1 && i !== 2
    expect(advance({ order, position: 0, direction: 1, repeat: 'off', isPlayable })).toBe(3)
    expect(advance({ order, position: 3, direction: -1, repeat: 'off', isPlayable })).toBe(0)
  })

  it('follows the shuffled order, not track indices', () => {
    expect(advance({ order: [3, 0, 2, 1], position: 0, direction: 1, repeat: 'off', isPlayable: all })).toBe(1)
  })

  it('returns null when nothing is playable', () => {
    expect(advance({ order, position: 0, direction: 1, repeat: 'all', isPlayable: () => false })).toBeNull()
  })
})

describe('nextRepeatMode', () => {
  it('cycles off → all → one → off', () => {
    expect(nextRepeatMode('off')).toBe('all')
    expect(nextRepeatMode('all')).toBe('one')
    expect(nextRepeatMode('one')).toBe('off')
  })
})
