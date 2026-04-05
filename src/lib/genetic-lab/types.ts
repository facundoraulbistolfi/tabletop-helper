export type Genome = Uint8Array

export type IndividualMeta = {
  parentAId?: number
  parentBId?: number
  crossoverPoints?: number[]
  mutatedGenes?: number[]
}

export type Individual = {
  id: number
  genome: Genome
  fitness: number
  meta?: IndividualMeta
}

export type PopulationSnapshot = {
  generation: number
  individuals: Individual[]
}

export type MetricsTick = {
  generation: number
  best: number
  avg: number
  worst: number
  diversity?: number
}

export type SelectionMethod =
  | { method: 'tournament'; k: number }
  | { method: 'roulette' }

export type CrossoverMethod =
  | { method: 'onePoint'; rate: number }
  | { method: 'twoPoint'; rate: number }
  | { method: 'uniform'; rate: number; swapProb?: number }

export type MutationMethod =
  | { method: 'bitFlip'; ratePerGene: number }

export type ExperimentConfig = {
  problemId: string
  seed: number
  populationSize: number
  genomeLength: number
  elitismCount: number
  selection: SelectionMethod
  crossover: CrossoverMethod
  mutation: MutationMethod
  maxGenerations: number
}
