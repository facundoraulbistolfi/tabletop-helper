import { describe, expect, it } from 'vitest'

import {
  TOURNAMENT_FIXTURE,
  TOURNAMENT_FIXTURE_BY_FECHA,
  buildTournamentMatchSnapshot,
  buildTournamentCeremonyData,
  createEmptyTournamentResults,
  getTournamentBotTotals,
  isValidTournamentResults,
} from './chinchon-tournament'

function cloneResults(results: ReturnType<typeof createEmptyTournamentResults>) {
  return {
    wins: results.wins.map((row) => [...row]),
    games: results.games.map((row) => [...row]),
    mirrorWins: results.mirrorWins.map((row) => [...row]),
    mirrorPairs: results.mirrorPairs.map((row) => [...row]),
    chinchones: results.chinchones.map((row) => [...row]),
  }
}

function createCeremonyResults() {
  const results = createEmptyTournamentResults()

  results.wins[0][1] = 6
  results.games[0][1] = 10
  results.wins[0][2] = 7
  results.games[0][2] = 10
  results.wins[0][3] = 8
  results.games[0][3] = 10
  results.wins[1][2] = 6
  results.games[1][2] = 10
  results.wins[1][3] = 7
  results.games[1][3] = 10
  results.wins[2][3] = 4
  results.games[2][3] = 10

  results.mirrorWins[0][1] = 3
  results.mirrorWins[1][0] = 1
  results.mirrorPairs[0][1] = 5
  results.mirrorWins[0][2] = 4
  results.mirrorPairs[0][2] = 5
  results.mirrorWins[0][3] = 3
  results.mirrorWins[3][0] = 1
  results.mirrorPairs[0][3] = 5
  results.mirrorWins[1][2] = 1
  results.mirrorWins[2][1] = 2
  results.mirrorPairs[1][2] = 5
  results.mirrorWins[1][3] = 2
  results.mirrorWins[3][1] = 1
  results.mirrorPairs[1][3] = 5
  results.mirrorWins[3][2] = 3
  results.mirrorPairs[2][3] = 5

  results.chinchones[0][1] = 3
  results.chinchones[0][2] = 2
  results.chinchones[3][2] = 1

  return results
}

function createTieBreakResults() {
  const results = createEmptyTournamentResults()

  results.wins[0][1] = 7
  results.games[0][1] = 10
  results.wins[0][2] = 5
  results.games[0][2] = 10
  results.wins[0][3] = 7
  results.games[0][3] = 10
  results.wins[1][2] = 6
  results.games[1][2] = 10
  results.wins[1][3] = 6
  results.games[1][3] = 10
  results.wins[2][3] = 4
  results.games[2][3] = 10

  results.mirrorWins[0][1] = 2
  results.mirrorWins[1][0] = 1
  results.mirrorPairs[0][1] = 5
  results.mirrorWins[0][2] = 1
  results.mirrorWins[2][0] = 2
  results.mirrorPairs[0][2] = 5
  results.mirrorWins[0][3] = 1
  results.mirrorWins[3][0] = 1
  results.mirrorPairs[0][3] = 5
  results.mirrorWins[1][2] = 3
  results.mirrorWins[2][1] = 1
  results.mirrorPairs[1][2] = 5
  results.mirrorWins[1][3] = 4
  results.mirrorPairs[1][3] = 5
  results.mirrorWins[2][3] = 1
  results.mirrorWins[3][2] = 1
  results.mirrorPairs[2][3] = 5

  results.chinchones[2][0] = 2
  results.chinchones[2][1] = 1
  results.chinchones[2][3] = 1

  return results
}

function createHeadToHeadPointsTieResults() {
  const results = createEmptyTournamentResults()

  results.wins[0][1] = 4
  results.games[0][1] = 10
  results.wins[0][2] = 8
  results.games[0][2] = 10
  results.wins[0][3] = 6
  results.games[0][3] = 10
  results.wins[1][2] = 5
  results.games[1][2] = 10
  results.wins[1][3] = 5
  results.games[1][3] = 10
  results.wins[2][3] = 5
  results.games[2][3] = 10

  results.mirrorWins[2][3] = 3
  results.mirrorWins[3][2] = 2
  results.mirrorPairs[2][3] = 5

  results.chinchones[1][0] = 1
  results.chinchones[1][2] = 2
  results.chinchones[1][3] = 1

  return results
}

