/// <reference lib="webworker" />

import { createRng, type Rng } from '../lib/genetic-lab/rng'
import { initPopulation, nextGeneration } from '../lib/genetic-lab/engine'
import { computeMetrics } from '../lib/genetic-lab/metrics'
import { getProblem, type ProblemContext, type ProblemDefinition } from '../lib/genetic-lab/problems'
import type { ExperimentConfig, PopulationSnapshot } from '../lib/genetic-lab/types'
import type { GeneticLabWorkerMessage, GeneticLabWorkerRequest } from '../lib/genetic-lab-worker-types'

let activeJobId = -1
let currentConfig: ExperimentConfig | null = null
let currentRng: Rng | null = null
let currentSnapshot: PopulationSnapshot | null = null
let currentProblem: ProblemDefinition | null = null
let currentCtx: ProblemContext | null = null

function post(message: GeneticLabWorkerMessage) {
  self.postMessage(message)
}

function isJobActive(jobId: number) {
  return activeJobId === jobId
}

function hasReachedGenerationLimit() {
  return currentSnapshot !== null
    && currentConfig !== null
    && currentSnapshot.generation >= currentConfig.maxGenerations
}

async function yieldToMessages() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

function handleInit(request: Extract<GeneticLabWorkerRequest, { type: 'initExperiment' }>) {
  activeJobId = request.jobId
  currentConfig = request.config

  const problem = getProblem(request.config.problemId)
  if (!problem) {
    post({ type: 'error', jobId: request.jobId, message: `Problema desconocido: ${request.config.problemId}` })
    return
  }
  currentProblem = problem

  // Use a separate RNG for context (target generation) so the population RNG is independent
  const contextRng = createRng(request.config.seed)
  currentCtx = problem.buildContext(request.config, contextRng)

  currentRng = createRng(request.config.seed + 1)
  currentSnapshot = initPopulation(request.config, problem, currentCtx, currentRng)

  const metrics = computeMetrics(currentSnapshot)
  post({ type: 'snapshot', jobId: request.jobId, snapshot: currentSnapshot, metrics, done: true })
}

function handleStep(request: Extract<GeneticLabWorkerRequest, { type: 'step' }>) {
  activeJobId = request.jobId
  if (!currentSnapshot || !currentConfig || !currentProblem || !currentCtx || !currentRng) {
    post({ type: 'error', jobId: request.jobId, message: 'No hay experimento inicializado.' })
    return
  }

  if (hasReachedGenerationLimit()) {
    post({
      type: 'snapshot',
      jobId: request.jobId,
      snapshot: currentSnapshot,
      metrics: computeMetrics(currentSnapshot),
      done: true,
    })
    return
  }

  const result = nextGeneration(currentSnapshot, currentConfig, currentProblem, currentCtx, currentRng)
  currentSnapshot = result.snapshot
  post({ type: 'snapshot', jobId: request.jobId, snapshot: result.snapshot, metrics: result.metrics, done: true })
}

async function handleRun(request: Extract<GeneticLabWorkerRequest, { type: 'run' }>) {
  activeJobId = request.jobId
  if (!currentSnapshot || !currentConfig || !currentProblem || !currentCtx || !currentRng) {
    post({ type: 'error', jobId: request.jobId, message: 'No hay experimento inicializado.' })
    return
  }

  if (hasReachedGenerationLimit()) {
    post({
      type: 'snapshot',
      jobId: request.jobId,
      snapshot: currentSnapshot,
      metrics: computeMetrics(currentSnapshot),
      done: true,
    })
    return
  }

  const { steps, yieldEvery } = request
  let stepsRun = 0

  while (stepsRun < steps && isJobActive(request.jobId)) {
    const result = nextGeneration(currentSnapshot, currentConfig, currentProblem, currentCtx, currentRng)
    currentSnapshot = result.snapshot
    stepsRun++

    const reachedGenerationLimit = hasReachedGenerationLimit()
    const batchFinished = stepsRun >= steps
    if (stepsRun % yieldEvery === 0 || batchFinished || reachedGenerationLimit) {
      post({
        type: 'snapshot',
        jobId: request.jobId,
        snapshot: result.snapshot,
        metrics: result.metrics,
        done: reachedGenerationLimit,
      })
      await yieldToMessages()
    }

    if (reachedGenerationLimit) return
  }
}

self.onmessage = (e: MessageEvent<GeneticLabWorkerRequest>) => {
  const request = e.data

  if (request.type === 'cancel') {
    if (request.jobId === undefined || request.jobId === activeJobId) {
      activeJobId = -1
    }
    return
  }

  switch (request.type) {
    case 'initExperiment':
      handleInit(request)
      break
    case 'step':
      handleStep(request)
      break
    case 'run':
      void handleRun(request)
      break
  }
}
