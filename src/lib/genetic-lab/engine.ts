import type { ExperimentConfig, Individual, PopulationSnapshot, MetricsTick } from './types'
import type { ProblemDefinition, ProblemContext } from './problems'
import type { Rng } from './rng'
import { selectParentPairs, crossover, mutate } from './operators'
import { computeMetrics } from './metrics'

export function initPopulation(
  config: ExperimentConfig,
  problem: ProblemDefinition,
  ctx: ProblemContext,
  rng: Rng,
): PopulationSnapshot {
  const individuals: Individual[] = []
  for (let i = 0; i < config.populationSize; i++) {
    const genome = new Uint8Array(config.genomeLength)
    for (let g = 0; g < config.genomeLength; g++) {
      genome[g] = rng.next() < 0.5 ? 1 : 0
    }
    individuals.push({
      id: i,
      genome,
      fitness: problem.fitness(genome, ctx),
    })
  }
  return { generation: 0, individuals }
}

export function nextGeneration(
  snapshot: PopulationSnapshot,
  config: ExperimentConfig,
  problem: ProblemDefinition,
  ctx: ProblemContext,
  rng: Rng,
): { snapshot: PopulationSnapshot; metrics: MetricsTick } {
  const { individuals } = snapshot
  const nextGen: Individual[] = []
  let nextId = 0

  // Elitism: keep top N individuals unchanged
  const sorted = [...individuals].sort((a, b) => b.fitness - a.fitness)
  const eliteCount = Math.min(config.elitismCount, individuals.length)
  for (let i = 0; i < eliteCount; i++) {
    nextGen.push({ ...sorted[i], id: nextId++, meta: undefined })
  }

  // Fill the rest via selection + crossover + mutation
  const pairsNeeded = Math.ceil((config.populationSize - eliteCount) / 2)
  const pairs = selectParentPairs(individuals, pairsNeeded, config.selection, rng)

  for (const [idxA, idxB] of pairs) {
    const parentA = individuals[idxA]
    const parentB = individuals[idxB]

    const cx = crossover(parentA.genome, parentB.genome, config.crossover, rng)
    const mutA = mutate(cx.childA, config.mutation, rng)
    const mutB = mutate(cx.childB, config.mutation, rng)

    if (nextGen.length < config.populationSize) {
      nextGen.push({
        id: nextId++,
        genome: mutA.genome,
        fitness: problem.fitness(mutA.genome, ctx),
        meta: {
          parentAId: parentA.id,
          parentBId: parentB.id,
          crossoverPoints: cx.crossoverPoints,
          mutatedGenes: mutA.mutatedGenes,
        },
      })
    }
    if (nextGen.length < config.populationSize) {
      nextGen.push({
        id: nextId++,
        genome: mutB.genome,
        fitness: problem.fitness(mutB.genome, ctx),
        meta: {
          parentAId: parentA.id,
          parentBId: parentB.id,
          crossoverPoints: cx.crossoverPoints,
          mutatedGenes: mutB.mutatedGenes,
        },
      })
    }
  }

  const newSnapshot: PopulationSnapshot = {
    generation: snapshot.generation + 1,
    individuals: nextGen,
  }

  return { snapshot: newSnapshot, metrics: computeMetrics(newSnapshot) }
}
