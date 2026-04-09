import { simulateGamePairWithBots, type SimulatedGameResult } from './chinchon-arena-sim'
import {
  buildBotFromConfig,
  cloneBotConfig,
  defaultScoreRules,
  type BotConfig,
  type BotRuntime,
  type ScoreRule,
} from './chinchon-bot-presets'
import {
  MIN_SIMULATIONS_BEFORE_STABLE_STOP,
  STABLE_SIMULATION_STREAK,
  getPercentOfTotal,
  summarizeSimulatedPair,
  truncateRate,
  type BotMirrorMetrics,
} from './chinchon-sim-metrics'

type GeneValue = number | string | boolean

export type GeneType = 'continuous' | 'categorical' | 'boolean'

export type FitnessMode =
  | 'mirror_rounds_only'
  | 'games_only'
  | 'mirror_rounds_then_games'
  | 'games_then_mirror_rounds'

export type GeneDescriptor =
  | {
      type: 'continuous'
      path: string
      min: number
      max: number
      integer: boolean
    }
  | {
      type: 'categorical'
      path: string
      options: Array<string | number>
    }
  | {
      type: 'boolean'
      path: string
    }

export type EvoMetricSummary = BotMirrorMetrics & {
  gameWinRate: number
  roundWinRate: number
  mirrorRoundRate: number
  primaryRate: number
  secondaryRate: number
}

export type EvolutionSourceKind =
  | 'seed'
  | 'initial_mutation'
  | 'elite'
  | 'crossover'

export type EvoIndividual = EvoMetricSummary & {
  id: number
  config: BotConfig
  fitness: number
  fitnessMode: FitnessMode
  originalMetrics?: EvoMetricSummary
  meta?: {
    sourceKind?: EvolutionSourceKind
    parentAId?: number
    parentBId?: number
    mutatedGenes?: string[]
  }
}

export type EvolutionCandidateProgress = {
  id: number | null
  generation: number
  slotIndex: number
  name: string
  emoji: string
  status: 'pending' | 'running' | 'done'
  progress: number
  gamesPlayed: number
  gamesWon: number
  roundsPlayed: number
  roundsWon: number
  mirrorRoundsPlayed: number
  mirrorRoundsWon: number
  chinchonWins: number
  orphanRoundsPlayed: number
  primaryRate: number
  secondaryRate: number
  stableStop: boolean
  originalMetrics: EvoMetricSummary | null
  sourceKind: EvolutionSourceKind
  parentAId?: number
  parentBId?: number
  mutatedGenes: string[]
}

export type EvolutionGenerationRecord = {
  generation: number
  individuals: EvolutionCandidateProgress[]
}

export type EvoMetricsTick = {
  generation: number
  bestFitness: number
  avgFitness: number
  worstFitness: number
  bestPrimaryRate: number
  avgPrimaryRate: number
  worstPrimaryRate: number
  bestSecondaryRate: number
  avgSecondaryRate: number
  bestGameWinRate: number
  avgGameWinRate: number
  bestMirrorRoundRate: number
  avgMirrorRoundRate: number
  diversity: number
}

export type EvoConfig = {
  rivalBotIndex: number
  seedBotIndex: number
  populationSize: number
  simsPerEval: number
  useStabilizedEvaluation: boolean
  stabilizeDecimals: number
  maxGenerations: number
  elitismCount: number
  mutationRate: number
  mutationSigma: number
  crossoverRate: number
  fitnessMode: FitnessMode
  selectionMethod: 'tournament' | 'roulette'
  tournamentK: number
  absoluteMargin: number | null
  targetRate: number | null
  stagnationLimit: number | null
}

export type StopReason =
  | 'max_generations'
  | 'absolute_margin'
  | 'target_rate'
  | 'stagnation'
  | 'cancelled'

export type EvolutionRunConfig = Omit<EvoConfig, 'rivalBotIndex' | 'seedBotIndex'>

export type FitnessEvaluation = EvoMetricSummary & {
  fitness: number
  cancelled?: boolean
  stableStop?: boolean
}

export type EvolutionProgressSnapshot = {
  phase: 'progress' | 'generation_complete'
  generation: number
  bestIndividual: EvoIndividual
  bestGeneration: number
  metrics: EvoMetricsTick
  fitnessHistory: EvoMetricsTick[]
  progress: number
  generationProgress: number
  evaluatedIndividuals: number
  populationSize: number
  totalEvaluations: number
  generationIndividuals: EvolutionCandidateProgress[]
}

export type EvolutionRunResult = {
  bestIndividual: EvoIndividual
  bestGeneration: number
  totalGenerations: number
  totalEvaluations: number
  stopReason: StopReason
  topIndividuals: EvoIndividual[]
  fitnessHistory: EvoMetricsTick[]
  generationHistory: EvolutionGenerationRecord[]
}

export type EvaluateFitnessOptions = {
  shouldCancel?: () => boolean
  yieldEveryGames?: number
  yieldControl?: () => Promise<void>
  useStabilized?: boolean
  stabilizeDecimals?: number
  simulatePair?: (bots: BotRuntime[]) => [SimulatedGameResult, SimulatedGameResult]
  onPartial?: (snapshot: FitnessEvaluation & {
    progress: number
    stableStop: boolean
  }) => void | Promise<void>
}

export type RunEvolutionOptions = {
  seedConfig: BotConfig
  rivalRuntime: BotRuntime
  originalRuntime?: BotRuntime | null
  config: EvolutionRunConfig
  rng: () => number
  evaluationConcurrency?: number
  excludeExactReferenceConfig?: BotConfig | null
  shouldCancel?: () => boolean
  yieldControl?: () => Promise<void>
  onProgress?: (snapshot: EvolutionProgressSnapshot) => void | Promise<void>
  onGeneration?: (snapshot: EvolutionProgressSnapshot) => void | Promise<void>
  evaluate?: (
    individual: BotConfig,
    rival: BotRuntime,
    sims: number,
    fitnessMode: FitnessMode,
    options?: EvaluateFitnessOptions,
  ) => Promise<FitnessEvaluation> | FitnessEvaluation
}

type PopulationEvaluation = {
  individuals: EvoIndividual[]
  totalGames: number
  cancelled: boolean
}

type PopulationProgress = {
  individuals: EvoIndividual[]
  totalGames: number
  evaluatedIndividuals: number
  generationIndividuals: EvolutionCandidateProgress[]
}

type DraftIndividual = {
  config: BotConfig
  meta?: EvoIndividual['meta']
}

type InitialPopulationOptions = {
  includeSeed?: boolean
  referenceConfig?: BotConfig | null
}

const SCORE_RULE_TEMPLATE = defaultScoreRules()
const BLX_ALPHA = 0.3
const DEFAULT_YIELD_EVERY_GAMES = 50
const DEFAULT_EXPORT_NAME_MAX = 12
const DEFAULT_EXPORT_DESCRIPTION_MAX = 120
const MAX_EVOLUTION_POPULATION = 10
const FITNESS_RATE_SCALE = 1000
const FITNESS_SECONDARY_MULTIPLIER = 100_001
const EVALUATION_PROGRESS_BUCKETS = 12
const EVALUATION_WARMUP_MARKS = [1, 2, 5, 10, 20, 50, 100, 200]

export const defaultEvoConfig: EvoConfig = {
  rivalBotIndex: 0,
  seedBotIndex: 0,
  populationSize: 8,
  simsPerEval: 60,
  useStabilizedEvaluation: true,
  stabilizeDecimals: 1,
  maxGenerations: 50,
  elitismCount: 2,
  mutationRate: 0.15,
  mutationSigma: 1.5,
  crossoverRate: 0.8,
  fitnessMode: 'games_then_mirror_rounds',
  selectionMethod: 'tournament',
  tournamentK: 3,
  absoluteMargin: 5,
  targetRate: 60,
  stagnationLimit: 15,
}

