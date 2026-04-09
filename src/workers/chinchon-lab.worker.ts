/// <reference lib="webworker" />

import EvoEvalWorker from './chinchon-evo-eval.worker?worker'
import {
  MIN_SIMULATIONS_BEFORE_STABLE_STOP,
  STABLE_SIMULATION_STREAK,
  addBotMirrorMetrics,
  captureSimulationExamples,
  createEmptyBotMirrorMetrics,
  createEmptySimulationExamples,
  getNextStableStreak,
  getPercentOfTotal,
  getTruncatedWinRates,
  getWinRates,
  summarizeSimulatedPair,
} from '../lib/chinchon-sim-metrics'
import {
  TOURNAMENT_FIXTURE,
  buildTournamentMatchSnapshot,
  createEmptyTournamentResults,
  type TournamentResults,
} from '../lib/chinchon-tournament'
import { createRng } from '../lib/genetic-lab/rng'
import { createRuntimeBots, simulateGamePairWithBots } from '../lib/chinchon-arena-sim'
import { buildBotFromConfig, getBotConfig, type BotConfig } from '../lib/chinchon-bot-presets'
import {
  getFitnessModeDescriptor,
  runEvolution,
  type EvolutionProgressSnapshot,
  type FitnessEvaluation,
} from '../lib/chinchon-evo-lab'
import type {
  BenchmarkProgressMessage,
  EvoDoneMessage,
  EvoProgressMessage,
  LabWorkerMessage,
  LabWorkerRequest,
  SimProgressMessage,
  TournamentProgressMessage,
} from '../lib/chinchon-lab-worker-types'

let activeJobId = -1
let activeEvoEvalPool: EvoEvalPool | null = null

type EvoEvalTaskRequest = {
  type: 'evaluate'
  jobId: number
  taskId: number
  individual: BotConfig
  rivalConfig: BotConfig
  sims: number
  fitnessMode: Extract<LabWorkerRequest, { type: 'runEvolution' }>['fitnessMode']
  useStabilizedEvaluation: boolean
  stabilizeDecimals: number
}

type EvoEvalCancelRequest = {
  type: 'cancel'
  jobId?: number
}

type EvoEvalWorkerMessage =
  | {
      type: 'progress'
      jobId: number
      taskId: number
      evaluation: FitnessEvaluation & {
        progress: number
        stableStop: boolean
      }
    }
  | {
      type: 'done'
      jobId: number
      taskId: number
      evaluation: FitnessEvaluation
    }
  | {
      type: 'error'
      jobId: number
      taskId: number
      message: string
    }

type EvoEvalPoolTask = {
  taskId: number
  jobId: number
  individual: BotConfig
  rivalConfig: BotConfig
  sims: number
  onProgress?: (evaluation: FitnessEvaluation & { progress: number; stableStop: boolean }) => void
  resolve: (evaluation: FitnessEvaluation) => void
  reject: (error: Error) => void
}

type EvoEvalPool = {
  size: number
  evaluate: (
    individual: BotConfig,
    rivalConfig: BotConfig,
    sims: number,
    onProgress?: (evaluation: FitnessEvaluation & { progress: number; stableStop: boolean }) => void,
  ) => Promise<FitnessEvaluation>
  cancel: (jobId: number) => void
  dispose: () => void
}

function createCancelledEvaluation(): FitnessEvaluation {
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
    fitness: 0,
    gameWinRate: 0,
    roundWinRate: 0,
    mirrorRoundRate: 0,
    primaryRate: 0,
    secondaryRate: 0,
    cancelled: true,
  }
}

function getEvoEvaluationParallelism(populationSize: number) {
  const hardwareThreads =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4

  return Math.max(1, Math.min(populationSize, Math.max(1, hardwareThreads - 1), 6))
}

