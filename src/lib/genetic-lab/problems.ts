import type { Genome, ExperimentConfig } from './types'
import type { Rng } from './rng'
import type { MazePreset } from './maze-runner-types'
import { getMazePreset } from './maze-runner-maps'
import { mazeRunnerFitness } from './maze-runner'

export type ProblemContext = {
  target?: Genome
  /** Maze preset used by the maze-runner problem */
  maze?: MazePreset
}

export type ProblemDefinition = {
  id: string
  title: string
  description: string
  defaultGenomeLength: number
  buildContext: (config: ExperimentConfig, rng: Rng) => ProblemContext
  fitness: (genome: Genome, ctx: ProblemContext) => number
}

const targetBitGrid: ProblemDefinition = {
  id: 'target-bitgrid',
  title: 'Target BitGrid',
  description: 'Evoluciona una grilla binaria hasta copiar un patr\u00f3n objetivo. Fitness = bits correctos.',
  defaultGenomeLength: 64,
  buildContext(config, rng) {
    const target = new Uint8Array(config.genomeLength)
    for (let i = 0; i < target.length; i++) {
      target[i] = rng.next() < 0.5 ? 1 : 0
    }
    return { target }
  },
  fitness(genome, ctx) {
    const target = ctx.target!
    let matches = 0
    for (let i = 0; i < genome.length; i++) {
      if (genome[i] === target[i]) matches++
    }
    return matches
  },
}

const mazeRunner: ProblemDefinition = {
  id: 'maze-runner',
  title: 'Maze Runner',
  description: 'Evoluciona secuencias de movimientos para recorrer un laberinto desde el inicio hasta la meta.',
  defaultGenomeLength: 60,  // 30 steps * 2 bits
  buildContext(config, _rng) {
    const mazeId = (config.problemParams?.mazePresetId as string) ?? 'easy-corridor'
    const maze = getMazePreset(mazeId)
    if (!maze) {
      throw new Error(`Maze preset desconocido: ${mazeId}`)
    }
    return { maze }
  },
  fitness(genome, ctx) {
    return mazeRunnerFitness(genome, ctx.maze!)
  },
}

export const PROBLEMS: ProblemDefinition[] = [targetBitGrid, mazeRunner]

export function getProblem(id: string): ProblemDefinition | undefined {
  return PROBLEMS.find(p => p.id === id)
}