export const GENE_MAP: GeneDescriptor[] = [
  { type: 'continuous', path: 'global.temperature', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'global.mistakeRate', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.improvementThreshold', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.structuralPriority', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.infoAversion', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.chinchonBias', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.tempoPreference', min: 0, max: 10, integer: true },
  { type: 'categorical', path: 'discard.evalScope', options: ['fast', 'full'] },
  { type: 'continuous', path: 'discard.restoBias', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'discard.potentialBias', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'discard.rankBias', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'discard.jokerProtection', min: 0, max: 10, integer: true },
  { type: 'categorical', path: 'cut.maxFree', options: [0, 1] },
  { type: 'continuous', path: 'cut.baseResto', min: 0, max: 5, integer: true },
  { type: 'boolean', path: 'cut.useScoreRules' },
  { type: 'continuous', path: 'cut.scoreRules.0.maxResto', min: 0, max: 5, integer: true },
  { type: 'continuous', path: 'cut.scoreRules.1.maxResto', min: 0, max: 5, integer: true },
  { type: 'continuous', path: 'cut.scoreRules.2.maxResto', min: 0, max: 5, integer: true },
  { type: 'continuous', path: 'cut.scoreRules.3.maxResto', min: 0, max: 5, integer: true },
  { type: 'continuous', path: 'cut.chinchonPursuit', min: 0, max: 10, integer: true },
  { type: 'categorical', path: 'cut.chinchonThreshold', options: [4, 5, 6] },
  { type: 'continuous', path: 'cut.minus10Pursuit', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'cut.deckUrgency', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'cut.leadProtection', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'cut.desperationMode', min: 0, max: 10, integer: true },
]

export type FitnessModeDescriptor = {
  primaryKey: 'games' | 'mirror_rounds'
  secondaryKey: 'games' | 'mirror_rounds' | null
  primaryLabel: string
  secondaryLabel: string | null
  shortLabel: string
}

const FITNESS_MODE_DESCRIPTORS: Record<FitnessMode, FitnessModeDescriptor> = {
  mirror_rounds_only: {
    primaryKey: 'mirror_rounds',
    secondaryKey: null,
    primaryLabel: 'Rondas espejo',
    secondaryLabel: null,
    shortLabel: 'Solo rondas espejo',
  },
  games_only: {
    primaryKey: 'games',
    secondaryKey: null,
    primaryLabel: 'Partidas',
    secondaryLabel: null,
    shortLabel: 'Solo partidas',
  },
  mirror_rounds_then_games: {
    primaryKey: 'mirror_rounds',
    secondaryKey: 'games',
    primaryLabel: 'Rondas espejo',
    secondaryLabel: 'Partidas',
    shortLabel: 'Rondas espejo > Partidas',
  },
  games_then_mirror_rounds: {
    primaryKey: 'games',
    secondaryKey: 'mirror_rounds',
    primaryLabel: 'Partidas',
    secondaryLabel: 'Rondas espejo',
    shortLabel: 'Partidas > Rondas espejo',
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function toPathSegments(path: string): Array<string | number> {
  return path.split('.').map(segment => {
    const asNumber = Number(segment)
    return Number.isInteger(asNumber) && String(asNumber) === segment ? asNumber : segment
  })
}

function getPathValue(target: unknown, path: string): GeneValue {
  let current = target as Record<string | number, unknown>
  for (const segment of toPathSegments(path)) {
    current = current?.[segment] as Record<string | number, unknown>
  }
  return current as unknown as GeneValue
}

function setPathValue(target: unknown, path: string, value: GeneValue) {
  const segments = toPathSegments(path)
  const lastSegment = segments[segments.length - 1]
  let current = target as Record<string | number, unknown>
  for (let i = 0; i < segments.length - 1; i += 1) {
    current = current[segments[i]] as Record<string | number, unknown>
  }
  current[lastSegment] = value
}

function randomInt(min: number, max: number, rng: () => number) {
  return min + Math.floor(rng() * (max - min + 1))
}

function randomChoice<T>(values: readonly T[], rng: () => number): T {
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))]
}