function createEvoEvalPool(
  jobId: number,
  fitnessMode: Extract<LabWorkerRequest, { type: 'runEvolution' }>['fitnessMode'],
  useStabilizedEvaluation: boolean,
  stabilizeDecimals: number,
  size: number,
): EvoEvalPool {
  const workers = Array.from({ length: size }, () => new EvoEvalWorker())
  const queue: EvoEvalPoolTask[] = []
  const inFlight = new Map<number, { task: EvoEvalPoolTask; workerIndex: number }>()
  const busyTaskIds: Array<number | null> = Array.from({ length: workers.length }, () => null)
  let nextTaskId = 0
  let disposed = false

  function releaseWorker(workerIndex: number) {
    busyTaskIds[workerIndex] = null
  }

  function pumpQueue() {
    if (disposed) return

    for (let workerIndex = 0; workerIndex < workers.length; workerIndex += 1) {
      if (busyTaskIds[workerIndex] != null) continue
      const task = queue.shift()
      if (!task) break

      busyTaskIds[workerIndex] = task.taskId
      inFlight.set(task.taskId, { task, workerIndex })

      const request: EvoEvalTaskRequest = {
        type: 'evaluate',
        jobId: task.jobId,
        taskId: task.taskId,
        individual: task.individual,
        rivalConfig: task.rivalConfig,
        sims: task.sims,
        fitnessMode,
        useStabilizedEvaluation,
        stabilizeDecimals,
      }
      workers[workerIndex].postMessage(request)
    }
  }

  workers.forEach((worker, workerIndex) => {
    worker.onmessage = (event: MessageEvent<EvoEvalWorkerMessage>) => {
      const message = event.data
      const inFlightTask = inFlight.get(message.taskId)
      if (!inFlightTask) return

      if (message.type === 'progress') {
        inFlightTask.task.onProgress?.(message.evaluation)
        return
      }

      inFlight.delete(message.taskId)
      releaseWorker(workerIndex)

      if (message.type === 'done') {
        inFlightTask.task.resolve(message.evaluation)
      } else {
        inFlightTask.task.reject(new Error(message.message))
      }

      pumpQueue()
    }

    worker.onerror = () => {
      const taskId = busyTaskIds[workerIndex]
      if (taskId == null) return
      const inFlightTask = inFlight.get(taskId)
      inFlight.delete(taskId)
      releaseWorker(workerIndex)
      inFlightTask?.task.reject(new Error('Falló un subworker de evaluación Evo.'))
      pumpQueue()
    }
  })

  return {
    size: workers.length,
    evaluate(individual, rivalConfig, sims, onProgress) {
      return new Promise<FitnessEvaluation>((resolve, reject) => {
        if (disposed) {
          resolve(createCancelledEvaluation())
          return
        }

        queue.push({
          taskId: nextTaskId,
          jobId,
          individual,
          rivalConfig,
          sims,
          onProgress,
          resolve,
          reject,
        })
        nextTaskId += 1
        pumpQueue()
      })
    },
    cancel(cancelJobId) {
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        if (queue[index].jobId !== cancelJobId) continue
        const [task] = queue.splice(index, 1)
        task.resolve(createCancelledEvaluation())
      }

      for (const worker of workers) {
        const cancelRequest: EvoEvalCancelRequest = { type: 'cancel', jobId: cancelJobId }
        worker.postMessage(cancelRequest)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true

      while (queue.length > 0) {
        const task = queue.shift()
        task?.resolve(createCancelledEvaluation())
      }

      for (const { task } of inFlight.values()) {
        task.resolve(createCancelledEvaluation())
      }
      inFlight.clear()

      for (const worker of workers) {
        worker.terminate()
      }
    },
  }
}

function cloneTournamentResults(results: TournamentResults): TournamentResults {
  return {
    wins: results.wins.map(row => [...row]),
    games: results.games.map(row => [...row]),
    mirrorWins: results.mirrorWins.map(row => [...row]),
    mirrorPairs: results.mirrorPairs.map(row => [...row]),
    chinchones: results.chinchones.map(row => [...row]),
  }
}

