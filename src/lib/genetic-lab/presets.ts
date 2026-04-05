import type { ExperimentConfig } from './types'

export type Preset = {
  name: string
  description: string
  config: ExperimentConfig
}

export const PRESETS: Preset[] = [
  {
    name: 'Balanceado',
    description: 'Demo clásica con parámetros equilibrados. Buena convergencia sin perder diversidad.',
    config: {
      problemId: 'target-bitgrid',
      seed: 12345,
      populationSize: 96,
      genomeLength: 64,
      elitismCount: 2,
      selection: { method: 'tournament', k: 3 },
      crossover: { method: 'onePoint', rate: 0.85 },
      mutation: { method: 'bitFlip', ratePerGene: 1 / 64 },
      maxGenerations: 300,
    },
  },
  {
    name: 'Exploración alta',
    description: 'Mutación y cruce uniforme altos. Útil para ver cómo la diversidad mantiene opciones abiertas.',
    config: {
      problemId: 'target-bitgrid',
      seed: 20260405,
      populationSize: 140,
      genomeLength: 64,
      elitismCount: 1,
      selection: { method: 'roulette' },
      crossover: { method: 'uniform', rate: 0.9, swapProb: 0.5 },
      mutation: { method: 'bitFlip', ratePerGene: 0.06 },
      maxGenerations: 250,
    },
  },
  {
    name: 'Convergencia rápida',
    description: 'Presión selectiva alta y elitismo fuerte. La población converge rápido pero pierde diversidad.',
    config: {
      problemId: 'target-bitgrid',
      seed: 8086,
      populationSize: 80,
      genomeLength: 64,
      elitismCount: 4,
      selection: { method: 'tournament', k: 7 },
      crossover: { method: 'twoPoint', rate: 0.95 },
      mutation: { method: 'bitFlip', ratePerGene: 0.01 },
      maxGenerations: 200,
    },
  },
]