function gaussian(rng: () => number) {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function serializeGeneValues(config: BotConfig) {
  return GENE_MAP.map(gene => getGeneValue(config, gene.path)).join('|')
}

function configsAreEquivalent(left: BotConfig, right: BotConfig) {
  return serializeGeneValues(left) === serializeGeneValues(right)
}

function toNormalizedGeneValue(descriptor: GeneDescriptor, value: GeneValue) {
  if (descriptor.type === 'continuous') {
    const span = descriptor.max - descriptor.min || 1
    return (Number(value) - descriptor.min) / span
  }
  if (descriptor.type === 'categorical') {
    const idx = descriptor.options.indexOf(value as never)
    if (idx <= 0) return 0
    if (descriptor.options.length <= 1) return 0
    return idx / (descriptor.options.length - 1)
  }
  return value ? 1 : 0
}

function normalizeGeneValue(descriptor: GeneDescriptor, value: GeneValue): GeneValue {
  if (descriptor.type === 'continuous') {
    const nextValue = descriptor.integer
      ? Math.round(clamp(Number(value), descriptor.min, descriptor.max))
      : clamp(Number(value), descriptor.min, descriptor.max)
    return nextValue
  }
  if (descriptor.type === 'categorical') {
    return descriptor.options.includes(value as never)
      ? value
      : descriptor.options[0]
  }
  return Boolean(value)
}

export function getFitnessModeDescriptor(mode: FitnessMode): FitnessModeDescriptor {
  return FITNESS_MODE_DESCRIPTORS[mode]
}

function buildStabilityKey(
  fitnessMode: FitnessMode,
  metrics: Pick<BotMirrorMetrics, 'gamesPlayed' | 'gamesWon' | 'mirrorRoundsPlayed' | 'mirrorRoundsWon'>,
  rivalGamesWon: number,
  rivalMirrorRoundsWon: number,
  decimals: number,
): string {
  const gamesLeft = truncateRate(getPercentOfTotal(metrics.gamesWon, metrics.gamesPlayed), decimals)
  const gamesRight = truncateRate(getPercentOfTotal(rivalGamesWon, metrics.gamesPlayed), decimals)
  const mirrorLeft = truncateRate(getPercentOfTotal(metrics.mirrorRoundsWon, metrics.mirrorRoundsPlayed), decimals)
  const mirrorRight = truncateRate(getPercentOfTotal(rivalMirrorRoundsWon, metrics.mirrorRoundsPlayed), decimals)

  switch (fitnessMode) {
    case 'games_only':
      return `g:${gamesLeft}/${gamesRight}`
    case 'mirror_rounds_only':
      return `m:${mirrorLeft}/${mirrorRight}`
    case 'mirror_rounds_then_games':
      return `m:${mirrorLeft}/${mirrorRight}|g:${gamesLeft}/${gamesRight}`
    case 'games_then_mirror_rounds':
    default:
      return `g:${gamesLeft}/${gamesRight}|m:${mirrorLeft}/${mirrorRight}`
  }
}

function createEmptyMetricSummary(_mode: FitnessMode): EvoMetricSummary {
  return {
    ...{
      gamesPlayed: 0,
      gamesWon: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      mirrorRoundsPlayed: 0,
      mirrorRoundsWon: 0,
      chinchonWins: 0,
      orphanRoundsPlayed: 0,
    },
    gameWinRate: 0,
    roundWinRate: 0,
    mirrorRoundRate: 0,
    primaryRate: 0,
    secondaryRate: 0,
  }
}

function roundFitnessRate(rate: number) {
  return Math.round(rate * FITNESS_RATE_SCALE)
}

export function buildFitnessSummary(
  mode: FitnessMode,
  metrics: BotMirrorMetrics,
): Pick<EvoMetricSummary, 'gameWinRate' | 'roundWinRate' | 'mirrorRoundRate' | 'primaryRate' | 'secondaryRate'> & {
  fitness: number
} {
  const descriptor = getFitnessModeDescriptor(mode)
  const gameWinRate = getPercentOfTotal(metrics.gamesWon, metrics.gamesPlayed)
  const roundWinRate = getPercentOfTotal(metrics.roundsWon, metrics.roundsPlayed)
  const mirrorRoundRate = getPercentOfTotal(metrics.mirrorRoundsWon, metrics.mirrorRoundsPlayed)
  const primaryRate = descriptor.primaryKey === 'games' ? gameWinRate : mirrorRoundRate
  const secondaryRate = descriptor.secondaryKey === 'games'
    ? gameWinRate
    : descriptor.secondaryKey === 'mirror_rounds'
      ? mirrorRoundRate
      : 0

  const primaryScore = roundFitnessRate(primaryRate)
  const secondaryScore = roundFitnessRate(secondaryRate)
  const fitness = descriptor.secondaryKey == null
    ? primaryScore
    : primaryScore * FITNESS_SECONDARY_MULTIPLIER + secondaryScore

  return {
    fitness,
    gameWinRate,
    roundWinRate,
    mirrorRoundRate,
    primaryRate,
    secondaryRate,
  }
}

function combineMetricSummary(mode: FitnessMode, metrics: BotMirrorMetrics): EvoMetricSummary & { fitness: number } {
  return {
    ...metrics,
    ...buildFitnessSummary(mode, metrics),
  }
}

function cloneMetricSummary<T extends EvoMetricSummary | undefined | null>(summary: T): T {
  if (!summary) return summary
  return { ...summary } as T
}

function pickMetricSummary(summary: EvoMetricSummary): EvoMetricSummary {
  return {
    gamesPlayed: summary.gamesPlayed,
    gamesWon: summary.gamesWon,
    roundsPlayed: summary.roundsPlayed,
    roundsWon: summary.roundsWon,
    mirrorRoundsPlayed: summary.mirrorRoundsPlayed,
    mirrorRoundsWon: summary.mirrorRoundsWon,
    chinchonWins: summary.chinchonWins,
    orphanRoundsPlayed: summary.orphanRoundsPlayed,
    gameWinRate: summary.gameWinRate,
    roundWinRate: summary.roundWinRate,
    mirrorRoundRate: summary.mirrorRoundRate,
    primaryRate: summary.primaryRate,
    secondaryRate: summary.secondaryRate,
  }
}

function createFallbackIndividual(config: BotConfig, fitnessMode: FitnessMode = defaultEvoConfig.fitnessMode): EvoIndividual {
  return {
    id: 0,
    config: normalizeBotConfig(config),
    fitnessMode,
    ...createEmptyMetricSummary(fitnessMode),
    fitness: 0,
  }
}

function cloneIndividual(individual: EvoIndividual): EvoIndividual {
  return {
    ...individual,
    config: cloneBotConfig(individual.config),
    originalMetrics: cloneMetricSummary(individual.originalMetrics),
    meta: individual.meta ? { ...individual.meta, mutatedGenes: individual.meta.mutatedGenes?.slice() } : undefined,
  }
}

function cloneGenerationCandidate(progress: EvolutionCandidateProgress): EvolutionCandidateProgress {
  return {
    ...progress,
    originalMetrics: cloneMetricSummary(progress.originalMetrics),
    mutatedGenes: progress.mutatedGenes.slice(),
  }
}

function createGenerationCandidateProgress(
  config: BotConfig,
  slotIndex: number,
  generation: number,
  meta?: EvoIndividual['meta'],
): EvolutionCandidateProgress {
  return {
    id: null,
    generation,
    slotIndex,
    name: config.name,
    emoji: config.emoji,
    status: 'pending',
    progress: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    mirrorRoundsPlayed: 0,
    mirrorRoundsWon: 0,
    chinchonWins: 0,
    orphanRoundsPlayed: 0,
    primaryRate: 0,
    secondaryRate: 0,
    stableStop: false,
    originalMetrics: null,
    sourceKind: meta?.sourceKind ?? 'initial_mutation',
    parentAId: meta?.parentAId,
    parentBId: meta?.parentBId,
    mutatedGenes: meta?.mutatedGenes?.slice() ?? [],
  }
}

function buildGenerationCandidateFromIndividual(
  individual: EvoIndividual,
  slotIndex: number,
  generation: number,
): EvolutionCandidateProgress {
  return {
    id: individual.id,
    generation,
    slotIndex,
    name: individual.config.name,
    emoji: individual.config.emoji,
    status: 'done',
    progress: 100,
    gamesPlayed: individual.gamesPlayed,
    gamesWon: individual.gamesWon,
    roundsPlayed: individual.roundsPlayed,
    roundsWon: individual.roundsWon,
    mirrorRoundsPlayed: individual.mirrorRoundsPlayed,
    mirrorRoundsWon: individual.mirrorRoundsWon,
    chinchonWins: individual.chinchonWins,
    orphanRoundsPlayed: individual.orphanRoundsPlayed,
    primaryRate: individual.primaryRate,
    secondaryRate: individual.secondaryRate,
    stableStop: false,
    originalMetrics: cloneMetricSummary(individual.originalMetrics) ?? null,
    sourceKind: individual.meta?.sourceKind ?? (generation === 0 ? 'seed' : 'elite'),
    parentAId: individual.meta?.parentAId,
    parentBId: individual.meta?.parentBId,
    mutatedGenes: individual.meta?.mutatedGenes?.slice() ?? [],
  }
}

function compareIndividuals(left: EvoIndividual, right: EvoIndividual) {
  return left.fitness - right.fitness
}

function forceConfigVariation(config: BotConfig, reference: BotConfig, rng: () => number): BotConfig {
  let next = normalizeBotConfig(config)
  const normalizedReference = normalizeBotConfig(reference)

  if (!configsAreEquivalent(next, normalizedReference)) {
    return next
  }

  const mutableGenes = GENE_MAP.filter(descriptor => {
    if (descriptor.type === 'continuous') {
      return descriptor.max > descriptor.min
    }
    if (descriptor.type === 'categorical') {
      return descriptor.options.length > 1
    }
    return true
  })

  for (let attempt = 0; attempt < mutableGenes.length * 2; attempt += 1) {
    const descriptor = randomChoice(mutableGenes, rng)
    const currentValue = getGeneValue(next, descriptor.path)
    let alternatives: GeneValue[] = []

    if (descriptor.type === 'continuous') {
      const values: number[] = []
      for (let value = descriptor.min; value <= descriptor.max; value += descriptor.integer ? 1 : 0.5) {
        const normalizedValue = descriptor.integer ? Math.round(value) : value
        if (normalizedValue !== currentValue) values.push(normalizedValue)
        if (!descriptor.integer && values.length > 40) break
      }
      alternatives = values
    } else if (descriptor.type === 'categorical') {
      alternatives = descriptor.options.filter(option => option !== currentValue)
    } else {
      alternatives = [!Boolean(currentValue)]
    }

    if (alternatives.length === 0) continue
    next = setGeneValue(next, descriptor.path, randomChoice(alternatives, rng))
    if (!configsAreEquivalent(next, normalizedReference)) {
      return next
    }
  }

  return next
}

function buildHallOfFame(individuals: EvoIndividual[]) {
  const bestByGenome = new Map<string, EvoIndividual>()
  for (const individual of individuals) {
    const key = serializeGeneValues(individual.config)
    const existing = bestByGenome.get(key)
    if (!existing || compareIndividuals(individual, existing) > 0) {
      bestByGenome.set(key, cloneIndividual(individual))
    }
  }
  return bestByGenome
}

function buildEvolutionVariantName(seedName: string, generation: number, ordinal: number) {
  const baseName = seedName.trim() || 'Bot'
  const tag = generation <= 0 ? `Evo-${ordinal + 1}` : `Evo-${generation}.${ordinal + 1}`
  const maxBaseLength = Math.max(4, 26 - tag.length - 1)
  return `${baseName.slice(0, maxBaseLength)} ${tag}`.trim()
}

function applyEvolutionIdentity(
  config: BotConfig,
  seedConfig: Pick<BotConfig, 'name' | 'emoji'>,
  generation: number,
  ordinal: number,
): BotConfig {
  const next = cloneBotConfig(config)
  next.name = buildEvolutionVariantName(seedConfig.name, generation, ordinal)
  next.emoji = seedConfig.emoji
  return next
}

export function getGeneValue(config: BotConfig, path: string): GeneValue {
  return getPathValue(config, path)
}

export function setGeneValue(config: BotConfig, path: string, value: GeneValue): BotConfig {
  const next = cloneBotConfig(config)
  setPathValue(next, path, value)
  return normalizeBotConfig(next)
}

export function enforceScoreRulesConstraint(rules: ScoreRule[]): ScoreRule[] {
  const next = SCORE_RULE_TEMPLATE.map((rule, index) => ({
    minScore: rule.minScore,
    maxResto: clamp(Math.round(rules[index]?.maxResto ?? rule.maxResto), 0, 5),
  }))

  for (let index = 1; index < next.length; index += 1) {
    if (next[index].maxResto > next[index - 1].maxResto) {
      next[index].maxResto = next[index - 1].maxResto
    }
  }

  return next
}

export function normalizeBotConfig(config: BotConfig): BotConfig {
  const next = cloneBotConfig(config)
  next.cut.scoreRules = enforceScoreRulesConstraint(next.cut.scoreRules ?? SCORE_RULE_TEMPLATE)

  for (const descriptor of GENE_MAP) {
    const currentValue = getPathValue(next, descriptor.path)
    setPathValue(next, descriptor.path, normalizeGeneValue(descriptor, currentValue))
  }

  next.cut.scoreRules = enforceScoreRulesConstraint(next.cut.scoreRules)
  return next
}

export function mutateConfig(
  config: BotConfig,
  rate: number,
  sigma: number,
  rng: () => number,
): { config: BotConfig; mutatedGenes: string[] } {
  const next = cloneBotConfig(config)
  const mutatedGenes: string[] = []

  for (const descriptor of GENE_MAP) {
    if (rng() >= rate) continue

    const currentValue = getPathValue(next, descriptor.path)
    let mutatedValue: GeneValue = currentValue

    if (descriptor.type === 'continuous') {
      const drift = gaussian(rng) * sigma
      mutatedValue = descriptor.integer
        ? Math.round(clamp(Number(currentValue) + drift, descriptor.min, descriptor.max))
        : clamp(Number(currentValue) + drift, descriptor.min, descriptor.max)
    } else if (descriptor.type === 'categorical') {
      const options = descriptor.options.filter(option => option !== currentValue)
      mutatedValue = options.length > 0 ? randomChoice(options, rng) : descriptor.options[0]
    } else {
      mutatedValue = !Boolean(currentValue)
    }

    setPathValue(next, descriptor.path, mutatedValue)
    mutatedGenes.push(descriptor.path)
  }

  next.cut.scoreRules = enforceScoreRulesConstraint(next.cut.scoreRules)
  return { config: normalizeBotConfig(next), mutatedGenes }
}

export function crossoverConfigs(
  parentA: BotConfig,
  parentB: BotConfig,
  rate: number,
  rng: () => number,
): [BotConfig, BotConfig] {
  if (rng() > rate) {
    return [normalizeBotConfig(parentA), normalizeBotConfig(parentB)]
  }

  const childA = cloneBotConfig(parentA)
  const childB = cloneBotConfig(parentB)

  for (const descriptor of GENE_MAP) {
    const valueA = getPathValue(parentA, descriptor.path)
    const valueB = getPathValue(parentB, descriptor.path)

    if (descriptor.type === 'continuous') {
      const low = Math.min(Number(valueA), Number(valueB))
      const high = Math.max(Number(valueA), Number(valueB))
      const span = high - low
      const min = clamp(low - span * BLX_ALPHA, descriptor.min, descriptor.max)
      const max = clamp(high + span * BLX_ALPHA, descriptor.min, descriptor.max)
      const sampleA = min + (max - min) * rng()
      const sampleB = min + (max - min) * rng()
      setPathValue(
        childA,
        descriptor.path,
        descriptor.integer ? Math.round(sampleA) : sampleA,
      )
      setPathValue(
        childB,
        descriptor.path,
        descriptor.integer ? Math.round(sampleB) : sampleB,
      )
      continue
    }

    setPathValue(childA, descriptor.path, rng() < 0.5 ? valueA : valueB)
    setPathValue(childB, descriptor.path, rng() < 0.5 ? valueA : valueB)
  }

  childA.cut.scoreRules = enforceScoreRulesConstraint(childA.cut.scoreRules)
  childB.cut.scoreRules = enforceScoreRulesConstraint(childB.cut.scoreRules)

  return [normalizeBotConfig(childA), normalizeBotConfig(childB)]
}

export function selectParent(
  population: EvoIndividual[],
  method: 'tournament' | 'roulette',
  tournamentK: number,
  rng: () => number,
): number {
  if (population.length <= 1) return 0

  if (method === 'roulette') {
    const totalFitness = population.reduce((sum, individual) => sum + individual.fitness, 0)
    if (totalFitness <= 0) return randomInt(0, population.length - 1, rng)

    const target = rng() * totalFitness
    let cumulative = 0
    for (let index = 0; index < population.length; index += 1) {
      cumulative += population[index].fitness
      if (cumulative >= target) return index
    }
    return population.length - 1
  }

  const effectiveK = Math.min(Math.max(2, tournamentK), population.length)
  const pool = population.map((_, index) => index)
  const picks: number[] = []

  for (let count = 0; count < effectiveK; count += 1) {
    const pickIndex = randomInt(0, pool.length - 1, rng)
    picks.push(pool[pickIndex])
    pool.splice(pickIndex, 1)
  }

  let bestIndex = picks[0]
  for (const index of picks.slice(1)) {
    if (compareIndividuals(population[index], population[bestIndex]) > 0) {
      bestIndex = index
    }
  }
  return bestIndex
}

export function generateInitialPopulation(
  seed: BotConfig,
  size: number,
  mutationRate: number,
  mutationSigma: number,
  rng: () => number,
  options: InitialPopulationOptions = {},
): BotConfig[] {
  const population: BotConfig[] = []
  const referenceConfig = options.referenceConfig ? normalizeBotConfig(options.referenceConfig) : null

  if (options.includeSeed !== false) {
    population.push(normalizeBotConfig(seed))
  }

  while (population.length < size) {
    const mutated = mutateConfig(seed, mutationRate, mutationSigma * 2, rng)
    const variant = referenceConfig ? forceConfigVariation(mutated.config, referenceConfig, rng) : mutated.config
    population.push(applyEvolutionIdentity(variant, seed, 0, population.length))
  }
  return population
}

export async function evaluateFitness(
  individual: BotConfig,
  rival: BotRuntime,
  sims: number,
  fitnessMode: FitnessMode,
  options: EvaluateFitnessOptions = {},
): Promise<FitnessEvaluation> {
  const yieldEveryGames = options.yieldEveryGames ?? DEFAULT_YIELD_EVERY_GAMES
  const stabilizeDecimals = Math.max(0, Math.min(3, Math.round(options.stabilizeDecimals ?? defaultEvoConfig.stabilizeDecimals)))
  const candidate = buildBotFromConfig(individual)
  const bots: BotRuntime[] = [candidate, rival]
  const simulatePair = options.simulatePair ?? (runtimeBots => simulateGamePairWithBots(runtimeBots, 0, 1))
  const metrics = {
    gamesPlayed: 0,
    gamesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    mirrorRoundsPlayed: 0,
    mirrorRoundsWon: 0,
    chinchonWins: 0,
    orphanRoundsPlayed: 0,
  }
  let rivalGamesWon = 0
  let rivalMirrorRoundsWon = 0
  let lastStableKey: string | null = null
  let stableStreak = 0
  let lastReportedBucket = -1
  let endedByStability = false
  let emittedCompletedPartial = false

  const buildPartialEvaluation = (cancelled = false): FitnessEvaluation => {
    const summary = combineMetricSummary(fitnessMode, metrics)
    return {
      ...summary,
      cancelled,
    }
  }

  async function emitPartial(progress: number, completed = false, stableStop = false) {
    if (!options.onPartial) return
    await options.onPartial({
      ...buildPartialEvaluation(false),
      progress: completed ? 100 : progress,
      stableStop,
    })
  }

  for (let sim = 0; sim < sims; sim += 1) {
    if (options.shouldCancel?.()) {
      return buildPartialEvaluation(true)
    }

    const [gameA, gameB] = simulatePair(bots)
    const pairSummary = summarizeSimulatedPair(gameA, gameB)
    metrics.gamesPlayed += pairSummary.bots[0].gamesPlayed
    metrics.gamesWon += pairSummary.bots[0].gamesWon
    metrics.roundsPlayed += pairSummary.bots[0].roundsPlayed
    metrics.roundsWon += pairSummary.bots[0].roundsWon
    metrics.mirrorRoundsPlayed += pairSummary.bots[0].mirrorRoundsPlayed
    metrics.mirrorRoundsWon += pairSummary.bots[0].mirrorRoundsWon
    metrics.chinchonWins += pairSummary.bots[0].chinchonWins
    metrics.orphanRoundsPlayed += pairSummary.bots[0].orphanRoundsPlayed
    rivalGamesWon += pairSummary.bots[1].gamesWon
    rivalMirrorRoundsWon += pairSummary.bots[1].mirrorRoundsWon

    if (options.useStabilized) {
      const stableKey = buildStabilityKey(
        fitnessMode,
        metrics,
        rivalGamesWon,
        rivalMirrorRoundsWon,
        stabilizeDecimals,
      )
      stableStreak = lastStableKey === stableKey ? stableStreak + 1 : 1
      lastStableKey = stableKey
      if (sim + 1 >= MIN_SIMULATIONS_BEFORE_STABLE_STOP && stableStreak >= STABLE_SIMULATION_STREAK) {
        endedByStability = true
        await emitPartial(Math.round(((sim + 1) / sims) * 100), true, true)
        return {
          ...buildPartialEvaluation(false),
          stableStop: true,
        }
      }
    }

    const completedSims = sim + 1
    const progress = Math.round((completedSims / sims) * 100)
    const progressBucket = Math.min(
      EVALUATION_PROGRESS_BUCKETS,
      Math.floor((completedSims / Math.max(1, sims)) * EVALUATION_PROGRESS_BUCKETS),
    )
    if (
      EVALUATION_WARMUP_MARKS.includes(completedSims)
      || progressBucket > lastReportedBucket
      || completedSims >= sims
    ) {
      lastReportedBucket = progressBucket
      if (completedSims >= sims) emittedCompletedPartial = true
      await emitPartial(progress, completedSims >= sims)
    }

    if (yieldEveryGames > 0 && metrics.gamesPlayed % yieldEveryGames === 0) {
      await options.yieldControl?.()
      if (options.shouldCancel?.()) {
        return buildPartialEvaluation(true)
      }
    }
  }

  if (!endedByStability && !emittedCompletedPartial) {
    await emitPartial(100, true)
  }
  return buildPartialEvaluation(false)
}

export function checkStopCondition(
  generation: number,
  bestIndividual: EvoIndividual,
  stagnationCount: number,
  config: EvolutionRunConfig,
): StopReason | null {
  if (generation >= config.maxGenerations) return 'max_generations'
  if (config.absoluteMargin != null && bestIndividual.primaryRate >= 50 + config.absoluteMargin) return 'absolute_margin'
  if (config.targetRate != null && bestIndividual.primaryRate >= config.targetRate) return 'target_rate'
  if (config.stagnationLimit != null && stagnationCount >= config.stagnationLimit) return 'stagnation'
  return null
}

export function computeDiversity(population: EvoIndividual[]): number {
  if (population.length <= 1) return 0

  const variances = GENE_MAP.map(descriptor => {
    const values = population.map(individual =>
      toNormalizedGeneValue(descriptor, getPathValue(individual.config, descriptor.path)),
    )
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
    return clamp(variance / 0.25, 0, 1)
  })

  return variances.reduce((sum, variance) => sum + variance, 0) / variances.length
}

export function computeMetrics(generation: number, population: EvoIndividual[]): EvoMetricsTick {
  if (population.length === 0) {
    return {
      generation,
      bestFitness: 0,
      avgFitness: 0,
      worstFitness: 0,
      bestPrimaryRate: 0,
      avgPrimaryRate: 0,
      worstPrimaryRate: 0,
      bestSecondaryRate: 0,
      avgSecondaryRate: 0,
      bestGameWinRate: 0,
      avgGameWinRate: 0,
      bestMirrorRoundRate: 0,
      avgMirrorRoundRate: 0,
      diversity: 0,
    }
  }

  const bestFitness = Math.max(...population.map(individual => individual.fitness))
  const worstFitness = Math.min(...population.map(individual => individual.fitness))
  const avgFitness = population.reduce((sum, individual) => sum + individual.fitness, 0) / population.length
  const bestPrimaryRate = Math.max(...population.map(individual => individual.primaryRate))
  const worstPrimaryRate = Math.min(...population.map(individual => individual.primaryRate))
  const avgPrimaryRate = population.reduce((sum, individual) => sum + individual.primaryRate, 0) / population.length
  const bestSecondaryRate = Math.max(...population.map(individual => individual.secondaryRate))
  const avgSecondaryRate = population.reduce((sum, individual) => sum + individual.secondaryRate, 0) / population.length
  const bestGameWinRate = Math.max(...population.map(individual => individual.gameWinRate))
  const avgGameWinRate = population.reduce((sum, individual) => sum + individual.gameWinRate, 0) / population.length
  const bestMirrorRoundRate = Math.max(...population.map(individual => individual.mirrorRoundRate))
  const avgMirrorRoundRate = population.reduce((sum, individual) => sum + individual.mirrorRoundRate, 0) / population.length

  return {
    generation,
    bestFitness,
    avgFitness,
    worstFitness,
    bestPrimaryRate,
    avgPrimaryRate,
    worstPrimaryRate,
    bestSecondaryRate,
    avgSecondaryRate,
    bestGameWinRate,
    avgGameWinRate,
    bestMirrorRoundRate,
    avgMirrorRoundRate,
    diversity: computeDiversity(population),
  }
}

export function buildEvolutionDescription(
  rivalName: string,
  fitnessMode: FitnessMode,
  primaryRate: number,
  secondaryRate: number,
  generations: number,
) {
  const descriptor = getFitnessModeDescriptor(fitnessMode)
  const secondaryLabel = descriptor.secondaryLabel
    ? ` ${descriptor.secondaryLabel}: ${secondaryRate.toFixed(1)}%.`
    : ''
  return `Evolucionado vs ${rivalName}. Criterio: ${descriptor.shortLabel}. ${descriptor.primaryLabel}: ${primaryRate.toFixed(1)}%.${secondaryLabel} ${generations} generaciones.`
    .slice(0, DEFAULT_EXPORT_DESCRIPTION_MAX)
}

export function prepareForExport(
  config: BotConfig,
  name: string,
  emoji: string,
  description = '',
): BotConfig {
  const next = normalizeBotConfig(config)
  return {
    ...next,
    id: `custom-${Date.now()}`,
    name: name.trim().slice(0, DEFAULT_EXPORT_NAME_MAX) || 'Mi Bot',
    emoji,
    description: description.trim().slice(0, DEFAULT_EXPORT_DESCRIPTION_MAX),
    colorIdx: next.colorIdx ?? 0,
    color: undefined,
    text: undefined,
    bg: undefined,
    border: undefined,
  }
}

export function getChangedGeneRows(seed: BotConfig, candidate: BotConfig) {
  return GENE_MAP.flatMap(descriptor => {
    const before = getGeneValue(seed, descriptor.path)
    const after = getGeneValue(candidate, descriptor.path)
    if (before === after) return []
    return [{ path: descriptor.path, before, after }]
  })
}

function describeNumericDirection(
  before: number,
  after: number,
  higherText: string,
  lowerText: string,
) {
  return after > before ? higherText : lowerText
}

export function explainGeneChange(path: string, before: GeneValue, after: GeneValue) {
  if (path.startsWith('cut.scoreRules.')) {
    const index = Number(path.split('.')[2] ?? 0)
    const threshold = SCORE_RULE_TEMPLATE[index]?.minScore ?? 0
    return describeNumericDirection(
      Number(before),
      Number(after),
      `Con ${threshold}+ puntos acumulados tolera un resto más alto antes de cortar.`,
      `Con ${threshold}+ puntos acumulados exige un resto más bajo para cortar.`,
    )
  }

  switch (path) {
    case 'global.temperature':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Juega más flexible y acepta líneas menos puras antes de definirse.',
        'Juega más estricto y exige manos más limpias para sostener una línea.',
      )
    case 'global.mistakeRate':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Introduce más ruido y variación en las decisiones.',
        'Reduce el ruido y vuelve al bot más consistente.',
      )
    case 'draw.improvementThreshold':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Pide mejoras más claras antes de tomar una carta.',
        'Acepta mejoras más marginales al robar.',
      )
    case 'draw.structuralPriority':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Prioriza más la estructura futura de melds y proyectos.',
        'Se enfoca menos en la estructura y más en ganancias inmediatas.',
      )
    case 'draw.infoAversion':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Evita más las jugadas que le regalan información al rival.',
        'Tolera más el intercambio de información con tal de mejorar la mano.',
      )
    case 'draw.chinchonBias':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Persigue con más fuerza líneas de chinchón.',
        'Afloja la persecución de chinchón y favorece cierres más prácticos.',
      )
    case 'draw.tempoPreference':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Acelera el plan y valora más cerrar antes.',
        'Se toma más tiempo para cocinar la mano antes de cortar.',
      )
    case 'discard.evalScope':
      return after === 'full'
        ? 'Pasa a una evaluación de descarte más completa y costosa.'
        : 'Pasa a una evaluación de descarte más rápida y liviana.'
    case 'discard.restoBias':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'El descarte se guía más por bajar el resto cuanto antes.',
        'El descarte se despega un poco del resto inmediato.',
      )
    case 'discard.potentialBias':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Protege más cartas con potencial de armar juego después.',
        'Sacrifica más potencial futuro a cambio de resolver el presente.',
      )
    case 'discard.rankBias':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Pesa más el valor nominal de la carta al decidir qué tirar.',
        'Pesa menos el valor nominal y más la estructura de la mano.',
      )
    case 'discard.jokerProtection':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Cuida más las líneas donde intervienen comodines.',
        'Se anima más a romper estructuras con comodines si conviene.',
      )
    case 'cut.maxFree':
      return Number(after) > Number(before)
        ? 'Permite cortar con una carta libre más, o sea se vuelve más permisivo.'
        : 'Restringe el corte y exige manos más cerradas.'
    case 'cut.baseResto':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Tolera un resto más alto para cortar en la regla base.',
        'Se vuelve más exigente con el resto antes de cortar.',
      )
    case 'cut.useScoreRules':
      return after
        ? 'Activa reglas de corte sensibles al marcador acumulado.'
        : 'Ignora el marcador acumulado y usa una regla base más plana.'
    case 'cut.chinchonPursuit':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Insiste más en aguantar por un chinchón antes de cerrar.',
        'Abandona antes la idea de chinchón para cerrar líneas más seguras.',
      )
    case 'cut.chinchonThreshold':
      return Number(after) > Number(before)
        ? 'Espera una condición más tardía antes de comprometerse con chinchón.'
        : 'Se habilita antes a jugar por chinchón.'
    case 'cut.minus10Pursuit':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Persigue con más ganas manos de menos diez.',
        'Prioriza menos el menos diez y más el cierre normal.',
      )
    case 'cut.deckUrgency':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Le da más importancia a cerrar cuando el mazo aprieta.',
        'Tolera mejor mazos cortos sin apurarse tanto a cortar.',
      )
    case 'cut.leadProtection':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Defiende más una ventaja en el marcador y evita regalar remontadas.',
        'Defiende menos la ventaja y acepta algo más de riesgo.',
      )
    case 'cut.desperationMode':
      return describeNumericDirection(
        Number(before),
        Number(after),
        'Activa antes el modo desesperado cuando va atrás.',
        'Mantiene más la calma y tarda más en forzar jugadas de remontada.',
      )
    default:
      if (typeof before === 'boolean' && typeof after === 'boolean') {
        return after ? 'Activa este criterio durante la toma de decisiones.' : 'Desactiva este criterio para simplificar la decisión.'
      }
      if (typeof before === 'number' && typeof after === 'number') {
        return describeNumericDirection(
          before,
          after,
          'Sube el peso de este criterio dentro del bot.',
          'Baja el peso de este criterio dentro del bot.',
        )
      }
      return `Cambia este parámetro de ${String(before)} a ${String(after)}.`
  }
}

