import type { Genome, ExperimentConfig } from './types'
import type { Rng } from './rng'

export type ProblemContext = {
  target?: Genome
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
  description: 'Evoluciona una grilla binaria hasta copiar un patrón objetivo. Fitness = bits correctos.',
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

export const PROBLEMS: ProblemDefinition[] = [targetBitGrid]

export function getProblem(id: string): ProblemDefinition | undefined {
  return PROBLEMS.find(p => p.id === id)
}
