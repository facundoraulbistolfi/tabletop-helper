/// <reference lib="webworker" />

import { buildBotFromConfig, type BotConfig } from '../lib/chinchon-bot-presets'
import { evaluateFitness, type FitnessEvaluation, type FitnessMode } from '../lib/chinchon-evo-lab'

type EvaluateTaskRequest = {
  type: 'evaluate'
  jobId: number
  taskId: number
  individual: BotConfig
  rivalConfig: BotConfig
  sims: number
  fitnessMode: FitnessMode
  useStabilizedEvaluation: boolean
  stabilizeDecimals: number
}

type CancelTaskRequest = {
  type: 'cancel'
  jobId?: number
}

type EvalWorkerRequest = EvaluateTaskRequest | CancelTaskRequest

type EvalDoneMessage = {
  type: 'done'
  jobId: number
  taskId: number
  evaluation: FitnessEvaluation
}

type EvalProgressMessage = {
  type: 'progress'
  jobId: number
  taskId: number
  evaluation: FitnessEvaluation & {
    progress: number
    stableStop: boolean
  }
}

type EvalErrorMessage = {
  type: 'error'
  jobId: number
  taskId: number
  message: string
}

type EvalWorkerMessage = EvalDoneMessage | EvalProgressMessage | EvalErrorMessage

let activeJobId = -1

async function yieldToMessages() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

function post(message: EvalWorkerMessage) {
  self.postMessage(message)
}

self.onmessage = (event: MessageEvent<EvalWorkerRequest>) => {
  const request = event.data

  if (request.type === 'cancel') {
    if (request.jobId === undefined || request.jobId === activeJobId) {
      activeJobId = -1
    }
    return
  }

  activeJobId = request.jobId

  void (async () => {
    try {
      const evaluation = await evaluateFitness(
        request.individual,
        buildBotFromConfig(request.rivalConfig),
          request.sims,
          request.fitnessMode,
        {
          shouldCancel: () => activeJobId !== request.jobId,
          yieldControl: yieldToMessages,
          yieldEveryGames: 20,
          useStabilized: request.useStabilizedEvaluation,
          stabilizeDecimals: request.stabilizeDecimals,
          onPartial: evaluation => {
            post({
              type: 'progress',
              jobId: request.jobId,
              taskId: request.taskId,
              evaluation,
            })
          },
        },
      )

      post({
        type: 'done',
        jobId: request.jobId,
        taskId: request.taskId,
        evaluation,
      })
    } catch (error) {
      post({
        type: 'error',
        jobId: request.jobId,
        taskId: request.taskId,
        message: error instanceof Error ? error.message : 'Error desconocido evaluando individuo.',
      })
    } finally {
      if (activeJobId === request.jobId) {
        activeJobId = -1
      }
    }
  })()
}