async function evaluatePopulation(
  drafts: DraftIndividual[],
  startId: number,
  generation: number,
  rivalRuntime: BotRuntime,
  originalRuntime: BotRuntime | null,
  simsPerEval: number,
  fitnessMode: FitnessMode,
  evaluate: NonNullable<RunEvolutionOptions['evaluate']>,
  options: EvaluateFitnessOptions & {
    concurrency?: number
    onEvaluated?: (progress: PopulationProgress) => void | Promise<void>
  },
): Promise<PopulationEvaluation> {
  const normalizedDrafts = drafts.map(draft => ({
    config: normalizeBotConfig(draft.config),
    meta: draft.meta,
  }))
  const individuals: Array<EvoIndividual | undefined> = new Array(drafts.length)
  const generationIndividuals = normalizedDrafts.map((draft, index) =>
    createGenerationCandidateProgress(draft.config, index, generation, draft.meta),
  )
  let totalGames = 0
  let evaluatedIndividuals = 0
  let nextIndex = 0
  let cancelled = false
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 1, drafts.length || 1))

  function getVisibleTotalGames() {
    return generationIndividuals.reduce((sum, individual) => sum + individual.gamesPlayed, 0)
  }

  async function runNext() {
    while (!cancelled) {
      if (options.shouldCancel?.()) {
        cancelled = true
        return
      }

      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= drafts.length) {
        return
      }

      const normalizedConfig = normalizedDrafts[currentIndex].config
      generationIndividuals[currentIndex] = {
        ...generationIndividuals[currentIndex],
        status: 'running',
        stableStop: false,
      }
      void options.onEvaluated?.({
        individuals: individuals.filter(Boolean) as EvoIndividual[],
        totalGames: getVisibleTotalGames(),
        evaluatedIndividuals,
        generationIndividuals: generationIndividuals.map(cloneGenerationCandidate),
      })

      const evaluation = await evaluate(normalizedConfig, rivalRuntime, simsPerEval, fitnessMode, {
        ...options,
        onPartial: partial => {
      generationIndividuals[currentIndex] = {
        ...generationIndividuals[currentIndex],
        status: partial.progress >= 100 ? 'done' : 'running',
        progress: partial.progress,
            gamesPlayed: partial.gamesPlayed,
            gamesWon: partial.gamesWon,
            roundsPlayed: partial.roundsPlayed,
            roundsWon: partial.roundsWon,
            mirrorRoundsPlayed: partial.mirrorRoundsPlayed,
            mirrorRoundsWon: partial.mirrorRoundsWon,
            chinchonWins: partial.chinchonWins,
            orphanRoundsPlayed: partial.orphanRoundsPlayed,
            primaryRate: partial.primaryRate,
            secondaryRate: partial.secondaryRate,
            stableStop: partial.stableStop,
          }
          void options.onEvaluated?.({
            individuals: individuals.filter(Boolean) as EvoIndividual[],
            totalGames: getVisibleTotalGames(),
            evaluatedIndividuals,
            generationIndividuals: generationIndividuals.map(cloneGenerationCandidate),
          })
        },
      })
      totalGames += evaluation.gamesPlayed

      if (evaluation.cancelled) {
        cancelled = true
        return
      }

      let originalMetrics: EvoMetricSummary | undefined
      if (originalRuntime && originalRuntime.id !== rivalRuntime.id) {
        const originalEvaluation = await evaluate(normalizedConfig, originalRuntime, simsPerEval, fitnessMode, {
          ...options,
          onPartial: undefined,
        })
        if (originalEvaluation.cancelled) {
          cancelled = true
          return
        }
        originalMetrics = pickMetricSummary(originalEvaluation)
      } else {
        originalMetrics = pickMetricSummary(evaluation)
      }

      individuals[currentIndex] = {
        id: startId + currentIndex,
        config: normalizedConfig,
        fitnessMode,
        fitness: evaluation.fitness,
        gamesPlayed: evaluation.gamesPlayed,
        gamesWon: evaluation.gamesWon,
        roundsPlayed: evaluation.roundsPlayed,
        roundsWon: evaluation.roundsWon,
        mirrorRoundsPlayed: evaluation.mirrorRoundsPlayed,
        mirrorRoundsWon: evaluation.mirrorRoundsWon,
        chinchonWins: evaluation.chinchonWins,
        orphanRoundsPlayed: evaluation.orphanRoundsPlayed,
        gameWinRate: evaluation.gameWinRate,
        roundWinRate: evaluation.roundWinRate,
        mirrorRoundRate: evaluation.mirrorRoundRate,
        primaryRate: evaluation.primaryRate,
        secondaryRate: evaluation.secondaryRate,
        originalMetrics,
        meta: normalizedDrafts[currentIndex].meta,
      }
      generationIndividuals[currentIndex] = {
        ...generationIndividuals[currentIndex],
        id: startId + currentIndex,
        status: 'done',
        progress: 100,
        gamesPlayed: evaluation.gamesPlayed,
        gamesWon: evaluation.gamesWon,
        roundsPlayed: evaluation.roundsPlayed,
        roundsWon: evaluation.roundsWon,
        mirrorRoundsPlayed: evaluation.mirrorRoundsPlayed,
        mirrorRoundsWon: evaluation.mirrorRoundsWon,
        chinchonWins: evaluation.chinchonWins,
        orphanRoundsPlayed: evaluation.orphanRoundsPlayed,
        primaryRate: evaluation.primaryRate,
        secondaryRate: evaluation.secondaryRate,
        stableStop: Boolean(evaluation.stableStop),
        originalMetrics: cloneMetricSummary(originalMetrics) ?? null,
      }
      evaluatedIndividuals += 1
      await options.onEvaluated?.({
        individuals: individuals.filter(Boolean) as EvoIndividual[],
        totalGames: getVisibleTotalGames(),
        evaluatedIndividuals,
        generationIndividuals: generationIndividuals.map(cloneGenerationCandidate),
      })
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runNext()))

  return {
    individuals: individuals.filter(Boolean) as EvoIndividual[],
    totalGames,
    cancelled,
  }
}

