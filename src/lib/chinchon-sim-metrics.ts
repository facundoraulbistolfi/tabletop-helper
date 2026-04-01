export const STABLE_SIMULATION_STREAK = 10
export const MIN_SIMULATIONS_BEFORE_STABLE_STOP = 200

export type WinRateTuple = [number, number]

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
  if (totalWins <= 0) return 0
  return (chinchonWins / totalWins) * 100
}
