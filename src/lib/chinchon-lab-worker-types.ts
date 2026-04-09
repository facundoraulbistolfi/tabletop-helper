import type { TournamentFixtureMatch, TournamentMatchSnapshot, TournamentResults } from './chinchon-tournament'
import type { BotConfig } from './chinchon-bot-presets'
import type {
  EvoMetricSummary,
  EvoMetricsTick,
  EvolutionCandidateProgress,
  EvolutionGenerationRecord,
  FitnessMode,
  StopReason,
} from './chinchon-evo-lab'
import type { BotMirrorMetrics, SimulationExamples } from './chinchon-sim-metrics'

export type WorkerJobBase = {
  jobId: number
  customConfigs: BotConfig[]
}

export type RunSimRequest = WorkerJobBase & {
  type: 'runSim'
  simB0: number
  simB1: number
  numSims: number
  useStabilized: boolean
  stabilizeDecimals: number
}

export type RunTournamentRequest = WorkerJobBase & {
  type: 'runTournament'
  tourBots: number[]
  numSims: number
  useStabilized: boolean
  stabilizeDecimals: number
}

export type RunBenchmarkRequest = WorkerJobBase & {
  type: 'runBenchmark'
  botId: string
}

export type RunEvolutionRequest = WorkerJobBase & {
  type: 'runEvolution'
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

export type CancelRequest = {
  type: 'cancel'
  jobId?: number
}

export type LabWorkerRequest =
  | RunSimRequest
  | RunTournamentRequest
  | RunBenchmarkRequest
  | RunEvolutionRequest
  | CancelRequest

export type SimProgressMessage = {
  type: 'simProgress'
  jobId: number
  progress: number
  chartData: Record<string, number>[]
  botMetrics: [BotMirrorMetrics, BotMirrorMetrics]
  totalRounds: number
  splitMirrorRounds: number
  orphanRounds: number
  gameRateHistory: { simulations: number; rate0: number; rate1: number }[]
  mirrorRoundRateHistory: { mirrorRounds: number; rate0: number; rate1: number }[]
  examples?: SimulationExamples
  done: number
  stableStop: boolean
}

export type BenchmarkProgressMessage = {
  type: 'benchmarkProgress'
  jobId: number
  botId: string
  wins: number
  total: number
}

export type TournamentProgressMessage = {
  type: 'tournamentProgress'
  jobId: number
  progress: number
  results: TournamentResults
  currentMatch: TournamentFixtureMatch | null
  currentStats: TournamentMatchSnapshot | null
  matchSnapshots: (TournamentMatchSnapshot | null)[]
  done: boolean
}

export type EvoProgressMessage = {
  type: 'evoProgress'
  jobId: number
  phase: 'progress' | 'generation_complete'
  fitnessMode: FitnessMode
  primaryLabel: string
  secondaryLabel: string | null
  generation: number
  bestGeneration: number
  bestFitness: number
  avgFitness: number
  worstFitness: number
  bestPrimaryRate: number
  avgPrimaryRate: number
  bestSecondaryRate: number
  avgSecondaryRate: number
  bestMetrics: EvoMetricSummary
  progress: number
  generationProgress: number
  evaluatedIndividuals: number
  populationSize: number
  totalEvaluations: number
  generationIndividuals: EvolutionCandidateProgress[]
  fitnessHistory: EvoMetricsTick[]
}

export type EvoDoneMessage = {
  type: 'evoDone'
  jobId: number
  fitnessMode: FitnessMode
  primaryLabel: string
  secondaryLabel: string | null
  bestConfig: BotConfig
  bestFitness: number
  bestMetrics: EvoMetricSummary
  bestGeneration: number
  totalGenerations: number
  totalEvaluations: number
  stopReason: StopReason
  topConfigs: BotConfig[]
  topFitnesses: number[]
  topMetrics: EvoMetricSummary[]
  fitnessHistory: EvoMetricsTick[]
  generationHistory: EvolutionGenerationRecord[]
}

export type LabWorkerMessage =
  | SimProgressMessage
  | BenchmarkProgressMessage
  | TournamentProgressMessage
  | EvoProgressMessage
  | EvoDoneMessage
