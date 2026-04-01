/// <reference lib="webworker" />

import {
  MIN_SIMULATIONS_BEFORE_STABLE_STOP,
  STABLE_SIMULATION_STREAK,
  getNextStableStreak,
  getTruncatedWinRates,
  getWinRates,
} from '../lib/chinchon-sim-metrics'
import {
  TOURNAMENT_FIXTURE,
  buildTournamentMatchSnapshot,
  createEmptyTournamentResults,
  type TournamentResults,
} from '../lib/chinchon-tournament'
import { createRuntimeBots, simulateGamePairWithBots } from '../lib/chinchon-arena-sim'
import type {
  BenchmarkProgressMessage,
  LabWorkerMessage,
  LabWorkerRequest,
  SimProgressMessage,
  TournamentProgressMessage,
} from '../lib/chinchon-lab-worker-types'

let activeJobId = -1

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
  let roundWins0 = 0
  let roundWins1 = 0
  let gameWins0 = 0
  let gameWins1 = 0
  let sweepWins0 = 0
  let sweepWins1 = 0
  let splits = 0
  let totalRounds = 0
  let chinchonWins0 = 0
  let chinchonWins1 = 0
  let done = 0
  let lastStableRates: [number, number] | null = null
  let stableStreak = 0
  const winRateHistory: SimProgressMessage['winRateHistory'] = []
  const sweepRateHistory: SimProgressMessage['sweepRateHistory'] = []
  const batchSize = request.numSims <= 100 ? 1 : request.numSims <= 1000 ? 5 : request.numSims <= 10000 ? 50 : 200

  while (done < request.numSims && isJobActive(request.jobId)) {
    let stableStop = false
    const simsThisBatch = Math.min(batchSize, request.numSims - done)
    for (let i = 0; i < simsThisBatch; i++) {
      const [gameA, gameB] = simulateGamePairWithBots(bots, request.simB0, request.simB1)
      const winnerA = gameA.gameLoser === 0 ? 1 : 0
      const winnerB = gameB.gameLoser === 0 ? 1 : 0

      if (winnerA === 0) gameWins0 += 1
      else gameWins1 += 1
      if (winnerB === 0) gameWins0 += 1
      else gameWins1 += 1

      if (winnerA === 0 && winnerB === 0) sweepWins0 += 1
      else if (winnerA === 1 && winnerB === 1) sweepWins1 += 1
      else splits += 1

      for (const game of [gameA, gameB]) {
        for (const roundStat of game.roundStats) {
          totalRounds += 1
          if (roundStat.winner === 0) {
            roundWins0 += 1
            drawsA[roundStat.cards] = (drawsA[roundStat.cards] || 0) + 1
          } else {
            roundWins1 += 1
            drawsB[roundStat.cards] = (drawsB[roundStat.cards] || 0) + 1
          }

          if (roundStat.chinchon) {
            if (roundStat.winner === 0) chinchonWins0 += 1
            else chinchonWins1 += 1
          }
        }
      }

      done += 1

      if (request.useStabilized) {
        const truncatedRates = getTruncatedWinRates(gameWins0, gameWins1, request.stabilizeDecimals)
        stableStreak = getNextStableStreak(lastStableRates, truncatedRates, stableStreak)
        lastStableRates = truncatedRates
        if (done >= MIN_SIMULATIONS_BEFORE_STABLE_STOP && stableStreak >= STABLE_SIMULATION_STREAK) {
          stableStop = true
          break
        }
      }
    }

    const [winRate0, winRate1] = getWinRates(gameWins0, gameWins1)
    if (done > 0) winRateHistory.push({ simulations: done, rate0: winRate0, rate1: winRate1 })
    const totalPairs = sweepWins0 + sweepWins1 + splits
    if (totalPairs > 0) {
      sweepRateHistory.push({
        pairs: totalPairs,
        rate0: (sweepWins0 / totalPairs) * 100,
        rate1: (sweepWins1 / totalPairs) * 100,
      })
    }

    post({
      type: 'simProgress',
      jobId: request.jobId,
      progress: done >= request.numSims || stableStop ? 100 : Math.round((done / request.numSims) * 100),
      chartData: buildChartData(drawsA, drawsB, bots[request.simB0].name, bots[request.simB1].name),
      roundWins: [roundWins0, roundWins1],
      gameWins: [gameWins0, gameWins1],
      sweepWins: [sweepWins0, sweepWins1, splits],
      totalRounds,
      chinchonWins: [chinchonWins0, chinchonWins1],
      winRateHistory: [...winRateHistory],
      sweepRateHistory: [...sweepRateHistory],
      done,
      stableStop,
    })

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

self.onmessage = (event: MessageEvent<LabWorkerRequest>) => {
  const data = event.data

  if (data.type === 'cancel') {
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
  }
}