function createNoRecognitionResults() {
  const results = createEmptyTournamentResults()

  results.wins[0][1] = 6
  results.games[0][1] = 10
  results.wins[0][2] = 7
  results.games[0][2] = 10
  results.wins[0][3] = 4
  results.games[0][3] = 10
  results.wins[1][2] = 6
  results.games[1][2] = 10
  results.wins[1][3] = 6
  results.games[1][3] = 10
  results.wins[2][3] = 6
  results.games[2][3] = 10

  results.mirrorWins[0][1] = 2
  results.mirrorWins[1][0] = 1
  results.mirrorPairs[0][1] = 5
  results.mirrorWins[2][0] = 2
  results.mirrorWins[0][2] = 1
  results.mirrorPairs[0][2] = 5
  results.mirrorWins[0][3] = 2
  results.mirrorWins[3][0] = 1
  results.mirrorPairs[0][3] = 5
  results.mirrorWins[1][2] = 1
  results.mirrorWins[2][1] = 3
  results.mirrorPairs[1][2] = 5
  results.mirrorWins[1][3] = 1
  results.mirrorWins[3][1] = 1
  results.mirrorPairs[1][3] = 5
  results.mirrorWins[2][3] = 2
  results.mirrorWins[3][2] = 1
  results.mirrorPairs[2][3] = 5

  results.chinchones[1][0] = 1
  results.chinchones[1][2] = 2
  results.chinchones[1][3] = 1
  results.chinchones[3][0] = 1

  return results
}

describe('TOURNAMENT_FIXTURE', () => {
  it('uses the FIFA-style round robin for 4 bots', () => {
    expect(TOURNAMENT_FIXTURE_BY_FECHA).toHaveLength(3)
    expect(TOURNAMENT_FIXTURE_BY_FECHA.map((fecha) => fecha.length)).toEqual([2, 2, 2])

    expect(TOURNAMENT_FIXTURE_BY_FECHA[0].map((match) => [match.aSlot, match.bSlot])).toEqual([
      [0, 1],
      [2, 3],
    ])
    expect(TOURNAMENT_FIXTURE_BY_FECHA[1].map((match) => [match.aSlot, match.bSlot])).toEqual([
      [0, 2],
      [1, 3],
    ])
    expect(TOURNAMENT_FIXTURE_BY_FECHA[2].map((match) => [match.aSlot, match.bSlot])).toEqual([
      [0, 3],
      [1, 2],
    ])

    const uniqueMatches = new Set(
      TOURNAMENT_FIXTURE.map((match) => `${Math.min(match.aSlot, match.bSlot)}-${Math.max(match.aSlot, match.bSlot)}`),
    )

    expect(TOURNAMENT_FIXTURE).toHaveLength(6)
    expect(uniqueMatches.size).toBe(6)
  })
})

