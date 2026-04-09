import { describe, expect, it } from 'vitest'

import { BUILTIN_BOT_CONFIGS, buildBotFromConfig, cloneBotConfig, type BotConfig } from './chinchon-bot-presets'
import type { SimulatedGameResult } from './chinchon-arena-sim'
import {
  buildFitnessSummary,
  checkStopCondition,
  computeDiversity,
  crossoverConfigs,
  defaultEvoConfig,
  enforceScoreRulesConstraint,
  evaluateFitness,
  explainGeneChange,
  generateInitialPopulation,
  getChangedGeneRows,
  getGeneValue,
  mutateConfig,
  prepareForExport,
  runEvolution,
  selectParent,
  setGeneValue,
  type FitnessMode,
  type EvoIndividual,
} from './chinchon-evo-lab'
import { createRng } from './genetic-lab/rng'

function makeSeedConfig(): BotConfig {
  return cloneBotConfig(BUILTIN_BOT_CONFIGS[0])
}

function makeAggressiveConfig(): BotConfig {
  const config = cloneBotConfig(BUILTIN_BOT_CONFIGS[5])
  config.draw.structuralPriority = 10
  config.discard.evalScope = 'full'
  config.cut.scoreRules = [
    { minScore: 0, maxResto: 5 },
    { minScore: 25, maxResto: 4 },
    { minScore: 50, maxResto: 3 },
    { minScore: 75, maxResto: 2 },
  ]
  return config
}

function makeIndividuals(configs: BotConfig[]): EvoIndividual[] {
  return configs.map((config, index) => ({
    id: index,
    config,
    fitnessMode: 'games_then_mirror_rounds' as FitnessMode,
    fitness: 500000 + index * 1000,
    gamesPlayed: 20,
    gamesWon: 10 + index,
    roundsPlayed: 120,
    roundsWon: 60 + index,
    mirrorRoundsPlayed: 40,
    mirrorRoundsWon: 20 + index,
    chinchonWins: 2 + index,
    orphanRoundsPlayed: 8,
    gameWinRate: 50 + index,
    roundWinRate: 50 + index,
    mirrorRoundRate: 50 + index,
    primaryRate: 50 + index,
    secondaryRate: 40 + index,
  }))
}

describe('gene helpers', () => {
  it('reads and writes nested gene values', () => {
    const seed = makeSeedConfig()
    expect(getGeneValue(seed, 'draw.structuralPriority')).toBe(seed.draw.structuralPriority)

    const updated = setGeneValue(seed, 'draw.structuralPriority', 9)
    expect(updated.draw.structuralPriority).toBe(9)
    expect(seed.draw.structuralPriority).not.toBe(9)
  })

  it('enforces non-increasing score rules after updates', () => {
    const next = enforceScoreRulesConstraint([
      { minScore: 0, maxResto: 2 },
      { minScore: 25, maxResto: 5 },
      { minScore: 50, maxResto: 4 },
      { minScore: 75, maxResto: 6 },
    ])

    expect(next.map(rule => rule.maxResto)).toEqual([2, 2, 2, 2])
  })

  it('explains changed genes in human terms', () => {
    expect(explainGeneChange('draw.chinchonBias', 3, 7)).toContain('chinchón')
    expect(explainGeneChange('cut.useScoreRules', false, true)).toContain('marcador')
    expect(explainGeneChange('cut.scoreRules.2.maxResto', 2, 4)).toContain('50+')
  })
})