function buildChartData(
  drawsA: Record<number, number>,
  drawsB: Record<number, number>,
  botAName: string,
  botBName: string,
) {
  const keys = new Set([...Object.keys(drawsA), ...Object.keys(drawsB)].map(Number))
  return [...keys]
    .sort((a, b) => a - b)
    .map(cartas => ({
      cartas,
      [botAName]: drawsA[cartas] || 0,
      [botBName]: drawsB[cartas] || 0,
    }))
}

function post(message: LabWorkerMessage) {
  self.postMessage(message)
}

function isJobActive(jobId: number) {
  return activeJobId === jobId
}

async function yieldToMessages() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

async function runSim(request: Extract<LabWorkerRequest, { type: 'runSim' }>) {
  activeJobId = request.jobId
  const bots = createRuntimeBots(request.customConfigs)
  const drawsA: Record<number, number> = {}
  const drawsB: Record<number, number> = {}
  const botMetrics: SimProgressMessage['botMetrics'] = [
    createEmptyBotMirrorMetrics(),
    createEmptyBotMirrorMetrics(),
  ]
  const simExamples = createEmptySimulationExamples()
  let splitMirrorRounds = 0
  let orphanRounds = 0
  let totalRounds = 0
  let done = 0
  let lastStableRates: [number, number] | null = null
  let stableStreak = 0
  let examplesDirty = false
  const gameRateHistory: SimProgressMessage['gameRateHistory'] = []
  const mirrorRoundRateHistory: SimProgressMessage['mirrorRoundRateHistory'] = []
  const batchSize = request.numSims <= 100 ? 1 : request.numSims <= 1000 ? 5 : request.numSims <= 10000 ? 50 : 200

  while (done < request.numSims && isJobActive(request.jobId)) {
    let stableStop = false
    const simsThisBatch = Math.min(batchSize, request.numSims - done)
    for (let i = 0; i < simsThisBatch; i++) {
      const [gameA, gameB] = simulateGamePairWithBots(bots, request.simB0, request.simB1, {
        onMirrorRound: round => {
          const changed = captureSimulationExamples(simExamples, {
            simulationIndex: done,
            roundIndex: round.roundIndex,
            roundA: round.roundWhenBot0Starts,
            roundB: round.roundWhenBot1Starts,
            getReplayPair: round.createReplayPair,
          })
          if (changed) examplesDirty = true
        },
      })
      const pairSummary = summarizeSimulatedPair(gameA, gameB)
      addBotMirrorMetrics(botMetrics[0], pairSummary.bots[0])
      addBotMirrorMetrics(botMetrics[1], pairSummary.bots[1])
      splitMirrorRounds += pairSummary.splitMirrorRounds
      orphanRounds += pairSummary.orphanRounds

      for (const game of [gameA, gameB]) {
        totalRounds += game.roundStats.length
        for (const roundStat of game.roundStats) {
          if (roundStat.winner === 0) {
            drawsA[roundStat.cards] = (drawsA[roundStat.cards] || 0) + 1
          } else {
            drawsB[roundStat.cards] = (drawsB[roundStat.cards] || 0) + 1
          }
        }
      }

      done += 1

      if (request.useStabilized) {
        const truncatedRates = getTruncatedWinRates(botMetrics[0].gamesWon, botMetrics[1].gamesWon, request.stabilizeDecimals)
        stableStreak = getNextStableStreak(lastStableRates, truncatedRates, stableStreak)
        lastStableRates = truncatedRates
        if (done >= MIN_SIMULATIONS_BEFORE_STABLE_STOP && stableStreak >= STABLE_SIMULATION_STREAK) {
          stableStop = true
          break
        }
      }
    }

    const [gameRate0, gameRate1] = getWinRates(botMetrics[0].gamesWon, botMetrics[1].gamesWon)
    if (done > 0) gameRateHistory.push({ simulations: done, rate0: gameRate0, rate1: gameRate1 })
    const totalMirrorRounds = botMetrics[0].mirrorRoundsPlayed
    if (totalMirrorRounds > 0) {
      mirrorRoundRateHistory.push({
        mirrorRounds: totalMirrorRounds,
        rate0: getPercentOfTotal(botMetrics[0].mirrorRoundsWon, totalMirrorRounds),
        rate1: getPercentOfTotal(botMetrics[1].mirrorRoundsWon, totalMirrorRounds),
      })
    }

    const shouldPostExamples = examplesDirty || done >= request.numSims || stableStop
    post({
      type: 'simProgress',
      jobId: request.jobId,
      progress: done >= request.numSims || stableStop ? 100 : Math.round((done / request.numSims) * 100),
      chartData: buildChartData(drawsA, drawsB, bots[request.simB0].name, bots[request.simB1].name),
      botMetrics: [
        { ...botMetrics[0] },
        { ...botMetrics[1] },
      ],
      totalRounds,
      splitMirrorRounds,
      orphanRounds,
      gameRateHistory: [...gameRateHistory],
      mirrorRoundRateHistory: [...mirrorRoundRateHistory],
      ...(shouldPostExamples ? { examples: simExamples } : {}),
      done,
      stableStop,
    })
    examplesDirty = false

    if (stableStop) return
    await yieldToMessages()
  }
}