describe('getTournamentBotTotals', () => {
  it('aggregates wins and mirror wins from triangular matrices', () => {
    const results = createEmptyTournamentResults()

    results.wins[0][1] = 6
    results.games[0][1] = 10
    results.wins[0][2] = 3
    results.games[0][2] = 8
    results.wins[0][3] = 4
    results.games[0][3] = 6
    results.wins[1][2] = 0
    results.games[1][2] = 4
    results.wins[1][3] = 1
    results.games[1][3] = 6
    results.wins[2][3] = 5
    results.games[2][3] = 10

    results.mirrorWins[0][1] = 2
    results.mirrorWins[1][0] = 1
    results.mirrorPairs[0][1] = 5
    results.mirrorWins[0][2] = 1
    results.mirrorPairs[0][2] = 4
    results.mirrorWins[0][3] = 1
    results.mirrorPairs[0][3] = 3
    results.mirrorWins[2][1] = 1
    results.mirrorPairs[1][2] = 2
    results.mirrorWins[3][1] = 1
    results.mirrorPairs[1][3] = 3
    results.mirrorWins[2][3] = 2
    results.mirrorWins[3][2] = 1
    results.mirrorPairs[2][3] = 5

    results.chinchones[0][1] = 2
    results.chinchones[1][0] = 1
    results.chinchones[0][2] = 1
    results.chinchones[2][0] = 2
    results.chinchones[3][0] = 1

    expect(getTournamentBotTotals(results, 0)).toEqual({
      wins: 13,
      games: 24,
      winPct: (13 / 24) * 100,
      mirrorWins: 4,
      mirrorPairs: 12,
      mirrorPct: (4 / 12) * 100,
      chinchones: 3,
    })

    expect(getTournamentBotTotals(results, 3)).toEqual({
      wins: 12,
      games: 22,
      winPct: (12 / 22) * 100,
      mirrorWins: 2,
      mirrorPairs: 11,
      mirrorPct: (2 / 11) * 100,
      chinchones: 1,
    })
  })

  it('returns zero percentages before a bot plays', () => {
    const results = createEmptyTournamentResults()

    expect(getTournamentBotTotals(results, 2)).toEqual({
      wins: 0,
      games: 0,
      winPct: 0,
      mirrorWins: 0,
      mirrorPairs: 0,
      mirrorPct: 0,
      chinchones: 0,
    })
  })
})

describe('buildTournamentMatchSnapshot', () => {
  it('captures finished totals at that moment while new live snapshots keep moving', () => {
    const earlyResults = createEmptyTournamentResults()
    earlyResults.wins[0][1] = 6
    earlyResults.games[0][1] = 10
    earlyResults.mirrorWins[0][1] = 2
    earlyResults.mirrorWins[1][0] = 1
    earlyResults.mirrorPairs[0][1] = 5
    earlyResults.chinchones[0][1] = 1

    const finishedSnapshot = buildTournamentMatchSnapshot(
      TOURNAMENT_FIXTURE[0],
      earlyResults,
      'finished',
    )

    const liveResults = cloneResults(earlyResults)
    liveResults.wins[0][2] = 3
    liveResults.games[0][2] = 8
    liveResults.mirrorWins[0][2] = 1
    liveResults.mirrorPairs[0][2] = 4
    liveResults.chinchones[0][2] = 2

    const liveSnapshot = buildTournamentMatchSnapshot(
      TOURNAMENT_FIXTURE[2],
      liveResults,
      'running',
    )

    expect(finishedSnapshot).toMatchObject({
      status: 'finished',
      games: 10,
      wins: [6, 4],
      winPct: [60, 40],
      mirrorWins: [2, 1],
      mirrorPct: [40, 20],
      chinchones: [1, 0],
      totals: [
        {
          wins: 6,
          games: 10,
          winPct: 60,
          mirrorWins: 2,
          mirrorPairs: 5,
          mirrorPct: 40,
          chinchones: 1,
        },
        {
          wins: 4,
          games: 10,
          winPct: 40,
          mirrorWins: 1,
          mirrorPairs: 5,
          mirrorPct: 20,
          chinchones: 0,
        },
      ],
    })

    expect(liveSnapshot).toMatchObject({
      status: 'running',
      games: 8,
      wins: [3, 5],
      winPct: [37.5, 62.5],
      mirrorWins: [1, 0],
      mirrorPct: [25, 0],
      chinchones: [2, 0],
      totals: [
        {
          wins: 9,
          games: 18,
          winPct: 50,
          mirrorWins: 3,
          mirrorPairs: 9,
          mirrorPct: (3 / 9) * 100,
          chinchones: 3,
        },
        {
          wins: 5,
          games: 8,
          winPct: 62.5,
          mirrorWins: 0,
          mirrorPairs: 4,
          mirrorPct: 0,
          chinchones: 0,
        },
      ],
    })

    expect(finishedSnapshot.totals[0].wins).toBe(6)
  })
})