describe('mutation and crossover', () => {
  it('mutates genes within their allowed ranges and keeps score rules constrained', () => {
    const seed = makeSeedConfig()
    const rng = createRng(42)
    const result = mutateConfig(seed, 1, 2, () => rng.next())

    expect(result.mutatedGenes.length).toBeGreaterThan(0)
    expect(result.config.global.temperature).toBeGreaterThanOrEqual(0)
    expect(result.config.global.temperature).toBeLessThanOrEqual(10)
    expect([0, 1]).toContain(result.config.cut.maxFree)
    expect(['fast', 'full']).toContain(result.config.discard.evalScope)
    expect(result.config.cut.scoreRules[0].maxResto).toBeGreaterThanOrEqual(result.config.cut.scoreRules[1].maxResto)
    expect(result.config.cut.scoreRules[1].maxResto).toBeGreaterThanOrEqual(result.config.cut.scoreRules[2].maxResto)
  })

  it('builds children that stay normalized after crossover', () => {
    const left = makeSeedConfig()
    const right = makeAggressiveConfig()
    const rng = createRng(17)
    const [childA, childB] = crossoverConfigs(left, right, 1, () => rng.next())

    expect(childA.draw.structuralPriority).toBeGreaterThanOrEqual(0)
    expect(childA.draw.structuralPriority).toBeLessThanOrEqual(10)
    expect(['fast', 'full']).toContain(childA.discard.evalScope)
    expect([4, 5, 6]).toContain(childA.cut.chinchonThreshold)
    expect(childB.cut.scoreRules[0].maxResto).toBeGreaterThanOrEqual(childB.cut.scoreRules[1].maxResto)
  })

  it('generates a seeded initial population keeping the first individual intact', () => {
    const seed = makeSeedConfig()
    const rng = createRng(9)
    const population = generateInitialPopulation(seed, 6, 0.15, 1.5, () => rng.next())

    expect(population).toHaveLength(6)
    expect(population[0]).toEqual(seed)
  })

  it('can generate only evolved variants when a reference config is excluded', () => {
    const seed = makeSeedConfig()
    const rng = createRng(19)
    const population = generateInitialPopulation(seed, 6, 0.15, 1.5, () => rng.next(), {
      includeSeed: false,
      referenceConfig: seed,
    })

    expect(population).toHaveLength(6)
    for (const config of population) {
      expect(getChangedGeneRows(seed, config).length).toBeGreaterThan(0)
    }
  })
})

describe('selection and stopping', () => {
  it('tournament selection with k=population picks the fittest individual', () => {
    const population = makeIndividuals([makeSeedConfig(), makeAggressiveConfig(), makeSeedConfig()])
    const rng = createRng(1)
    const index = selectParent(population, 'tournament', population.length, () => rng.next())
    expect(population[index].fitness).toBe(502000)
  })

  it('roulette always returns a valid index', () => {
    const population = makeIndividuals([makeSeedConfig(), makeAggressiveConfig(), makeSeedConfig()])
    const rng = createRng(2)
    for (let count = 0; count < 25; count += 1) {
      const index = selectParent(population, 'roulette', 3, () => rng.next())
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(population.length)
    }
  })

  it('computes stop reasons in priority order', () => {
    const best = makeIndividuals([makeSeedConfig()])[0]
    expect(checkStopCondition(50, best, 0, { ...defaultEvoConfig, maxGenerations: 50 })).toBe('max_generations')
    expect(checkStopCondition(4, { ...best, primaryRate: 55 }, 0, { ...defaultEvoConfig, absoluteMargin: 5 })).toBe('absolute_margin')
    expect(checkStopCondition(4, { ...best, primaryRate: 60 }, 0, { ...defaultEvoConfig, absoluteMargin: null, targetRate: 60 })).toBe('target_rate')
    expect(checkStopCondition(4, { ...best, primaryRate: 51 }, 15, { ...defaultEvoConfig, absoluteMargin: null, targetRate: null, stagnationLimit: 15 })).toBe('stagnation')
  })
})

