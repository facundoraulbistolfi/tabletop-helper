import type { ExperimentConfig, PopulationSnapshot, MetricsTick } from './genetic-lab/types'

export type WorkerJobBase = { jobId: number }

export type InitExperimentRequest = WorkerJobBase & {
  type: 'initExperiment'
  config: ExperimentConfig
}

export type StepRequest = WorkerJobBase & {
  type: 'step'
}

export type RunRequest = WorkerJobBase & {
  type: 'run'
  steps: number
  yieldEvery: number
}

export type CancelRequest = {
  type: 'cancel'
  jobId?: number
}

export type GeneticLabWorkerRequest =
  | InitExperimentRequest
  | StepRequest
  | RunRequest
  | CancelRequest

export type SnapshotMessage = {
  type: 'snapshot'
  jobId: number
  snapshot: PopulationSnapshot
  metrics: MetricsTick
  done: boolean
}

export type ErrorMessage = {
  type: 'error'
  jobId: number
  message: string
}

export type GeneticLabWorkerMessage = SnapshotMessage | ErrorMessage