function buildNextGenerationDrafts(
  population: EvoIndividual[],
  seedConfig: BotConfig,
  config: EvolutionRunConfig,
  generation: number,
  rng: () => number,
  referenceConfig?: BotConfig | null,
): DraftIndividual[] {
  const sorted = [...population].sort((left, right) => compareIndividuals(right, left))
  const nextDrafts: DraftIndividual[] = sorted
    .slice(0, Math.min(config.elitismCount, population.length))
    .map((individual, index) => ({
      config: applyEvolutionIdentity(cloneBotConfig(individual.config), seedConfig, generation, index),
      meta: {
        sourceKind: 'elite',
        parentAId: individual.id,
        mutatedGenes: [],
      },
    }))

  while (nextDrafts.length < config.populationSize) {
    const parentAIndex = selectParent(population, config.selectionMethod, config.tournamentK, rng)
    let parentBIndex = selectParent(population, config.selectionMethod, config.tournamentK, rng)
    if (population.length > 1) {
      while (parentAIndex === parentBIndex) {
        parentBIndex = selectParent(population, config.selectionMethod, config.tournamentK, rng)
      }
    }

    const parentA = population[parentAIndex]
    const parentB = population[parentBIndex]
    const [childA, childB] = crossoverConfigs(parentA.config, parentB.config, config.crossoverRate, rng)
    const mutatedA = mutateConfig(childA, config.mutationRate, config.mutationSigma, rng)
    const mutatedB = mutateConfig(childB, config.mutationRate, config.mutationSigma, rng)

    nextDrafts.push({
      config: applyEvolutionIdentity(
        referenceConfig ? forceConfigVariation(mutatedA.config, referenceConfig, rng) : mutatedA.config,
        seedConfig,
        generation,
        nextDrafts.length,
      ),
      meta: {
        sourceKind: 'crossover',
        parentAId: parentA.id,
        parentBId: parentB.id,
        mutatedGenes: mutatedA.mutatedGenes,
      },
    })

    if (nextDrafts.length < config.populationSize) {
      nextDrafts.push({
        config: applyEvolutionIdentity(
          referenceConfig ? forceConfigVariation(mutatedB.config, referenceConfig, rng) : mutatedB.config,
          seedConfig,
          generation,
          nextDrafts.length,
        ),
        meta: {
          sourceKind: 'crossover',
          parentAId: parentA.id,
          parentBId: parentB.id,
          mutatedGenes: mutatedB.mutatedGenes,
        },
      })
    }
  }

  return nextDrafts
}