describe('diversity and export', () => {
  it('builds lexicographic fitness scores from the configured priority', () => {
    const metrics = {
      gamesPlayed: 20,
      gamesWon: 10,
      roundsPlayed: 100,
      roundsWon: 50,
      mirrorRoundsPlayed: 40,
      mirrorRoundsWon: 24,
      chinchonWins: 1,
      orphanRoundsPlayed: 6,
    }

    const mirrorFirst = buildFitnessSummary('mirror_rounds_then_games', metrics)
    const gamesFirst = buildFitnessSummary('games_then_mirror_rounds', metrics)

    expect(mirrorFirst.primaryRate).toBe(60)
    expect(mirrorFirst.secondaryRate).toBe(50)
    expect(gamesFirst.primaryRate).toBe(50)
    expect(gamesFirst.secondaryRate).toBe(60)
    expect(mirrorFirst.fitness).toBeGreaterThan(gamesFirst.fitness)
  })

  it('returns zero diversity for identical populations and positive diversity for mixed populations', () => {
    const seed = makeSeedConfig()
    const identical = computeDiversity(makeIndividuals([seed, cloneBotConfig(seed)]))
    const mixed = computeDiversity(makeIndividuals([seed, makeAggressiveConfig()]))

    expect(identical).toBe(0)
    expect(mixed).toBeGreaterThan(0)
  })

  it('prepares exported configs as custom bots without preset styling fields', () => {
    const prepared = prepareForExport(makeAggressiveConfig(), 'Evo Bot', '🧬', 'Bot evolucionado')
    expect(prepared.id.startsWith('custom-')).toBe(true)
    expect(prepared.name).toBe('Evo Bot')
    expect(prepared.emoji).toBe('🧬')
    expect(prepared.color).toBeUndefined()
    expect(prepared.text).toBeUndefined()
  })

  it('can cut candidate evaluation early when the active ratios stabilize', async () => {
    const constantPair = (): [SimulatedGameResult, SimulatedGameResult] => [
      {
        gameLoser: 1,
        scores: [0, 10],
        roundStats: [{ winner: 0, cards: 7, chinchon: false }],
      },
      {
        gameLoser: 1,
        scores: [0, 12],
        roundStats: [{ winner: 0, cards: 8, chinchon: false }],
      },
    ]

    const fullRun = await evaluateFitness(
      makeSeedConfig(),
      buildBotFromConfig(makeAggressiveConfig()),
      300,
      'games_then_mirror_rounds',
      {
        useStabilized: false,
        simulatePair: constantPair,
      },
    )

    const stabilizedRun = await evaluateFitness(
      makeSeedConfig(),
      buildBotFromConfig(makeAggressiveConfig()),
      300,
      'games_then_mirror_rounds',
      {
        useStabilized: true,
        stabilizeDecimals: 1,
        simulatePair: constantPair,
      },
    )

    expect(fullRun.gamesPlayed).toBe(600)
    expect(stabilizedRun.gamesPlayed).toBeLessThan(fullRun.gamesPlayed)
    expect(stabilizedRun.gamesPlayed).toBe(400)
  })

  it('emits throttled partial updates while evaluating a candidate', async () => {
    const partials: number[] = []
    const constantPair = (): [SimulatedGameResult, SimulatedGameResult] => [
      {
        gameLoser: 1,
        scores: [0, 10],
        roundStats: [{ winner: 0, cards: 7, chinchon: false }],
      },
      {
        gameLoser: 0,
        scores: [11, 0],
        roundStats: [{ winner: 1, cards: 6, chinchon: false }],
      },
    ]

    await evaluateFitness(
      makeSeedConfig(),
      buildBotFromConfig(makeAggressiveConfig()),
      40,
      'games_then_mirror_rounds',
      {
        useStabilized: false,
        simulatePair: constantPair,
        onPartial: evaluation => {
          partials.push(evaluation.progress)
        },
      },
    )

    expect(partials.length).toBeGreaterThan(2)
    expect(partials[partials.length - 1]).toBe(100)
    expect(partials.some(progress => progress > 0 && progress < 100)).toBe(true)
  })
})

