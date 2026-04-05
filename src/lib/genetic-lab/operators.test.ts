import { describe, it, expect } from 'vitest'
import { createRng } from './rng'
import { selectParent, crossover, mutate } from './operators'
import type { Individual } from './types'

function makeIndividuals(fitnesses: number[]): Individual[] {
  return fitnesses.map((f, i) => ({
    id: i,
    genome: new Uint8Array(4),
    fitness: f,
  }))
}

describe('selectParent', () => {
  it('tournament with k=population always picks the best', () => {
    const individuals = makeIndividuals([1, 5, 3, 2, 4])
    const rng = createRng(42)
    for (let i = 0; i < 50; i++) {
      const idx = selectParent(individuals, { method: 'tournament', k: individuals.length }, rng)
      expect(individuals[idx].fitness).toBe(5)
    }
  })

  it('roulette returns valid indices', () => {
    const individuals = makeIndividuals([10, 20, 30])
    const rng = createRng(42)
    for (let i = 0; i < 100; i++) {
      const idx = selectParent(individuals, { method: 'roulette' }, rng)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(individuals.length)
    }
  })

  it('roulette handles all-zero fitness without crashing', () => {
    const individuals = makeIndividuals([0, 0, 0])
    const rng = createRng(42)
    const idx = selectParent(individuals, { method: 'roulette' }, rng)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(individuals.length)
  })
})

describe('crossover', () => {
  const parentA = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1])
  const parentB = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])

  it('onePoint produces children combining both parents', () => {
    const rng = createRng(42)
    const result = crossover(parentA, parentB, { method: 'onePoint', rate: 1 }, rng)
    expect(result.childA.length).toBe(8)
    expect(result.childB.length).toBe(8)
    expect(result.crossoverPoints.length).toBe(1)
    // Children should have a mix of 0s and 1s
    const sumA = result.childA.reduce((s, v) => s + v, 0)
    expect(sumA).toBeGreaterThan(0)
    expect(sumA).toBeLessThan(8)
  })

  it('twoPoint produces children with swapped middle segment', () => {
    const rng = createRng(42)
    const result = crossover(parentA, parentB, { method: 'twoPoint', rate: 1 }, rng)
    expect(result.crossoverPoints.length).toBe(2)
    expect(result.crossoverPoints[0]).toBeLessThanOrEqual(result.crossoverPoints[1])
  })

  it('rate=0 produces clones', () => {
    const rng = createRng(42)
    const result = crossover(parentA, parentB, { method: 'onePoint', rate: 0 }, rng)
    expect(Array.from(result.childA)).toEqual(Array.from(parentA))
    expect(Array.from(result.childB)).toEqual(Array.from(parentB))
    expect(result.crossoverPoints).toEqual([])
  })

  it('uniform crossover swaps individual genes', () => {
    const rng = createRng(42)
    const result = crossover(parentA, parentB, { method: 'uniform', rate: 1, swapProb: 0.5 }, rng)
    expect(result.childA.length).toBe(8)
    // At least some swaps should have occurred
    const sumA = result.childA.reduce((s, v) => s + v, 0)
    expect(sumA).toBeGreaterThan(0)
    expect(sumA).toBeLessThan(8)
  })
})

describe('mutate', () => {
  it('ratePerGene=0 produces no mutations', () => {
    const genome = new Uint8Array([1, 0, 1, 0, 1, 0])
    const rng = createRng(42)
    const result = mutate(genome, { method: 'bitFlip', ratePerGene: 0 }, rng)
    expect(Array.from(result.genome)).toEqual(Array.from(genome))
    expect(result.mutatedGenes).toEqual([])
  })

  it('ratePerGene=1 flips every gene', () => {
    const genome = new Uint8Array([1, 0, 1, 0, 1, 0])
    const rng = createRng(42)
    const result = mutate(genome, { method: 'bitFlip', ratePerGene: 1 }, rng)
    expect(Array.from(result.genome)).toEqual([0, 1, 0, 1, 0, 1])
    expect(result.mutatedGenes.length).toBe(6)
  })

  it('does not mutate the original genome', () => {
    const genome = new Uint8Array([1, 0, 1, 0])
    const original = new Uint8Array(genome)
    const rng = createRng(42)
    mutate(genome, { method: 'bitFlip', ratePerGene: 0.5 }, rng)
    expect(Array.from(genome)).toEqual(Array.from(original))
  })

  it('mutatedGenes indices correspond to actually flipped bits', () => {
    const genome = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])
    const rng = createRng(42)
    const result = mutate(genome, { method: 'bitFlip', ratePerGene: 0.5 }, rng)
    for (const idx of result.mutatedGenes) {
      expect(result.genome[idx]).toBe(1)
    }
    for (let i = 0; i < genome.length; i++) {
      if (!result.mutatedGenes.includes(i)) {
        expect(result.genome[i]).toBe(0)
      }
    }
  })
})
