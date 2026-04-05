export type Rng = {
  next(): number
  nextInt(min: number, max: number): number
  shuffle<T>(arr: T[]): T[]
}

/**
 * Mulberry32 — fast 32-bit seeded PRNG.
 * Returns values in [0, 1).
 */
export function createRng(seed: number): Rng {
  let s = seed | 0

  function next(): number {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function nextInt(min: number, max: number): number {
    return min + Math.floor(next() * (max - min))
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = nextInt(0, i + 1)
      const tmp = a[i]
      a[i] = a[j]
      a[j] = tmp
    }
    return a
  }

  return { next, nextInt, shuffle }
}
