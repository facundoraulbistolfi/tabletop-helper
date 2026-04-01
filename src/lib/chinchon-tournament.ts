import { getChinchonWinRate, getWinRates } from './chinchon-sim-metrics'

export type TournamentFixtureMatch = {
  fechaIndex: number
  matchIndex: number
  flatIndex: number
  aSlot: number
  bSlot: number
}

export type TournamentResults = {
  wins: number[][]
  games: number[][]
  mirrorWins: number[][]
  mirrorPairs: number[][]
  chinchones: number[][]
}

export type TournamentBotTotals = {
  wins: number
  games: number
  winPct: number
  mirrorWins: number
  mirrorPairs: number
  mirrorPct: number
  chinchones: number
}

export type TournamentIndexedBotTotals = TournamentBotTotals & {
  idx: number
}

export type TournamentChinchonRankingEntry = TournamentIndexedBotTotals & {
  rate: number
}

export type TournamentMatchSnapshot = {
  status: 'pending' | 'running' | 'finished'
  games: number
  wins: [number, number]
  winPct: [number, number]
  mirrorWins: [number, number]
  mirrorPct: [number, number]
  chinchones: [number, number]
  totals: [TournamentBotTotals, TournamentBotTotals]
}

export type TournamentHeadToHeadStatus = {
  idx: number
  beatAll: boolean
  lostAll: boolean
  rivalsBeaten: number
  rivalsLost: number
}

export type TournamentCeremonyRankingEntry = TournamentIndexedBotTotals & {
  score: number
  awardsWon: number
  beatAll: boolean
  lostAll: boolean
  wonMayorGanador: boolean
  wonAura: boolean
  wonMasLetal: boolean
  runnerUpMasLetal: boolean
  wonBeatAll: boolean
  winsPoints: number
  mirrorPoints: number
  auraPoints: number
  beatAllPoints: number
}

export type TournamentCeremonyData = {
  botTotals: TournamentIndexedBotTotals[]
  rankingWins: TournamentIndexedBotTotals[]
  rankingMirror: TournamentIndexedBotTotals[]
  rankingChinchon: TournamentChinchonRankingEntry[]
  headToHeadStatus: TournamentHeadToHeadStatus[]
  winsAwardWinner: TournamentIndexedBotTotals
  chinchonAwardWinner: TournamentChinchonRankingEntry
  mirrorAwardWinner: TournamentIndexedBotTotals
  mirrorAwardRunnerUp: TournamentIndexedBotTotals | null
  beatAllAwardWinner: TournamentIndexedBotTotals | null
  lostToEveryoneAward: TournamentHeadToHeadStatus | null
  noRiskBots: TournamentIndexedBotTotals[]
  everyoneShouldWinPrizeBots: TournamentCeremonyRankingEntry[]
  ceremonyRanking: TournamentCeremonyRankingEntry[]
  ceremonyChampion: TournamentCeremonyRankingEntry
}

export const TOURNAMENT_BOT_COUNT = 4

const TOURNAMENT_RESULT_KEYS = [
  'wins',
  'games',
  'mirrorWins',
  'mirrorPairs',
  'chinchones',
] as const

const FIXTURE_PAIRINGS = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
] as const

export const TOURNAMENT_FIXTURE_BY_FECHA: TournamentFixtureMatch[][] = FIXTURE_PAIRINGS.map(
  (fecha, fechaIndex) =>
    fecha.map(([aSlot, bSlot], matchIndex) => ({
      fechaIndex,
      matchIndex,
      flatIndex: fechaIndex * fecha.length + matchIndex,
      aSlot,
      bSlot,
    })),
)

export const TOURNAMENT_FIXTURE: TournamentFixtureMatch[] = TOURNAMENT_FIXTURE_BY_FECHA.flat()

function createMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0))
}

export function isValidTournamentResults(
  results: unknown,
  botCount = TOURNAMENT_BOT_COUNT,
): results is TournamentResults {
  if (!results || typeof results !== 'object') return false

  return TOURNAMENT_RESULT_KEYS.every((key) => {
    const matrix = (results as Record<string, unknown>)[key]
    return Array.isArray(matrix)
      && matrix.length >= botCount
      && matrix.slice(0, botCount).every((row) =>
        Array.isArray(row)
        && row.length >= botCount
        && row.slice(0, botCount).every((cell) => typeof cell === 'number' && Number.isFinite(cell)),
      )
  })
}

function getPercentOfTotal(value: number, total: number): number {
  if (total <= 0) return 0
  return (value / total) * 100
}

function getHeadToHeadWins(
  results: TournamentResults,
  botAIndex: number,
  botBIndex: number,
): [number, number] {
  const low = Math.min(botAIndex, botBIndex)
  const high = Math.max(botAIndex, botBIndex)
  const games = results.games[low][high]

  if (botAIndex < botBIndex) {
    const winsA = results.wins[botAIndex][botBIndex]
    return [winsA, games - winsA]
  }

  const winsB = results.wins[botBIndex][botAIndex]
  return [games - winsB, winsB]
}

