import { describe, it, expect } from 'vitest'
import { createRng } from './rng'

describe('createRng', () => {
  it('produces deterministic sequences from the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('produces different sequences from different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    const valuesA = Array.from({ length: 10 }, () => a.next())
    const valuesB = Array.from({ length: 10 }, () => b.next())
    expect(valuesA).not.toEqual(valuesB)
  })

  it('next() returns values in [0, 1)', () => {
    const rng = createRng(999)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt(min, max) returns integers in [min, max)', () => {
    const rng = createRng(77)
    for (let i = 0; i < 500; i++) {
      const v = rng.nextInt(3, 10)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThan(10)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('shuffle returns a permutation with same elements', () => {
    const rng = createRng(55)
    const original = [1, 2, 3, 4, 5, 6, 7, 8]
    const shuffled = rng.shuffle(original)
    expect(shuffled.sort()).toEqual(original.sort())
  })

  it('shuffle does not mutate the original array', () => {
    const rng = createRng(55)
    const original = [1, 2, 3, 4, 5]
    const copy = [...original]
    rng.shuffle(original)
    expect(original).toEqual(copy)
  })
})
