import type { ReplayPair, SimulatedGameResult, SimulatedRoundStat } from './chinchon-arena-sim'

export const STABLE_SIMULATION_STREAK = 10
export const MIN_SIMULATIONS_BEFORE_STABLE_STOP = 200

export type WinRateTuple = [number, number]

export type BotMirrorMetrics = {
  gamesPlayed: number
  gamesWon: number
  roundsPlayed: number
  roundsWon: number
  mirrorRoundsPlayed: number
  mirrorRoundsWon: number
  chinchonWins: number
  orphanRoundsPlayed: number
}

export type PairMirrorMetrics = {
  bots: [BotMirrorMetrics, BotMirrorMetrics]
  splitMirrorRounds: number
  orphanRounds: number
}

export type SimulationExampleMetric = 'mirror_round_win' | 'chinchon'

export type SimulationExampleSummary = {
  roundA: SimulatedRoundStat
  roundB: SimulatedRoundStat
}

export type SimulationExample = {
  metric: SimulationExampleMetric
  bot: 0 | 1
  simulationIndex: number
  roundIndex: number
  replayPair: ReplayPair
  summary: SimulationExampleSummary
}

export type SimulationExamples = {
  mirrorRoundsWon: [SimulationExample | null, SimulationExample | null]
  chinchonWins: [SimulationExample | null, SimulationExample | null]
}

export function createEmptyBotMirrorMetrics(): BotMirrorMetrics {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    mirrorRoundsPlayed: 0,
    mirrorRoundsWon: 0,
    chinchonWins: 0,
    orphanRoundsPlayed: 0,
  }
}

export function createEmptySimulationExamples(): SimulationExamples {
  return {
    mirrorRoundsWon: [null, null],
    chinchonWins: [null, null],
  }
}

export function addBotMirrorMetrics(
  target: BotMirrorMetrics,
  source: BotMirrorMetrics,
): BotMirrorMetrics {
  target.gamesPlayed += source.gamesPlayed
  target.gamesWon += source.gamesWon
  target.roundsPlayed += source.roundsPlayed
  target.roundsWon += source.roundsWon
  target.mirrorRoundsPlayed += source.mirrorRoundsPlayed
  target.mirrorRoundsWon += source.mirrorRoundsWon
  target.chinchonWins += source.chinchonWins
  target.orphanRoundsPlayed += source.orphanRoundsPlayed
  return target
}

export function getPercentOfTotal(wins: number, total: number): number {
  if (total <= 0) return 0
  return (wins / total) * 100
}

export function summarizeSimulatedPair(
  gameA: SimulatedGameResult,
  gameB: SimulatedGameResult,
): PairMirrorMetrics {
  const bot0 = createEmptyBotMirrorMetrics()
  const bot1 = createEmptyBotMirrorMetrics()
  const bots: [BotMirrorMetrics, BotMirrorMetrics] = [bot0, bot1]

  const gameWinnerA = gameA.gameLoser === 0 ? 1 : 0
  const gameWinnerB = gameB.gameLoser === 0 ? 1 : 0
  bots[gameWinnerA].gamesWon += 1
  bots[gameWinnerB].gamesWon += 1
  bot0.gamesPlayed += 2
  bot1.gamesPlayed += 2

  for (const game of [gameA, gameB]) {
    bot0.roundsPlayed += game.roundStats.length
    bot1.roundsPlayed += game.roundStats.length

    for (const round of game.roundStats) {
      bots[round.winner].roundsWon += 1
      if (round.chinchon) {
        bots[round.winner].chinchonWins += 1
      }
    }
  }

  const pairedRounds = Math.min(gameA.roundStats.length, gameB.roundStats.length)
  const orphanRounds = Math.abs(gameA.roundStats.length - gameB.roundStats.length)
  bot0.mirrorRoundsPlayed += pairedRounds
  bot1.mirrorRoundsPlayed += pairedRounds
  bot0.orphanRoundsPlayed += orphanRounds
  bot1.orphanRoundsPlayed += orphanRounds

  let splitMirrorRounds = 0
  for (let index = 0; index < pairedRounds; index += 1) {
    const winnerA = gameA.roundStats[index]?.winner
    const winnerB = gameB.roundStats[index]?.winner

    if (winnerA === 0 && winnerB === 0) {
      bot0.mirrorRoundsWon += 1
    } else if (winnerA === 1 && winnerB === 1) {
      bot1.mirrorRoundsWon += 1
    } else {
      splitMirrorRounds += 1
    }
  }

  return {
    bots,
    splitMirrorRounds,
    orphanRounds,
  }
}