async function runTournament(request: Extract<LabWorkerRequest, { type: 'runTournament' }>) {
  activeJobId = request.jobId
  const bots = createRuntimeBots(request.customConfigs)
  const mutableResults = createEmptyTournamentResults()
  const matchSnapshots: TournamentProgressMessage['matchSnapshots'] = TOURNAMENT_FIXTURE.map(() => null)
  const firstMatch = TOURNAMENT_FIXTURE[0] ?? null

  if (firstMatch) {
    matchSnapshots[firstMatch.flatIndex] = buildTournamentMatchSnapshot(firstMatch, mutableResults, 'running')
    post({
      type: 'tournamentProgress',
      jobId: request.jobId,
      progress: 0,
      results: cloneTournamentResults(mutableResults),
      currentMatch: firstMatch,
      currentStats: matchSnapshots[firstMatch.flatIndex],
      matchSnapshots: [...matchSnapshots],
      done: false,
    })
    await yieldToMessages()
  }

  const batchSize = 20
  let pairIdx = 0
  let simsDone = 0
  let currentWins = 0
  let currentTotal = 0
  let lastStableRates: [number, number] | null = null
  let stableStreak = 0

  while (pairIdx < TOURNAMENT_FIXTURE.length && isJobActive(request.jobId)) {
    const match = TOURNAMENT_FIXTURE[pairIdx]
    const { aSlot: ai, bSlot: bi, flatIndex } = match
    const globalA = request.tourBots[ai]
    const globalB = request.tourBots[bi]
    const simsThisBatch = Math.min(batchSize, request.numSims - simsDone)
    let stable = false

    for (let i = 0; i < simsThisBatch; i++) {
      const [gameA, gameB] = simulateGamePairWithBots(bots, globalA, globalB)
      const winsForA = (gameA.gameLoser === 1 ? 1 : 0) + (gameB.gameLoser === 1 ? 1 : 0)

      mutableResults.wins[ai][bi] += winsForA
      mutableResults.games[ai][bi] += 2

      const winnerA = gameA.gameLoser === 0 ? 1 : 0
      const winnerB = gameB.gameLoser === 0 ? 1 : 0

      if (winnerA === 0 && winnerB === 0) {
        mutableResults.mirrorWins[ai][bi] += 1
      } else if (winnerA === 1 && winnerB === 1) {
        mutableResults.mirrorWins[bi][ai] += 1
      }
      mutableResults.mirrorPairs[ai][bi] += 1

      const chinA0 = gameA.roundStats.filter(round => round.chinchon && round.winner === 0).length
      const chinA1 = gameA.roundStats.filter(round => round.chinchon && round.winner === 1).length
      const chinB0 = gameB.roundStats.filter(round => round.chinchon && round.winner === 0).length
      const chinB1 = gameB.roundStats.filter(round => round.chinchon && round.winner === 1).length

      mutableResults.chinchones[ai][bi] += chinA0 + chinB0
      mutableResults.chinchones[bi][ai] += chinA1 + chinB1

      currentWins += winsForA
      currentTotal += 2
      simsDone += 1

      if (request.useStabilized) {
        const truncatedRates = getTruncatedWinRates(currentWins, currentTotal - currentWins, request.stabilizeDecimals)
        stableStreak = getNextStableStreak(lastStableRates, truncatedRates, stableStreak)
        lastStableRates = truncatedRates
        if (simsDone >= MIN_SIMULATIONS_BEFORE_STABLE_STOP && stableStreak >= STABLE_SIMULATION_STREAK) {
          stable = true
          break
        }
      }
    }

    const matchFinished = stable || simsDone >= request.numSims
    const nextResults = cloneTournamentResults(mutableResults)
    const finishedSnapshot = buildTournamentMatchSnapshot(match, nextResults, matchFinished ? 'finished' : 'running')
    matchSnapshots[flatIndex] = finishedSnapshot

    let currentMatch: TournamentProgressMessage['currentMatch'] = match
    let currentStats: TournamentProgressMessage['currentStats'] = finishedSnapshot
    const fraction = matchFinished ? 1 : simsDone / request.numSims
    let progress = Math.min(99, Math.round(((pairIdx + fraction) / TOURNAMENT_FIXTURE.length) * 100))

    if (matchFinished) {
      pairIdx += 1
      simsDone = 0
      currentWins = 0
      currentTotal = 0
      lastStableRates = null
      stableStreak = 0

      if (pairIdx < TOURNAMENT_FIXTURE.length) {
        const nextMatch = TOURNAMENT_FIXTURE[pairIdx]
        const nextSnapshot = buildTournamentMatchSnapshot(nextMatch, nextResults, 'running')
        matchSnapshots[nextMatch.flatIndex] = nextSnapshot
        currentMatch = nextMatch
        currentStats = nextSnapshot
      } else {
        currentMatch = null
        currentStats = null
        progress = 100
      }
    }

    post({
      type: 'tournamentProgress',
      jobId: request.jobId,
      progress,
      results: nextResults,
      currentMatch,
      currentStats,
      matchSnapshots: [...matchSnapshots],
      done: matchFinished && pairIdx >= TOURNAMENT_FIXTURE.length,
    })

    await yieldToMessages()
  }
}

