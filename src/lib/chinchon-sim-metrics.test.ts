import { describe, expect, it } from 'vitest'

import {
  captureSimulationExamples,
  compareBotMirrorMetrics,
  createEmptySimulationExamples,
  getChinchonWinRate,
  getNextStableStreak,
  getPercentOfTotal,
  getTruncatedWinRates,
  getWinRates,
  summarizeSimulatedPair,
  truncateRate,
} from './chinchon-sim-metrics'

describe('getWinRates', () => {
  it('returns complementary win percentages', () => {
    expect(getWinRates(3, 1)).toEqual([75, 25])
  })

  it('returns zeroes when there are no wins yet', () => {
    expect(getWinRates(0, 0)).toEqual([0, 0])
  })
})

describe('truncateRate', () => {
  it('truncates instead of rounding', () => {
    expect(truncateRate(12.9876, 2)).toBe(12.98)
  })

  it('supports zero decimals', () => {
    expect(truncateRate(49.99, 0)).toBe(49)
  })
})

describe('getTruncatedWinRates', () => {
  it('truncates both bot winrates with the requested precision', () => {
    expect(getTruncatedWinRates(5, 3, 1)).toEqual([62.5, 37.5])
  })
})

describe('getNextStableStreak', () => {
  it('starts the streak at one when there is no previous sample', () => {
    expect(getNextStableStreak(null, [50, 50], 0)).toBe(1)
  })

  it('increments the streak while truncated rates stay equal', () => {
    expect(getNextStableStreak([50.1, 49.8], [50.1, 49.8], 3)).toBe(4)
  })

  it('resets the streak when truncated rates change', () => {
    expect(getNextStableStreak([50.1, 49.8], [50.2, 49.7], 3)).toBe(1)
  })
})

describe('getChinchonWinRate', () => {
  it('measures chinchones over that bot wins', () => {
    expect(getChinchonWinRate(4, 10)).toBe(40)
  })

  it('returns zero when the bot still has no wins', () => {
    expect(getChinchonWinRate(2, 0)).toBe(0)
  })
})

describe('pair mirror aggregation', () => {
  it('counts mirror rounds only while both games still have that round index', () => {
    const summary = summarizeSimulatedPair(
      {
        gameLoser: 1,
        scores: [30, 110],
        roundStats: [
          { winner: 0, cards: 1, chinchon: false },
          { winner: 0, cards: 2, chinchon: false },
          { winner: 1, cards: 3, chinchon: false },
        ],
      },
      {
        gameLoser: 0,
        scores: [102, 54],
        roundStats: [
          { winner: 0, cards: 2, chinchon: false },
          { winner: 1, cards: 3, chinchon: false },
        ],
      },
    )

    expect(summary.bots[0].gamesWon).toBe(1)
    expect(summary.bots[1].gamesWon).toBe(1)
    expect(summary.bots[0].roundsPlayed).toBe(5)
    expect(summary.bots[0].roundsWon).toBe(3)
    expect(summary.bots[1].roundsWon).toBe(2)
    expect(summary.bots[0].mirrorRoundsPlayed).toBe(2)
    expect(summary.bots[0].mirrorRoundsWon).toBe(1)
    expect(summary.bots[1].mirrorRoundsWon).toBe(0)
    expect(summary.splitMirrorRounds).toBe(1)
    expect(summary.orphanRounds).toBe(1)
    expect(summary.bots[0].orphanRoundsPlayed).toBe(1)
    expect(summary.bots[1].orphanRoundsPlayed).toBe(1)
  })

  it('counts chinchon wins as game wins by chinchon', () => {
    const summary = summarizeSimulatedPair(
      {
        gameLoser: 1,
        scores: [0, 999],
        roundStats: [{ winner: 0, cards: 0, chinchon: true }],
      },
      {
        gameLoser: 1,
        scores: [0, 999],
        roundStats: [{ winner: 0, cards: 0, chinchon: true }],
      },
    )

    expect(summary.bots[0].gamesWon).toBe(2)
    expect(summary.bots[0].chinchonWins).toBe(2)
    expect(summary.bots[1].chinchonWins).toBe(0)
  })
})

