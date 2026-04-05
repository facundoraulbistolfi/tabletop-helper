import { describe, it, expect } from 'vitest'
import { createRng } from './rng'
import { initPopulation, nextGeneration } from './engine'
import { getProblem } from './problems'
import type { ExperimentConfig } from './types'

const baseConfig: ExperimentConfig = {
  problemId: 'target-bitgrid',
  seed: 12345,
  populationSize: 20,
  genomeLength: 16,
  elitismCount: 2,
  selection: { method: 'tournament', k: 3 },
  crossover: { method: 'onePoint', rate: 0.85 },
  mutation: { method: 'bitFlip', ratePerGene: 1 / 16 },
  maxGenerations: 100,
}

describe('initPopulation', () => {
  it('creates a population with the right size and genome length', () => {
    const problem = getProblem('target-bitgrid')!
    const rng = createRng(baseConfig.seed)
    const ctx = problem.buildContext(baseConfig, createRng(baseConfig.seed))
    const pop = initPopulation(baseConfig, problem, ctx, rng)

    expect(pop.generation).toBe(0)
    expect(pop.individuals.length).toBe(baseConfig.populationSize)
    for (const ind of pop.individuals) {
      expect(ind.genome.length).toBe(baseConfig.genomeLength)
    }
  })

  it('same seed produces identical populations', () => {
    const problem = getProblem('target-bitgrid')!
    const rng1 = createRng(baseConfig.seed)
    const ctx1 = problem.buildContext(baseConfig, createRng(baseConfig.seed))
    const pop1 = initPopulation(baseConfig, problem, ctx1, rng1)

    const rng2 = createRng(baseConfig.seed)
    const ctx2 = problem.buildContext(baseConfig, createRng(baseConfig.seed))
    const pop2 = initPopulation(baseConfig, problem, ctx2, rng2)

    for (let i = 0; i < pop1.individuals.length; i++) {
      expect(Array.from(pop1.individuals[i].genome)).toEqual(
        Array.from(pop2.individuals[i].genome),
      )
      expect(pop1.individuals[i].fitness).toBe(pop2.individuals[i].fitness)
    }
  })

  it('all individuals have non-negative fitness', () => {
    const problem = getProblem('target-bitgrid')!
    const rng = createRng(baseConfig.seed)
    const ctx = problem.buildContext(baseConfig, createRng(baseConfig.seed))
    const pop = initPopulation(baseConfig, problem, ctx, rng)

    for (const ind of pop.individuals) {
      expect(ind.fitness).toBeGreaterThanOrEqual(0)
      expect(ind.fitness).toBeLessThanOrEqual(baseConfig.genomeLength)
    }
  })
})

describe('nextGeneration', () => {
  it('advances the generation counter by 1', () => {
    const problem = getProblem('target-bitgrid')!
    const rng = createRng(baseConfig.seed)
    const ctx = problem.buildContext(baseConfig, createRng(baseConfig.seed))
    const pop = initPopulation(baseConfig, problem, ctx, rng)
    const { snapshot } = nextGeneration(pop, baseConfig, problem, ctx, rng)

    expect(snapshot.generation).toBe(1)
    expect(snapshot.individuals.length).toBe(baseConfig.populationSize)
  })

  it('returns valid metrics', () => {
    const problem = getProblem('target-bitgrid')!
    const rng = createRng(baseConfig.seed)
    const ctx = problem.buildContext(baseConfig, createRng(baseConfig.seed))
    const pop = initPopulation(baseConfig, problem, ctx, rng)
    const { metrics } = nextGeneration(pop, baseConfig, problem, ctx, rng)

    expect(metrics.generation).toBe(1)
    expect(metrics.best).toBeGreaterThanOrEqual(metrics.avg)
    expect(metrics.avg).toBeGreaterThanOrEqual(metrics.worst)
    expect(metrics.best).toBeLessThanOrEqual(baseConfig.genomeLength)
    expect(metrics.worst).toBeGreaterThanOrEqual(0)
  })

  it('elitism preserves the best individuals', () => {
    const problem = getProblem('target-bitgrid')!
    const rng = createRng(baseConfig.seed)
    const ctx = problem.buildContext(baseConfig, createRng(baseConfig.seed))
    const pop = initPopulation(baseConfig, problem, ctx, rng)

    const bestBefore = Math.max(...pop.individuals.map(i => i.fitness))
    const { snapshot } = nextGeneration(pop, baseConfig, problem, ctx, rng)
    const bestAfter = Math.max(...snapshot.individuals.map(i => i.fitness))

    expect(bestAfter).toBeGreaterThanOrEqual(bestBefore)
  })

  it('multiple generations improve or maintain best fitness', () => {
    const problem = getProblem('target-bitgrid')!
    const rng = createRng(baseConfig.seed)
    const ctx = problem.buildContext(baseConfig, createRng(baseConfig.seed))
    let pop = initPopulation(baseConfig, problem, ctx, rng)
    let prevBest = Math.max(...pop.individuals.map(i => i.fitness))

    for (let g = 0; g < 20; g++) {
      const result = nextGeneration(pop, baseConfig, problem, ctx, rng)
      pop = result.snapshot
      const currentBest = result.metrics.best
      expect(currentBest).toBeGreaterThanOrEqual(prevBest)
      prevBest = currentBest
    }
  })
})