async function runBenchmark(request: Extract<LabWorkerRequest, { type: 'runBenchmark' }>) {
  activeJobId = request.jobId
  const bots = createRuntimeBots(request.customConfigs)
  const botIdx = bots.findIndex(bot => bot.id === request.botId)
  if (botIdx < 0) return

  let wins = 0
  let total = 0
  for (let i = 0; i < 25 && isJobActive(request.jobId); i++) {
    const [gameA, gameB] = simulateGamePairWithBots(bots, botIdx, 0)
    if (gameA.gameLoser === 1) wins += 1
    if (gameB.gameLoser === 1) wins += 1
    total += 2
    await yieldToMessages()
  }

  const message: BenchmarkProgressMessage = {
    type: 'benchmarkProgress',
    jobId: request.jobId,
    botId: request.botId,
    wins,
    total,
  }
  post(message)
}

async function runEvolutionJob(request: Extract<LabWorkerRequest, { type: 'runEvolution' }>) {
  activeJobId = request.jobId

  const rivalConfig = getBotConfig(request.rivalBotIndex, request.customConfigs)
  const seedConfig = getBotConfig(request.seedBotIndex, request.customConfigs)
  const rivalRuntime = buildBotFromConfig(rivalConfig)
  const originalRuntime = buildBotFromConfig(seedConfig)
  const rng = createRng(request.jobId + Date.now())
  const evaluationConcurrency = getEvoEvaluationParallelism(request.populationSize)
  const fitnessDescriptor = getFitnessModeDescriptor(request.fitnessMode)

  activeEvoEvalPool?.dispose()
  const evalPool = createEvoEvalPool(
    request.jobId,
    request.fitnessMode,
    request.useStabilizedEvaluation,
    request.stabilizeDecimals,
    evaluationConcurrency,
  )
  activeEvoEvalPool = evalPool

  function buildEvoProgressMessage(snapshot: EvolutionProgressSnapshot): EvoProgressMessage {
    return {
      type: 'evoProgress',
      jobId: request.jobId,
      phase: snapshot.phase,
      fitnessMode: request.fitnessMode,
      primaryLabel: fitnessDescriptor.primaryLabel,
      secondaryLabel: fitnessDescriptor.secondaryLabel,
      generation: snapshot.generation,
      bestGeneration: snapshot.bestGeneration,
      bestFitness: snapshot.bestIndividual.fitness,
      avgFitness: snapshot.metrics.avgFitness,
      worstFitness: snapshot.metrics.worstFitness,
      bestPrimaryRate: snapshot.bestIndividual.primaryRate,
      avgPrimaryRate: snapshot.metrics.avgPrimaryRate,
      bestSecondaryRate: snapshot.bestIndividual.secondaryRate,
      avgSecondaryRate: snapshot.metrics.avgSecondaryRate,
      bestMetrics: {
        gamesPlayed: snapshot.bestIndividual.gamesPlayed,
        gamesWon: snapshot.bestIndividual.gamesWon,
        roundsPlayed: snapshot.bestIndividual.roundsPlayed,
        roundsWon: snapshot.bestIndividual.roundsWon,
        mirrorRoundsPlayed: snapshot.bestIndividual.mirrorRoundsPlayed,
        mirrorRoundsWon: snapshot.bestIndividual.mirrorRoundsWon,
        chinchonWins: snapshot.bestIndividual.chinchonWins,
        orphanRoundsPlayed: snapshot.bestIndividual.orphanRoundsPlayed,
        gameWinRate: snapshot.bestIndividual.gameWinRate,
        roundWinRate: snapshot.bestIndividual.roundWinRate,
        mirrorRoundRate: snapshot.bestIndividual.mirrorRoundRate,
        primaryRate: snapshot.bestIndividual.primaryRate,
        secondaryRate: snapshot.bestIndividual.secondaryRate,
      },
      progress: snapshot.progress,
      generationProgress: snapshot.generationProgress,
      evaluatedIndividuals: snapshot.evaluatedIndividuals,
      populationSize: snapshot.populationSize,
      totalEvaluations: snapshot.totalEvaluations,
      generationIndividuals: snapshot.generationIndividuals,
      fitnessHistory: snapshot.fitnessHistory,
    }
  }

  try {
    const result = await runEvolution({
      seedConfig,
      rivalRuntime,
      originalRuntime,
      config: {
        populationSize: request.populationSize,
        simsPerEval: request.simsPerEval,
        useStabilizedEvaluation: request.useStabilizedEvaluation,
        stabilizeDecimals: request.stabilizeDecimals,
        maxGenerations: request.maxGenerations,
        elitismCount: request.elitismCount,
        mutationRate: request.mutationRate,
        mutationSigma: request.mutationSigma,
        crossoverRate: request.crossoverRate,
        fitnessMode: request.fitnessMode,
        selectionMethod: request.selectionMethod,
        tournamentK: request.tournamentK,
        absoluteMargin: request.absoluteMargin,
        targetRate: request.targetRate,
        stagnationLimit: request.stagnationLimit,
      },
      rng: () => rng.next(),
      evaluationConcurrency,
      excludeExactReferenceConfig: request.rivalBotIndex === request.seedBotIndex ? seedConfig : null,
      shouldCancel: () => !isJobActive(request.jobId),
      yieldControl: yieldToMessages,
      evaluate: async (individual, targetRuntime, _sims, _fitnessMode, options) => {
        const targetConfig = targetRuntime.id === seedConfig.id ? seedConfig : rivalConfig
        return evalPool.evaluate(individual, targetConfig, request.simsPerEval, options?.onPartial)
      },
      onProgress: async snapshot => {
        post(buildEvoProgressMessage(snapshot))
      },
      onGeneration: async snapshot => {
        post(buildEvoProgressMessage(snapshot))
        await yieldToMessages()
      },
    })

    if (!isJobActive(request.jobId) && result.stopReason !== 'cancelled') {
      return
    }

    const doneMessage: EvoDoneMessage = {
      type: 'evoDone',
      jobId: request.jobId,
      fitnessMode: request.fitnessMode,
      primaryLabel: fitnessDescriptor.primaryLabel,
      secondaryLabel: fitnessDescriptor.secondaryLabel,
      bestConfig: result.bestIndividual.config,
      bestFitness: result.bestIndividual.fitness,
      bestMetrics: {
        gamesPlayed: result.bestIndividual.gamesPlayed,
        gamesWon: result.bestIndividual.gamesWon,
        roundsPlayed: result.bestIndividual.roundsPlayed,
        roundsWon: result.bestIndividual.roundsWon,
        mirrorRoundsPlayed: result.bestIndividual.mirrorRoundsPlayed,
        mirrorRoundsWon: result.bestIndividual.mirrorRoundsWon,
        chinchonWins: result.bestIndividual.chinchonWins,
        orphanRoundsPlayed: result.bestIndividual.orphanRoundsPlayed,
        gameWinRate: result.bestIndividual.gameWinRate,
        roundWinRate: result.bestIndividual.roundWinRate,
        mirrorRoundRate: result.bestIndividual.mirrorRoundRate,
        primaryRate: result.bestIndividual.primaryRate,
        secondaryRate: result.bestIndividual.secondaryRate,
      },
      bestGeneration: result.bestGeneration,
      totalGenerations: result.totalGenerations,
      totalEvaluations: result.totalEvaluations,
      stopReason: result.stopReason,
      topConfigs: result.topIndividuals.map(individual => individual.config),
      topFitnesses: result.topIndividuals.map(individual => individual.fitness),
      topMetrics: result.topIndividuals.map(individual => ({
        gamesPlayed: individual.gamesPlayed,
        gamesWon: individual.gamesWon,
        roundsPlayed: individual.roundsPlayed,
        roundsWon: individual.roundsWon,
        mirrorRoundsPlayed: individual.mirrorRoundsPlayed,
        mirrorRoundsWon: individual.mirrorRoundsWon,
        chinchonWins: individual.chinchonWins,
        orphanRoundsPlayed: individual.orphanRoundsPlayed,
        gameWinRate: individual.gameWinRate,
        roundWinRate: individual.roundWinRate,
        mirrorRoundRate: individual.mirrorRoundRate,
        primaryRate: individual.primaryRate,
        secondaryRate: individual.secondaryRate,
      })),
      fitnessHistory: result.fitnessHistory,
      generationHistory: result.generationHistory,
    }
    post(doneMessage)
  } finally {
    evalPool.dispose()
    if (activeEvoEvalPool === evalPool) {
      activeEvoEvalPool = null
    }
  }
}

self.onmessage = (event: MessageEvent<LabWorkerRequest>) => {
  const data = event.data

  if (data.type === 'cancel') {
    const cancellingJobId = data.jobId ?? activeJobId
    if (cancellingJobId >= 0) {
      activeEvoEvalPool?.cancel(cancellingJobId)
    }
    if (data.jobId === undefined || data.jobId === activeJobId) activeJobId = -1
    return
  }

  if (data.type === 'runSim') {
    void runSim(data)
    return
  }

  if (data.type === 'runTournament') {
    void runTournament(data)
    return
  }

  if (data.type === 'runBenchmark') {
    void runBenchmark(data)
    return
  }

  if (data.type === 'runEvolution') {
    void runEvolutionJob(data)
  }
}
