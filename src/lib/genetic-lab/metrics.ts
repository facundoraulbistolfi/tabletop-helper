import type { PopulationSnapshot, MetricsTick } from './types'

export function computeMetrics(snapshot: PopulationSnapshot): MetricsTick {
  const { individuals, generation } = snapshot
  const fitnesses = individuals.map(ind => ind.fitness)

  const best = Math.max(...fitnesses)
  const worst = Math.min(...fitnesses)
  const avg = fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length

  const diversity = computeDiversity(snapshot)

  return { generation, best, avg, worst, diversity }
}

export function computeDiversity(snapshot: PopulationSnapshot): number {
  const { individuals } = snapshot
  if (individuals.length === 0) return 0

  const genomeLength = individuals[0].genome.length
  if (genomeLength === 0) return 0

  let totalEntropy = 0
  for (let g = 0; g < genomeLength; g++) {
    let ones = 0
    for (const ind of individuals) {
      ones += ind.genome[g]
    }
    const p = ones / individuals.length
    if (p > 0 && p < 1) {
      totalEntropy += -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p))
    }
  }

  return totalEntropy / genomeLength
}