function compareByHeadToHead(
  results: TournamentResults,
  botAIndex: number,
  botBIndex: number,
): number {
  const [winsA, winsB] = getHeadToHeadWins(results, botAIndex, botBIndex)
  return winsB - winsA
}

function getMatchGames(results: TournamentResults, match: TournamentFixtureMatch): number {
  const low = Math.min(match.aSlot, match.bSlot)
  const high = Math.max(match.aSlot, match.bSlot)
  return results.games[low][high]
}

function getMatchWins(results: TournamentResults, match: TournamentFixtureMatch): [number, number] {
  const games = getMatchGames(results, match)
  if (match.aSlot < match.bSlot) {
    const aWins = results.wins[match.aSlot][match.bSlot]
    return [aWins, games - aWins]
  }

  const bWins = results.wins[match.bSlot][match.aSlot]
  return [games - bWins, bWins]
}

function getMatchMirrorPairs(results: TournamentResults, match: TournamentFixtureMatch): number {
  const low = Math.min(match.aSlot, match.bSlot)
  const high = Math.max(match.aSlot, match.bSlot)
  return results.mirrorPairs[low][high]
}

function getMatchMirrorWins(results: TournamentResults, match: TournamentFixtureMatch): [number, number] {
  return [
    results.mirrorWins[match.aSlot][match.bSlot],
    results.mirrorWins[match.bSlot][match.aSlot],
  ]
}

function getMatchChinchones(results: TournamentResults, match: TournamentFixtureMatch): [number, number] {
  return [
    results.chinchones[match.aSlot][match.bSlot],
    results.chinchones[match.bSlot][match.aSlot],
  ]
}

export function createEmptyTournamentResults(
  size = TOURNAMENT_BOT_COUNT,
): TournamentResults {
  return {
    wins: createMatrix(size),
    games: createMatrix(size),
    mirrorWins: createMatrix(size),
    mirrorPairs: createMatrix(size),
    chinchones: createMatrix(size),
  }
}

export function getTournamentBotTotals(
  results: TournamentResults | null | undefined,
  botIndex: number,
  botCount = TOURNAMENT_BOT_COUNT,
): TournamentBotTotals {
  if (!isValidTournamentResults(results, botCount)) {
    return {
      wins: 0,
      games: 0,
      winPct: 0,
      mirrorWins: 0,
      mirrorPairs: 0,
      mirrorPct: 0,
      chinchones: 0,
    }
  }

  let wins = 0
  let games = 0
  let mirrorWins = 0
  let mirrorPairs = 0
  let chinchones = 0

  for (let opponent = 0; opponent < botCount; opponent++) {
    if (opponent === botIndex) continue

    if (opponent > botIndex) {
      wins += results.wins[botIndex][opponent]
      games += results.games[botIndex][opponent]
      mirrorPairs += results.mirrorPairs[botIndex][opponent]
    } else {
      const pairGames = results.games[opponent][botIndex]
      wins += pairGames - results.wins[opponent][botIndex]
      games += pairGames
      mirrorPairs += results.mirrorPairs[opponent][botIndex]
    }

    mirrorWins += results.mirrorWins[botIndex][opponent]
    chinchones += results.chinchones[botIndex][opponent]
  }

  return {
    wins,
    games,
    winPct: getPercentOfTotal(wins, games),
    mirrorWins,
    mirrorPairs,
    mirrorPct: getPercentOfTotal(mirrorWins, mirrorPairs),
    chinchones,
  }
}

export function buildTournamentMatchSnapshot(
  match: TournamentFixtureMatch,
  results: TournamentResults | null | undefined,
  status: TournamentMatchSnapshot['status'],
): TournamentMatchSnapshot {
  const safeResults = isValidTournamentResults(results) ? results : createEmptyTournamentResults()
  const games = getMatchGames(safeResults, match)
  const wins = getMatchWins(safeResults, match)
  const winPct = getWinRates(wins[0], wins[1])
  const mirrorPairs = getMatchMirrorPairs(safeResults, match)
  const mirrorWins = getMatchMirrorWins(safeResults, match)
  const mirrorPct: [number, number] = [
    getPercentOfTotal(mirrorWins[0], mirrorPairs),
    getPercentOfTotal(mirrorWins[1], mirrorPairs),
  ]
  const chinchones = getMatchChinchones(safeResults, match)

  return {
    status,
    games,
    wins,
    winPct,
    mirrorWins,
    mirrorPct,
    chinchones,
    totals: [
      getTournamentBotTotals(safeResults, match.aSlot),
      getTournamentBotTotals(safeResults, match.bSlot),
    ],
  }
}