describe('compareBotMirrorMetrics', () => {
  it('prioritizes games first and mirror rounds second', () => {
    const left = {
      gamesWon: 11,
      mirrorRoundsWon: 30,
    }
    const right = {
      gamesWon: 10,
      mirrorRoundsWon: 999,
    }

    expect(compareBotMirrorMetrics(left, right)).toBeGreaterThan(0)
  })
})

describe('getPercentOfTotal', () => {
  it('returns percentages when there is data', () => {
    expect(getPercentOfTotal(3, 4)).toBe(75)
  })

  it('returns zero when total is zero', () => {
    expect(getPercentOfTotal(3, 0)).toBe(0)
  })
})

describe('captureSimulationExamples', () => {
  it('keeps the first valid example for each slot', () => {
    const examples = createEmptySimulationExamples()

    captureSimulationExamples(examples, {
      simulationIndex: 2,
      roundIndex: 0,
      roundA: { winner: 0, cards: 1, chinchon: false },
      roundB: { winner: 0, cards: 2, chinchon: false },
      getReplayPair: () => ({ replayA: [], replayB: [] }),
    })

    captureSimulationExamples(examples, {
      simulationIndex: 9,
      roundIndex: 3,
      roundA: { winner: 0, cards: 4, chinchon: false },
      roundB: { winner: 0, cards: 5, chinchon: false },
      getReplayPair: () => ({ replayA: [], replayB: [] }),
    })

    expect(examples.mirrorRoundsWon[0]?.simulationIndex).toBe(2)
    expect(examples.mirrorRoundsWon[0]?.roundIndex).toBe(0)
  })

  it('can fill both chinchon slots from opposite winners in the same mirror round', () => {
    const examples = createEmptySimulationExamples()
    let replayCalls = 0

    captureSimulationExamples(examples, {
      simulationIndex: 4,
      roundIndex: 1,
      roundA: { winner: 0, cards: 0, chinchon: true },
      roundB: { winner: 1, cards: 0, chinchon: true },
      getReplayPair: () => {
        replayCalls += 1
        return { replayA: [], replayB: [] }
      },
    })

    expect(examples.chinchonWins[0]?.simulationIndex).toBe(4)
    expect(examples.chinchonWins[1]?.simulationIndex).toBe(4)
    expect(replayCalls).toBe(1)
  })

  it('fills the mirror-round slot for the bot that wins both sides', () => {
    const examples = createEmptySimulationExamples()

    captureSimulationExamples(examples, {
      simulationIndex: 1,
      roundIndex: 2,
      roundA: { winner: 1, cards: 3, chinchon: false },
      roundB: { winner: 1, cards: 2, chinchon: false },
      getReplayPair: () => ({ replayA: [], replayB: [] }),
    })

    expect(examples.mirrorRoundsWon[0]).toBeNull()
    expect(examples.mirrorRoundsWon[1]?.simulationIndex).toBe(1)
    expect(examples.mirrorRoundsWon[1]?.roundIndex).toBe(2)
  })

  it('leaves slots empty when no matching example appears', () => {
    const examples = createEmptySimulationExamples()

    captureSimulationExamples(examples, {
      simulationIndex: 0,
      roundIndex: 0,
      roundA: { winner: 0, cards: 1, chinchon: false },
      roundB: { winner: 1, cards: 1, chinchon: false },
      getReplayPair: () => ({ replayA: [], replayB: [] }),
    })

    expect(examples.mirrorRoundsWon[0]).toBeNull()
    expect(examples.mirrorRoundsWon[1]).toBeNull()
    expect(examples.chinchonWins[0]).toBeNull()
    expect(examples.chinchonWins[1]).toBeNull()
  })
})
