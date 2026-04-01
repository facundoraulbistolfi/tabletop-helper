import type { TournamentFixtureMatch, TournamentMatchSnapshot, TournamentResults } from './chinchon-tournament'
import type { BotConfig } from './chinchon-bot-presets'

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

export type CancelRequest = {
  type: 'cancel'
  jobId?: number
}

export type LabWorkerRequest =
  | RunSimRequest
  | RunTournamentRequest
  | RunBenchmarkRequest
  | CancelRequest

export type SimProgressMessage = {
  type: 'simProgress'
  jobId: number
  progress: number
  chartData: Record<string, number>[]
  roundWins: [number, number]
  gameWins: [number, number]
  sweepWins: [number, number, number]
  totalRounds: number
  chinchonWins: [number, number]
  winRateHistory: { simulations: number; rate0: number; rate1: number }[]
  sweepRateHistory: { pairs: number; rate0: number; rate1: number }[]
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

export type LabWorkerMessage =
  | SimProgressMessage
  | BenchmarkProgressMessage
  | TournamentProgressMessage