export async function runEvolution({
  seedConfig,
  rivalRuntime,
  originalRuntime = buildBotFromConfig(seedConfig),
  config,
  rng,
  evaluationConcurrency = 1,
  excludeExactReferenceConfig,
  shouldCancel,
  yieldControl,
  onGeneration,
  onProgress,
  evaluate = evaluateFitness,
}: RunEvolutionOptions): Promise<EvolutionRunResult> {
  const safePopulationSize = clamp(Math.round(config.populationSize), 2, MAX_EVOLUTION_POPULATION)
  const safeConfig: EvolutionRunConfig = {
    ...config,
    populationSize: safePopulationSize,
    simsPerEval: Math.max(1, Math.round(config.simsPerEval)),
    useStabilizedEvaluation: Boolean(config.useStabilizedEvaluation),
    stabilizeDecimals: clamp(Math.round(config.stabilizeDecimals), 0, 3),
    maxGenerations: Math.max(1, config.maxGenerations),
    elitismCount: Math.max(0, Math.min(config.elitismCount, safePopulationSize - 1)),
    tournamentK: Math.max(2, config.tournamentK),
  }

  let nextId = 0
  let generation = 0
  let totalEvaluations = 0
  let bestGeneration = 0
  let stagnationCount = 0
  const history: EvoMetricsTick[] = []
  const generationHistory: EvolutionGenerationRecord[] = []
  const hallOfFame = new Map<string, EvoIndividual>()
  const referenceConfig = excludeExactReferenceConfig ? normalizeBotConfig(excludeExactReferenceConfig) : null

  const evaluationOptions: EvaluateFitnessOptions = {
    shouldCancel,
    yieldControl,
    yieldEveryGames: DEFAULT_YIELD_EVERY_GAMES,
    useStabilized: safeConfig.useStabilizedEvaluation,
    stabilizeDecimals: safeConfig.stabilizeDecimals,
  }

  const initialDrafts = generateInitialPopulation(
    seedConfig,
    safeConfig.populationSize,
    safeConfig.mutationRate,
    safeConfig.mutationSigma,
    rng,
    {
      includeSeed: referenceConfig ? false : true,
      referenceConfig,
    },
  ).map((configItem, index): DraftIndividual => {
    const isSeed =
      !referenceConfig
      && index === 0
      && configsAreEquivalent(configItem, normalizeBotConfig(seedConfig))

    return {
      config: configItem,
      meta: {
        sourceKind: isSeed ? 'seed' : 'initial_mutation',
        mutatedGenes: [],
      },
    }
  })

  const initialPopulation = await evaluatePopulation(
    initialDrafts,
    nextId,
    generation,
    rivalRuntime,
    originalRuntime,
    safeConfig.simsPerEval,
    safeConfig.fitnessMode,
    evaluate,
    {
      ...evaluationOptions,
      concurrency: evaluationConcurrency,
      onEvaluated: async partial => {
        if (partial.individuals.length === 0) return
        const partialBest = partial.individuals.reduce(
          (best, current) => (compareIndividuals(current, best) > 0 ? current : best),
          partial.individuals[0],
        )
        await onProgress?.({
          phase: 'progress',
          generation,
          bestIndividual: cloneIndividual(partialBest),
          bestGeneration,
          metrics: computeMetrics(generation, partial.individuals),
          fitnessHistory: history.map(tick => ({ ...tick })),
          progress: 0,
          generationProgress: Math.min(100, Math.round((partial.evaluatedIndividuals / safeConfig.populationSize) * 100)),
          evaluatedIndividuals: partial.evaluatedIndividuals,
          populationSize: safeConfig.populationSize,
          totalEvaluations: partial.totalGames,
          generationIndividuals: partial.generationIndividuals,
        })
      },
    },
  )
  nextId += initialPopulation.individuals.length
  totalEvaluations += initialPopulation.totalGames

  let population = initialPopulation.individuals
  if (population.length === 0) {
    population = [createFallbackIndividual(seedConfig, safeConfig.fitnessMode)]
  }

  for (const [key, individual] of buildHallOfFame(population)) {
    hallOfFame.set(key, individual)
  }

  let bestIndividual = cloneIndividual(
    population.reduce((best, current) => (compareIndividuals(current, best) > 0 ? current : best), population[0]),
  )
  let metrics = computeMetrics(generation, population)
  history.push(metrics)

  await onGeneration?.({
    phase: 'generation_complete',
    generation,
    bestIndividual: cloneIndividual(bestIndividual),
    bestGeneration,
    metrics,
    fitnessHistory: history.map(tick => ({ ...tick })),
    progress: 0,
    generationProgress: 100,
    evaluatedIndividuals: population.length,
    populationSize: safeConfig.populationSize,
    totalEvaluations,
    generationIndividuals: population.map((individual, index) => buildGenerationCandidateFromIndividual(individual, index, generation)),
  })
  generationHistory.push({
    generation,
    individuals: population.map((individual, index) => buildGenerationCandidateFromIndividual(individual, index, generation)),
  })

  let stopReason: StopReason | null = initialPopulation.cancelled
    ? 'cancelled'
    : checkStopCondition(generation, bestIndividual, stagnationCount, safeConfig)

  while (!stopReason) {
    generation += 1

    const nextDrafts = buildNextGenerationDrafts(population, seedConfig, safeConfig, generation, rng, referenceConfig)
    const evaluatedPopulation = await evaluatePopulation(
      nextDrafts,
      nextId,
      generation,
      rivalRuntime,
      originalRuntime,
      safeConfig.simsPerEval,
      safeConfig.fitnessMode,
      evaluate,
      {
        ...evaluationOptions,
        concurrency: evaluationConcurrency,
        onEvaluated: async partial => {
          if (partial.individuals.length === 0) return
          const partialBest = partial.individuals.reduce(
            (best, current) => (compareIndividuals(current, best) > 0 ? current : best),
            partial.individuals[0],
          )
          const bestDuringProgress =
            compareIndividuals(partialBest, bestIndividual) > 0 ? partialBest : bestIndividual
          const bestGenerationDuringProgress =
            compareIndividuals(partialBest, bestIndividual) > 0 ? generation : bestGeneration
          await onProgress?.({
            phase: 'progress',
            generation,
            bestIndividual: cloneIndividual(bestDuringProgress),
            bestGeneration: bestGenerationDuringProgress,
            metrics: computeMetrics(generation, partial.individuals),
            fitnessHistory: history.map(tick => ({ ...tick })),
            progress: Math.min(
              99,
              Math.round(
                (((generation - 1) + partial.evaluatedIndividuals / safeConfig.populationSize)
                  / safeConfig.maxGenerations)
                  * 100,
              ),
            ),
            generationProgress: Math.min(100, Math.round((partial.evaluatedIndividuals / safeConfig.populationSize) * 100)),
            evaluatedIndividuals: partial.evaluatedIndividuals,
            populationSize: safeConfig.populationSize,
            totalEvaluations: totalEvaluations + partial.totalGames,
            generationIndividuals: partial.generationIndividuals,
          })
        },
      },
    )
    nextId += evaluatedPopulation.individuals.length
    totalEvaluations += evaluatedPopulation.totalGames

    if (evaluatedPopulation.individuals.length > 0) {
      population = evaluatedPopulation.individuals
      for (const [key, individual] of buildHallOfFame(population)) {
        const existing = hallOfFame.get(key)
        if (!existing || compareIndividuals(individual, existing) > 0) {
          hallOfFame.set(key, individual)
        }
      }
    }

    const generationBest = population.reduce((best, current) => (compareIndividuals(current, best) > 0 ? current : best), population[0])
    if (compareIndividuals(generationBest, bestIndividual) > 0) {
      bestIndividual = cloneIndividual(generationBest)
      bestGeneration = generation
      stagnationCount = 0
    } else {
      stagnationCount += 1
    }

    metrics = computeMetrics(generation, population)
    history.push(metrics)

    await onGeneration?.({
      phase: 'generation_complete',
      generation,
      bestIndividual: cloneIndividual(bestIndividual),
      bestGeneration,
      metrics,
      fitnessHistory: history.map(tick => ({ ...tick })),
      progress: Math.min(100, Math.round((generation / safeConfig.maxGenerations) * 100)),
      generationProgress: 100,
      evaluatedIndividuals: population.length,
      populationSize: safeConfig.populationSize,
      totalEvaluations,
      generationIndividuals: population.map((individual, index) => buildGenerationCandidateFromIndividual(individual, index, generation)),
    })
    generationHistory.push({
      generation,
      individuals: population.map((individual, index) => buildGenerationCandidateFromIndividual(individual, index, generation)),
    })

    if (evaluatedPopulation.cancelled || shouldCancel?.()) {
      stopReason = 'cancelled'
      break
    }

    stopReason = checkStopCondition(generation, bestIndividual, stagnationCount, safeConfig)
  }

  const topIndividuals = [...hallOfFame.values()]
    .sort((left, right) => compareIndividuals(right, left))
    .slice(0, 3)
    .map(cloneIndividual)

  return {
    bestIndividual,
    bestGeneration,
    totalGenerations: generation,
    totalEvaluations,
    stopReason: stopReason ?? 'cancelled',
    topIndividuals: topIndividuals.length > 0 ? topIndividuals : [cloneIndividual(bestIndividual)],
    fitnessHistory: history.map(tick => ({ ...tick })),
    generationHistory: generationHistory.map(record => ({
      generation: record.generation,
      individuals: record.individuals.map(cloneGenerationCandidate),
    })),
  }
}