describe('runEvolution', () => {
  it('reports progress snapshots and hall-of-fame results with a deterministic evaluator', async () => {
    const snapshots: number[] = []
    const rng = createRng(33)
    const result = await runEvolution({
      seedConfig: makeSeedConfig(),
      rivalRuntime: buildBotFromConfig(makeSeedConfig()),
      config: {
        populationSize: 6,
        simsPerEval: 10,
        useStabilizedEvaluation: true,
        stabilizeDecimals: 1,
        maxGenerations: 3,
        elitismCount: 1,
        mutationRate: 0.25,
        mutationSigma: 1.5,
        crossoverRate: 0.8,
        fitnessMode: 'games_then_mirror_rounds',
        selectionMethod: 'tournament',
        tournamentK: 3,
        absoluteMargin: null,
        targetRate: null,
        stagnationLimit: null,
      },
      rng: () => rng.next(),
      evaluate: async individual => {
        const metrics = {
          gamesPlayed: 20,
          gamesWon: 8 + Math.round(individual.draw.structuralPriority / 2),
          roundsPlayed: 120,
          roundsWon: 60 + individual.cut.chinchonPursuit,
          mirrorRoundsPlayed: 40,
          mirrorRoundsWon: 20 + individual.draw.structuralPriority,
          chinchonWins: 2,
          orphanRoundsPlayed: 6,
        }
        return {
          ...metrics,
          ...buildFitnessSummary('games_then_mirror_rounds', metrics),
        }
      },
      onGeneration: async snapshot => {
        snapshots.push(snapshot.generation)
      },
    })

    expect(snapshots).toEqual([0, 1, 2, 3])
    expect(result.stopReason).toBe('max_generations')
    expect(result.topIndividuals.length).toBeGreaterThan(0)
    expect(result.fitnessHistory.length).toBe(4)
  })

  it('supports cancellation while keeping the best individual found so far', async () => {
    let cancel = false
    const rng = createRng(44)

    const result = await runEvolution({
      seedConfig: makeSeedConfig(),
      rivalRuntime: buildBotFromConfig(makeSeedConfig()),
      config: {
        populationSize: 4,
        simsPerEval: 10,
        useStabilizedEvaluation: true,
        stabilizeDecimals: 1,
        maxGenerations: 10,
        elitismCount: 1,
        mutationRate: 0.2,
        mutationSigma: 1.2,
        crossoverRate: 0.8,
        fitnessMode: 'games_then_mirror_rounds',
        selectionMethod: 'roulette',
        tournamentK: 3,
        absoluteMargin: null,
        targetRate: null,
        stagnationLimit: null,
      },
      rng: () => rng.next(),
      shouldCancel: () => cancel,
      evaluate: async individual => {
        const metrics = {
          gamesPlayed: 20,
          gamesWon: 10 + individual.cut.baseResto,
          roundsPlayed: 120,
          roundsWon: 60,
          mirrorRoundsPlayed: 40,
          mirrorRoundsWon: 18 + individual.cut.baseResto,
          chinchonWins: 1,
          orphanRoundsPlayed: 4,
        }
        return {
          ...metrics,
          ...buildFitnessSummary('games_then_mirror_rounds', metrics),
        }
      },
      onGeneration: async snapshot => {
        if (snapshot.generation >= 1) cancel = true
      },
    })

    expect(result.stopReason).toBe('cancelled')
    expect(result.bestIndividual.fitness).toBeGreaterThan(0)
    expect(result.topIndividuals[0].fitness).toBe(result.bestIndividual.fitness)
  })

  it('can evaluate multiple individuals concurrently when evaluationConcurrency is enabled', async () => {
    const rng = createRng(51)
    let inFlight = 0
    let maxInFlight = 0

    await runEvolution({
      seedConfig: makeSeedConfig(),
      rivalRuntime: buildBotFromConfig(makeSeedConfig()),
      config: {
        populationSize: 6,
        simsPerEval: 10,
        useStabilizedEvaluation: true,
        stabilizeDecimals: 1,
        maxGenerations: 1,
        elitismCount: 1,
        mutationRate: 0.2,
        mutationSigma: 1.2,
        crossoverRate: 0.8,
        fitnessMode: 'games_then_mirror_rounds',
        selectionMethod: 'tournament',
        tournamentK: 3,
        absoluteMargin: null,
        targetRate: null,
        stagnationLimit: null,
      },
      rng: () => rng.next(),
      evaluationConcurrency: 3,
      evaluate: async individual => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise(resolve => setTimeout(resolve, 5))
        inFlight -= 1

        const metrics = {
          gamesPlayed: 20,
          gamesWon: 10 + individual.cut.baseResto,
          roundsPlayed: 120,
          roundsWon: 60,
          mirrorRoundsPlayed: 40,
          mirrorRoundsWon: 18 + individual.cut.baseResto,
          chinchonWins: 1,
          orphanRoundsPlayed: 4,
        }
        return {
          ...metrics,
          ...buildFitnessSummary('games_then_mirror_rounds', metrics),
        }
      },
    })

    expect(maxInFlight).toBeGreaterThan(1)
  })

  it('never returns the untouched original config when evolving a bot against itself', async () => {
    const seed = makeSeedConfig()
    const rng = createRng(55)

    const result = await runEvolution({
      seedConfig: seed,
      rivalRuntime: buildBotFromConfig(seed),
      config: {
        populationSize: 5,
        simsPerEval: 10,
        useStabilizedEvaluation: true,
        stabilizeDecimals: 1,
        maxGenerations: 1,
        elitismCount: 1,
        mutationRate: 0.15,
        mutationSigma: 1.5,
        crossoverRate: 0.8,
        fitnessMode: 'games_then_mirror_rounds',
        selectionMethod: 'tournament',
        tournamentK: 3,
        absoluteMargin: null,
        targetRate: null,
        stagnationLimit: null,
      },
      rng: () => rng.next(),
      excludeExactReferenceConfig: seed,
      evaluate: async individual => {
        const metrics = {
          gamesPlayed: 20,
          gamesWon: 10 + Math.round(individual.draw.improvementThreshold / 5),
          roundsPlayed: 120,
          roundsWon: 60,
          mirrorRoundsPlayed: 40,
          mirrorRoundsWon: 20 + individual.draw.improvementThreshold,
          chinchonWins: 0,
          orphanRoundsPlayed: 4,
        }
        return {
          ...metrics,
          ...buildFitnessSummary('games_then_mirror_rounds', metrics),
        }
      },
    })

    expect(getChangedGeneRows(seed, result.bestIndividual.config).length).toBeGreaterThan(0)
  })

  it('keeps a generation-by-generation history with lineage and metrics vs the original seed', async () => {
    const seed = makeSeedConfig()
    const rival = makeAggressiveConfig()
    const rng = createRng(61)

    const result = await runEvolution({
      seedConfig: seed,
      rivalRuntime: buildBotFromConfig(rival),
      config: {
        populationSize: 5,
        simsPerEval: 10,
        useStabilizedEvaluation: false,
        stabilizeDecimals: 1,
        maxGenerations: 1,
        elitismCount: 1,
        mutationRate: 0.2,
        mutationSigma: 1.2,
        crossoverRate: 0.8,
        fitnessMode: 'games_then_mirror_rounds',
        selectionMethod: 'tournament',
        tournamentK: 3,
        absoluteMargin: null,
        targetRate: null,
        stagnationLimit: null,
      },
      rng: () => rng.next(),
      evaluate: async (_individual, rivalRuntime) => {
        const vsSeed = rivalRuntime.id === seed.id
        const metrics = {
          gamesPlayed: 20,
          gamesWon: vsSeed ? 9 : 13,
          roundsPlayed: 120,
          roundsWon: vsSeed ? 54 : 66,
          mirrorRoundsPlayed: 40,
          mirrorRoundsWon: vsSeed ? 18 : 24,
          chinchonWins: vsSeed ? 1 : 3,
          orphanRoundsPlayed: 4,
        }
        return {
          ...metrics,
          ...buildFitnessSummary('games_then_mirror_rounds', metrics),
        }
      },
    })

    expect(result.generationHistory).toHaveLength(2)
    expect(result.generationHistory[0]?.generation).toBe(0)
    expect(result.generationHistory[1]?.generation).toBe(1)

    const initialSeed = result.generationHistory[0]?.individuals[0]
    expect(initialSeed?.sourceKind).toBe('seed')
    expect(initialSeed?.originalMetrics?.gameWinRate).toBe(45)
    expect(initialSeed?.originalMetrics?.mirrorRoundRate).toBe(45)

    const secondGeneration = result.generationHistory[1]?.individuals ?? []
    expect(secondGeneration.some(individual => individual.sourceKind === 'elite')).toBe(true)
    expect(secondGeneration.some(individual => individual.sourceKind === 'crossover')).toBe(true)
    expect(secondGeneration.every(individual => individual.originalMetrics != null)).toBe(true)
  })

  it('marks progress and generation-complete snapshots explicitly', async () => {
    const phases: string[] = []
    const rng = createRng(67)

    await runEvolution({
      seedConfig: makeSeedConfig(),
      rivalRuntime: buildBotFromConfig(makeAggressiveConfig()),
      config: {
        populationSize: 4,
        simsPerEval: 10,
        useStabilizedEvaluation: false,
        stabilizeDecimals: 1,
        maxGenerations: 1,
        elitismCount: 1,
        mutationRate: 0.2,
        mutationSigma: 1.2,
        crossoverRate: 0.8,
        fitnessMode: 'games_then_mirror_rounds',
        selectionMethod: 'tournament',
        tournamentK: 3,
        absoluteMargin: null,
        targetRate: null,
        stagnationLimit: null,
      },
      rng: () => rng.next(),
      evaluate: async individual => {
        const metrics = {
          gamesPlayed: 20,
          gamesWon: 10 + individual.cut.baseResto,
          roundsPlayed: 120,
          roundsWon: 60,
          mirrorRoundsPlayed: 40,
          mirrorRoundsWon: 18 + individual.cut.baseResto,
          chinchonWins: 1,
          orphanRoundsPlayed: 4,
        }
        return {
          ...metrics,
          ...buildFitnessSummary('games_then_mirror_rounds', metrics),
        }
      },
      onProgress: async snapshot => {
        phases.push(snapshot.phase)
      },
      onGeneration: async snapshot => {
        phases.push(snapshot.phase)
      },
    })

    expect(phases).toContain('progress')
    expect(phases.filter(phase => phase === 'generation_complete').length).toBe(2)
  })
})