export function buildTournamentCeremonyData(
  results: TournamentResults | null | undefined,
  botCount = TOURNAMENT_BOT_COUNT,
): TournamentCeremonyData {
  if (botCount <= 0) {
    throw new Error('Tournament ceremony requires at least one bot')
  }

  const safeResults = isValidTournamentResults(results, botCount)
    ? results
    : createEmptyTournamentResults(botCount)
  const botTotals = Array.from({ length: botCount }, (_, idx) => ({
    idx,
    ...getTournamentBotTotals(safeResults, idx, botCount),
  }))

  const rankingWins = [...botTotals].sort(
    (a, b) => b.wins - a.wins || b.winPct - a.winPct || b.mirrorWins - a.mirrorWins,
  )
  const rankingMirror = [...botTotals].sort(
    (a, b) => b.mirrorWins - a.mirrorWins || b.mirrorPct - a.mirrorPct || b.wins - a.wins,
  )
  const rankingChinchon = botTotals
    .map((entry) => ({
      ...entry,
      rate: getChinchonWinRate(entry.chinchones, entry.wins),
    }))
    .sort((a, b) => b.chinchones - a.chinchones || b.rate - a.rate)

  const headToHeadStatus = botTotals.map(({ idx }) => {
    let beatAll = true
    let lostAll = true
    let rivalsBeaten = 0
    let rivalsLost = 0

    for (let opponent = 0; opponent < botCount; opponent++) {
      if (opponent === idx) continue

      const low = Math.min(idx, opponent)
      const high = Math.max(idx, opponent)
      const games = safeResults.games[low][high]
      const wins = idx < opponent
        ? safeResults.wins[idx][opponent]
        : games - safeResults.wins[opponent][idx]
      const losses = games - wins

      if (games > 0 && wins > losses) {
        rivalsBeaten += 1
      } else {
        beatAll = false
      }

      if (games > 0 && wins < losses) {
        rivalsLost += 1
      } else {
        lostAll = false
      }
    }

    return {
      idx,
      beatAll,
      lostAll,
      rivalsBeaten,
      rivalsLost,
    }
  })

  const winsAwardWinner = rankingWins[0]!
  const chinchonAwardWinner = rankingChinchon[0]!
  const mirrorAwardWinner = rankingMirror[0]!
  const mirrorAwardRunnerUp = rankingMirror[1] ?? null
  const beatAllAwardWinner = [...headToHeadStatus]
    .filter((entry) => entry.beatAll)
    .sort(
      (a, b) =>
        botTotals[b.idx].wins - botTotals[a.idx].wins
        || botTotals[b.idx].mirrorWins - botTotals[a.idx].mirrorWins
        || botTotals[b.idx].chinchones - botTotals[a.idx].chinchones,
    )
    .map((entry) => botTotals[entry.idx])[0] ?? null
  const lostToEveryoneAward = [...headToHeadStatus]
    .filter((entry) => entry.lostAll)
    .sort(
      (a, b) =>
        botTotals[b.idx].games - botTotals[a.idx].games
        || botTotals[a.idx].wins - botTotals[b.idx].wins,
    )[0] ?? null
  const noRiskBots = [...botTotals]
    .filter((entry) => entry.chinchones === 0)
    .sort((a, b) => b.wins - a.wins || b.mirrorWins - a.mirrorWins || b.winPct - a.winPct)

  const ceremonyRanking = botTotals
    .map((entry) => {
      const wonMayorGanador = winsAwardWinner.idx === entry.idx
      const wonAura = chinchonAwardWinner.idx === entry.idx
      const wonMasLetal = mirrorAwardWinner.idx === entry.idx
      const runnerUpMasLetal = mirrorAwardRunnerUp?.idx === entry.idx
      const wonBeatAll = beatAllAwardWinner?.idx === entry.idx
      const winsPoints = wonMayorGanador ? 2 : 0
      const mirrorPoints = wonMasLetal ? 4 : runnerUpMasLetal ? 2 : 0
      const auraPoints = wonAura ? 2 : 0
      const beatAllPoints = wonBeatAll ? 2 : 0

      return {
        ...entry,
        score: winsPoints + mirrorPoints + auraPoints + beatAllPoints,
        awardsWon: Number(wonMayorGanador)
          + Number(wonAura)
          + Number(wonMasLetal)
          + Number(runnerUpMasLetal)
          + Number(wonBeatAll),
        beatAll: headToHeadStatus[entry.idx].beatAll,
        lostAll: headToHeadStatus[entry.idx].lostAll,
        wonMayorGanador,
        wonAura,
        wonMasLetal,
        runnerUpMasLetal,
        wonBeatAll,
        winsPoints,
        mirrorPoints,
        auraPoints,
        beatAllPoints,
      }
    })
    .sort(
      (a, b) =>
        b.score - a.score
        || compareByHeadToHead(safeResults, a.idx, b.idx)
        || b.wins - a.wins
        || b.mirrorWins - a.mirrorWins
        || b.chinchones - a.chinchones
        || b.winPct - a.winPct
        || b.mirrorPct - a.mirrorPct,
    )
  const everyoneShouldWinPrizeBots = ceremonyRanking.filter(
    (entry) => entry.awardsWon === 0 && !entry.lostAll && entry.chinchones > 0,
  )

  return {
    botTotals,
    rankingWins,
    rankingMirror,
    rankingChinchon,
    headToHeadStatus,
    winsAwardWinner,
    chinchonAwardWinner,
    mirrorAwardWinner,
    mirrorAwardRunnerUp,
    beatAllAwardWinner,
    lostToEveryoneAward,
    noRiskBots,
    everyoneShouldWinPrizeBots,
    ceremonyRanking,
    ceremonyChampion: ceremonyRanking[0]!,
  }
}
