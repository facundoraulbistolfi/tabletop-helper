import type { ExperimentConfig } from './types'

export type Preset = {
  name: string
  description: string
  config: ExperimentConfig
}

export const PRESETS: Preset[] = [
  {
    name: 'Balanceado',
    description: 'Demo cl\u00e1sica con par\u00e1metros equilibrados. Buena convergencia sin perder diversidad.',
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
    name: 'Exploraci\u00f3n alta',
    description: 'Mutaci\u00f3n y cruce uniforme altos. \u00datil para ver c\u00f3mo la diversidad mantiene opciones abiertas.',
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
    name: 'Convergencia r\u00e1pida',
    description: 'Presi\u00f3n selectiva alta y elitismo fuerte. La poblaci\u00f3n converge r\u00e1pido pero pierde diversidad.',
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
  // ─── Maze Runner presets ───────────────────────────────────
  {
    name: 'Maze — F\u00e1cil',
    description: 'Laberinto simple con camino corto. Convergencia r\u00e1pida y visible. Ideal para entender c\u00f3mo funciona.',
    config: {
      problemId: 'maze-runner',
      seed: 42,
      populationSize: 80,
      genomeLength: 50,   // 25 steps * 2
      elitismCount: 2,
      selection: { method: 'tournament', k: 3 },
      crossover: { method: 'onePoint', rate: 0.85 },
      mutation: { method: 'bitFlip', ratePerGene: 0.04 },
      maxGenerations: 300,
      problemParams: { mazePresetId: 'easy-corridor', maxSteps: 25 },
    },
  },
  {
    name: 'Maze — Callejones',
    description: 'Laberinto con callejones sin salida. \u00datil para observar c\u00f3mo la selecci\u00f3n descarta rutas malas.',
    config: {
      problemId: 'maze-runner',
      seed: 7777,
      populationSize: 120,
      genomeLength: 80,   // 40 steps * 2
      elitismCount: 3,
      selection: { method: 'tournament', k: 5 },
      crossover: { method: 'twoPoint', rate: 0.9 },
      mutation: { method: 'bitFlip', ratePerGene: 0.03 },
      maxGenerations: 400,
      problemParams: { mazePresetId: 'dead-ends', maxSteps: 40 },
    },
  },
  {
    name: 'Maze — Ruta larga',
    description: 'Laberinto grande con camino largo. Se nota el valor del cruce y la mutaci\u00f3n para armar rutas completas.',
    config: {
      problemId: 'maze-runner',
      seed: 2024,
      populationSize: 150,
      genomeLength: 120,  // 60 steps * 2
      elitismCount: 3,
      selection: { method: 'tournament', k: 4 },
      crossover: { method: 'uniform', rate: 0.9, swapProb: 0.5 },
      mutation: { method: 'bitFlip', ratePerGene: 0.025 },
      maxGenerations: 500,
      problemParams: { mazePresetId: 'long-route', maxSteps: 60 },
    },
  },
]
