import { describe, expect, it } from 'vitest'

import { isJoker } from './chinchon-bot-game'
import { simulateGamePairWithBots } from './chinchon-arena-sim'
import type { BotRuntime } from './chinchon-bot-presets'

function createDeterministicBot(id: string): BotRuntime {
  return {
    id,
    name: id,
    emoji: '🤖',
    color: '#ffffff',
    text: 'text-white',
    bg: 'bg-gray-900',
    border: 'border-gray-700',
    desc: id,
    description: id,
    custom: false,
    shouldDraw: () => false,
    canCut: (m7, _hand, _ctx) => m7.minFree <= 1 && m7.resto <= 5,
    pickDiscard: hand => {
      const index = hand.findIndex(card => !isJoker(card))
      return index >= 0 ? index : 0
    },
  }
}

function withSeed<T>(seed: number, run: () => T): T {
  const originalRandom = Math.random
  let state = seed >>> 0
  Math.random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }

  try {
    return run()
  } finally {
    Math.random = originalRandom
  }
}

describe('simulateGamePairWithBots', () => {
  it('keeps simulation results unchanged when mirror-round observation is enabled', () => {
    const bots = [createDeterministicBot('alpha'), createDeterministicBot('beta')]

    const basePair = withSeed(123456, () => simulateGamePairWithBots(bots, 0, 1))
    const observedRoundIndexes: number[] = []
    const instrumentedPair = withSeed(123456, () =>
      simulateGamePairWithBots(bots, 0, 1, {
        onMirrorRound: round => {
          observedRoundIndexes.push(round.roundIndex)
          const replayPair = round.createReplayPair()
          expect(replayPair.replayA.length).toBeGreaterThan(0)
          expect(replayPair.replayB.length).toBeGreaterThan(0)
        },
      }),
    )

    expect(instrumentedPair).toEqual(basePair)
    expect(observedRoundIndexes).toEqual(
      Array.from({ length: Math.min(basePair[0].roundStats.length, basePair[1].roundStats.length) }, (_, index) => index),
    )
  })
})