export function compareBotMirrorMetrics(
  left: Pick<BotMirrorMetrics, 'gamesWon' | 'mirrorRoundsWon'>,
  right: Pick<BotMirrorMetrics, 'gamesWon' | 'mirrorRoundsWon'>,
) {
  return left.gamesWon - right.gamesWon || left.mirrorRoundsWon - right.mirrorRoundsWon
}

export function getWinRates(bot0Wins: number, bot1Wins: number): WinRateTuple {
  const total = bot0Wins + bot1Wins
  if (total <= 0) return [0, 0]
  return [(bot0Wins / total) * 100, (bot1Wins / total) * 100]
}

export function truncateRate(rate: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.trunc(rate * factor) / factor
}

export function getTruncatedWinRates(
  bot0Wins: number,
  bot1Wins: number,
  decimals: number,
): WinRateTuple {
  const [bot0Rate, bot1Rate] = getWinRates(bot0Wins, bot1Wins)
  return [truncateRate(bot0Rate, decimals), truncateRate(bot1Rate, decimals)]
}

export function getNextStableStreak(
  previousRates: WinRateTuple | null,
  currentRates: WinRateTuple,
  currentStreak: number,
): number {
  if (!previousRates) return 1
  if (previousRates[0] === currentRates[0] && previousRates[1] === currentRates[1]) {
    return currentStreak + 1
  }
  return 1
}

export function getChinchonWinRate(chinchonWins: number, totalWins: number): number {
  return getPercentOfTotal(chinchonWins, totalWins)
}

export function captureSimulationExamples(
  target: SimulationExamples,
  params: {
    simulationIndex: number
    roundIndex: number
    roundA: SimulatedRoundStat
    roundB: SimulatedRoundStat
    getReplayPair: () => ReplayPair
  },
): boolean {
  const { simulationIndex, roundIndex, roundA, roundB, getReplayPair } = params
  const summary = {
    roundA: { ...roundA },
    roundB: { ...roundB },
  }
  let replayPair: ReplayPair | null = null
  let changed = false

  const ensureReplayPair = () => {
    if (!replayPair) replayPair = getReplayPair()
    return replayPair
  }

  const maybeStore = (metricKey: keyof SimulationExamples, metric: SimulationExampleMetric, bot: 0 | 1, condition: boolean) => {
    if (!condition || target[metricKey][bot]) return
    target[metricKey][bot] = {
      metric,
      bot,
      simulationIndex,
      roundIndex,
      replayPair: ensureReplayPair(),
      summary,
    }
    changed = true
  }

  maybeStore('mirrorRoundsWon', 'mirror_round_win', 0, roundA.winner === 0 && roundB.winner === 0)
  maybeStore('mirrorRoundsWon', 'mirror_round_win', 1, roundA.winner === 1 && roundB.winner === 1)
  maybeStore('chinchonWins', 'chinchon', 0, (roundA.chinchon && roundA.winner === 0) || (roundB.chinchon && roundB.winner === 0))
  maybeStore('chinchonWins', 'chinchon', 1, (roundA.chinchon && roundA.winner === 1) || (roundB.chinchon && roundB.winner === 1))

  return changed
}
