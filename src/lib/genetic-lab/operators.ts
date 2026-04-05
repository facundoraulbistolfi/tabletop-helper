import type { Genome, Individual, SelectionMethod, CrossoverMethod, MutationMethod } from './types'
import type { Rng } from './rng'

// ── Selection ──

function tournamentSelect(individuals: Individual[], k: number, rng: Rng): number {
  const effectiveK = Math.min(k, individuals.length)
  // Sample without replacement for fair tournament
  const indices: number[] = []
  const pool = individuals.map((_, i) => i)
  for (let i = 0; i < effectiveK; i++) {
    const pick = rng.nextInt(0, pool.length)
    indices.push(pool[pick])
    pool[pick] = pool[pool.length - 1]
    pool.pop()
  }

  let bestIdx = indices[0]
  let bestFit = individuals[bestIdx].fitness
  for (let i = 1; i < indices.length; i++) {
    if (individuals[indices[i]].fitness > bestFit) {
      bestIdx = indices[i]
      bestFit = individuals[indices[i]].fitness
    }
  }
  return bestIdx
}

function rouletteSelect(individuals: Individual[], rng: Rng): number {
  const totalFitness = individuals.reduce((sum, ind) => sum + ind.fitness, 0)
  if (totalFitness === 0) return rng.nextInt(0, individuals.length)

  const pick = rng.next() * totalFitness
  let cumulative = 0
  for (let i = 0; i < individuals.length; i++) {
    cumulative += individuals[i].fitness
    if (cumulative >= pick) return i
  }
  return individuals.length - 1
}

export function selectParent(
  individuals: Individual[],
  selection: SelectionMethod,
  rng: Rng,
): number {
  if (selection.method === 'tournament') {
    return tournamentSelect(individuals, selection.k, rng)
  }
  return rouletteSelect(individuals, rng)
}

export function selectParentPairs(
  individuals: Individual[],
  count: number,
  selection: SelectionMethod,
  rng: Rng,
): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const a = selectParent(individuals, selection, rng)
    let b = selectParent(individuals, selection, rng)
    if (individuals.length > 1) {
      while (b === a) b = selectParent(individuals, selection, rng)
    }
    pairs.push([a, b])
  }
  return pairs
}

// ── Crossover ──

export type CrossoverResult = {
  childA: Genome
  childB: Genome
  crossoverPoints: number[]
}

function cloneGenome(g: Genome): Genome {
  return new Uint8Array(g)
}

function onePointCrossover(a: Genome, b: Genome, rng: Rng): CrossoverResult {
  const point = rng.nextInt(1, a.length)
  const childA = new Uint8Array(a.length)
  const childB = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) {
    if (i < point) {
      childA[i] = a[i]
      childB[i] = b[i]
    } else {
      childA[i] = b[i]
      childB[i] = a[i]
    }
  }
  return { childA, childB, crossoverPoints: [point] }
}

function twoPointCrossover(a: Genome, b: Genome, rng: Rng): CrossoverResult {
  let p1 = rng.nextInt(1, a.length)
  let p2 = rng.nextInt(1, a.length)
  if (p1 > p2) [p1, p2] = [p2, p1]
  if (p1 === p2 && p2 < a.length) p2++

  const childA = new Uint8Array(a.length)
  const childB = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) {
    const swap = i >= p1 && i < p2
    childA[i] = swap ? b[i] : a[i]
    childB[i] = swap ? a[i] : b[i]
  }
  return { childA, childB, crossoverPoints: [p1, p2] }
}

function uniformCrossover(a: Genome, b: Genome, swapProb: number, rng: Rng): CrossoverResult {
  const childA = new Uint8Array(a.length)
  const childB = new Uint8Array(a.length)
  const points: number[] = []
  for (let i = 0; i < a.length; i++) {
    if (rng.next() < swapProb) {
      childA[i] = b[i]
      childB[i] = a[i]
      points.push(i)
    } else {
      childA[i] = a[i]
      childB[i] = b[i]
    }
  }
  return { childA, childB, crossoverPoints: points }
}

export function crossover(
  genomeA: Genome,
  genomeB: Genome,
  method: CrossoverMethod,
  rng: Rng,
): CrossoverResult {
  if (rng.next() > method.rate) {
    return {
      childA: cloneGenome(genomeA),
      childB: cloneGenome(genomeB),
      crossoverPoints: [],
    }
  }

  switch (method.method) {
    case 'onePoint':
      return onePointCrossover(genomeA, genomeB, rng)
    case 'twoPoint':
      return twoPointCrossover(genomeA, genomeB, rng)
    case 'uniform':
      return uniformCrossover(genomeA, genomeB, method.swapProb ?? 0.5, rng)
  }
}

// ── Mutation ──

export type MutationResult = {
  genome: Genome
  mutatedGenes: number[]
}

export function mutate(
  genome: Genome,
  method: MutationMethod,
  rng: Rng,
): MutationResult {
  const result = new Uint8Array(genome)
  const mutatedGenes: number[] = []

  for (let i = 0; i < result.length; i++) {
    if (rng.next() < method.ratePerGene) {
      result[i] = result[i] === 0 ? 1 : 0
      mutatedGenes.push(i)
    }
  }

  return { genome: result, mutatedGenes }
}