describe('buildTournamentCeremonyData', () => {
  it('assigns ceremony points, anecdotal awards and the champion from the same totals', () => {
    const results = createCeremonyResults()
    const ceremony = buildTournamentCeremonyData(results)

    expect(ceremony.winsAwardWinner.idx).toBe(0)
    expect(ceremony.mirrorAwardWinner.idx).toBe(0)
    expect(ceremony.mirrorAwardRunnerUp?.idx).toBe(3)
    expect(ceremony.chinchonAwardWinner.idx).toBe(0)
    expect(ceremony.beatAllAwardWinner?.idx).toBe(0)
    expect(ceremony.lostToEveryoneAward?.idx).toBe(2)
    expect(ceremony.noRiskBots.map((entry) => entry.idx)).toEqual([1, 2])

    expect(ceremony.ceremonyRanking.map((entry) => ({
      idx: entry.idx,
      winsPoints: entry.winsPoints,
      mirrorPoints: entry.mirrorPoints,
      auraPoints: entry.auraPoints,
      beatAllPoints: entry.beatAllPoints,
      score: entry.score,
    }))).toEqual([
      { idx: 0, winsPoints: 2, mirrorPoints: 4, auraPoints: 2, beatAllPoints: 2, score: 10 },
      { idx: 3, winsPoints: 0, mirrorPoints: 2, auraPoints: 0, beatAllPoints: 0, score: 2 },
      { idx: 1, winsPoints: 0, mirrorPoints: 0, auraPoints: 0, beatAllPoints: 0, score: 0 },
      { idx: 2, winsPoints: 0, mirrorPoints: 0, auraPoints: 0, beatAllPoints: 0, score: 0 },
    ])

    expect(ceremony.ceremonyChampion.idx).toBe(0)
  })

  it('uses total wins as the first tiebreaker for the champion', () => {
    const results = createTieBreakResults()
    const ceremony = buildTournamentCeremonyData(results)

    const topTwo = ceremony.ceremonyRanking.slice(0, 2)

    expect(topTwo.map((entry) => ({
      idx: entry.idx,
      score: entry.score,
      wins: entry.wins,
    }))).toEqual([
      { idx: 0, score: 4, wins: 19 },
      { idx: 1, score: 4, wins: 15 },
    ])
    expect(ceremony.ceremonyChampion.idx).toBe(0)
  })

  it('uses the direct matchup first when two bots tie on ceremony points', () => {
    const results = createHeadToHeadPointsTieResults()
    const ceremony = buildTournamentCeremonyData(results)

    const tiedBotsOrder = ceremony.ceremonyRanking
      .filter((entry) => [0, 1, 3].includes(entry.idx))
      .map((entry) => entry.idx)

    expect(tiedBotsOrder).toEqual([1, 0, 3])
  })

  it('marks bots without any good or bad recognition with the can award', () => {
    const results = createNoRecognitionResults()
    const ceremony = buildTournamentCeremonyData(results)

    expect(ceremony.everyoneShouldWinPrizeBots.map((entry) => entry.idx)).toEqual([3])
  })

  it('falls back safely when malformed tournament results slip through', () => {
    const malformedResults = {
      wins: [],
      games: [],
      mirrorWins: [],
      mirrorPairs: [],
      chinchones: [],
    }

    expect(isValidTournamentResults(malformedResults)).toBe(false)
    expect(getTournamentBotTotals(malformedResults as never, 0)).toEqual({
      wins: 0,
      games: 0,
      winPct: 0,
      mirrorWins: 0,
      mirrorPairs: 0,
      mirrorPct: 0,
      chinchones: 0,
    })

    const ceremony = buildTournamentCeremonyData(malformedResults as never)

    expect(ceremony.ceremonyChampion.idx).toBe(0)
    expect(ceremony.ceremonyRanking).toHaveLength(4)
    expect(ceremony.botTotals.every((entry) => entry.games === 0 && entry.wins === 0)).toBe(true)
  })
})
