import {
  createDeck,
  cutScore,
  findBestMelds,
  legalDiscardIndex,
  playRoundScored,
  sameCard,
  shouldDrawDiscard,
  shuffle,
  type Card,
} from './chinchon-bot-game'
import { createBotCatalog, type BotConfig, type BotRuntime } from './chinchon-bot-presets'

export type SimulatedRoundStat = {
  winner: 0 | 1
  cards: number
  chinchon: boolean
}

export type SimulatedGameResult = {
  gameLoser: 0 | 1
  scores: [number, number]
  roundStats: SimulatedRoundStat[]
}

export type ReplayStep =
  | { type: 'deal'; hands: [Card[], Card[]]; melds: [ReturnType<typeof findBestMelds>, ReturnType<typeof findBestMelds>]; drawn: [number, number] }
  | { type: 'initial_discard'; player: 0 | 1; discarded: Card; hands: [Card[], Card[]]; melds: [ReturnType<typeof findBestMelds>, ReturnType<typeof findBestMelds>]; freeCards: number; drawn: [number, number] }
  | { type: 'cut'; player: 0 | 1; card: Card | null; kept: boolean; discarded: Card | null; hands: [Card[], Card[]]; melds: [ReturnType<typeof findBestMelds>, ReturnType<typeof findBestMelds>]; freeCards: number; drawn: [number, number]; chinchon: boolean; score: number; resto?: number }
  | { type: 'turn'; player: 0 | 1; card: Card; kept: boolean; discarded: Card; hands: [Card[], Card[]]; melds: [ReturnType<typeof findBestMelds>, ReturnType<typeof findBestMelds>]; freeCards: number; resto: number; drawn: [number, number] }
  | { type: 'timeout'; winner: 0 | 1; hands: [Card[], Card[]]; melds: [ReturnType<typeof findBestMelds>, ReturnType<typeof findBestMelds>]; restos: [number, number]; frees: [number, number]; drawn: [number, number] }

const deepHand = (hand: Card[]) => hand.map(card => ({ ...card }))
const deepDeck = (deck: Card[]) => deck.map(card => ({ ...card }))

export function createRuntimeBots(customConfigs: BotConfig[]) {
  return createBotCatalog(customConfigs)
}

export function simulateGamePairWithBots(bots: BotRuntime[], bi0: number, bi1: number): [SimulatedGameResult, SimulatedGameResult] {
  const bot0 = bots[bi0]
  const bot1 = bots[bi1]
  const scoresA: [number, number] = [0, 0]
  const scoresB: [number, number] = [0, 0]
  let dealer = 0
  const statsA: SimulatedRoundStat[] = []
  const statsB: SimulatedRoundStat[] = []
  let aOver = false
  let bOver = false

  while (!aOver || !bOver) {
    const fullDeck = shuffle(createDeck())
    const h0 = fullDeck.splice(0, 7)
    const h1 = fullDeck.splice(0, 7)
    const deck = fullDeck
    const starterA = dealer === 0 ? 1 : 0
    const starterB = 1 - starterA

    if (!aOver) {
      let resultA
      if (starterA === 0) {
        resultA = playRoundScored(deepHand(h0), deepHand(h1), deepDeck(deck), bot0, bot1, [scoresA[0], scoresA[1]])
      } else {
        const raw = playRoundScored(deepHand(h1), deepHand(h0), deepDeck(deck), bot1, bot0, [scoresA[1], scoresA[0]])
        resultA = { winner: raw.winner === 0 ? 1 : 0, cards: raw.cards, addScores: [raw.addScores[1], raw.addScores[0]], chinchon: raw.chinchon }
      }

      if (resultA.chinchon) {
        aOver = true
        statsA.push({ winner: resultA.winner as 0 | 1, cards: resultA.cards, chinchon: true })
        scoresA[resultA.winner === 0 ? 1 : 0] = 999
      } else {
        scoresA[0] += resultA.addScores[0]
        scoresA[1] += resultA.addScores[1]
        statsA.push({ winner: resultA.winner as 0 | 1, cards: resultA.cards, chinchon: false })
        if (scoresA[0] >= 100 || scoresA[1] >= 100) aOver = true
      }
    }

    if (!bOver) {
      let resultB
      if (starterB === 0) {
        resultB = playRoundScored(deepHand(h1), deepHand(h0), deepDeck(deck), bot0, bot1, [scoresB[0], scoresB[1]])
      } else {
        const raw = playRoundScored(deepHand(h0), deepHand(h1), deepDeck(deck), bot1, bot0, [scoresB[1], scoresB[0]])
        resultB = { winner: raw.winner === 0 ? 1 : 0, cards: raw.cards, addScores: [raw.addScores[1], raw.addScores[0]], chinchon: raw.chinchon }
      }

      if (resultB.chinchon) {
        bOver = true
        statsB.push({ winner: resultB.winner as 0 | 1, cards: resultB.cards, chinchon: true })
        scoresB[resultB.winner === 0 ? 1 : 0] = 999
      } else {
        scoresB[0] += resultB.addScores[0]
        scoresB[1] += resultB.addScores[1]
        statsB.push({ winner: resultB.winner as 0 | 1, cards: resultB.cards, chinchon: false })
        if (scoresB[0] >= 100 || scoresB[1] >= 100) bOver = true
      }
    }

    dealer = 1 - dealer
  }

  return [
    { gameLoser: scoresA[0] >= 100 ? 0 : 1, scores: scoresA, roundStats: statsA },
    { gameLoser: scoresB[0] >= 100 ? 0 : 1, scores: scoresB, roundStats: statsB },
  ]
}

export function simulateGamePair(customConfigs: BotConfig[], bi0: number, bi1: number) {
  return simulateGamePairWithBots(createRuntimeBots(customConfigs), bi0, bi1)
}

export function playReplay(
  h0: Card[],
  h1: Card[],
  deckIn: Card[],
  strat0: BotRuntime,
  strat1: BotRuntime,
  scores: [number, number],
): ReplayStep[] {
  const hands: [Card[], Card[]] = [h0, h1]
  const deck = deckIn
  const strategies: [BotRuntime, BotRuntime] = [strat0, strat1]
  const drawn: [number, number] = [0, 0]
  const steps: ReplayStep[] = []
  const discardPile: Card[] = []
  const snapshotHands = () => [hands[0].map(card => ({ ...card })), hands[1].map(card => ({ ...card }))] as [Card[], Card[]]
  const snapshotMelds = () => [findBestMelds(hands[0]), findBestMelds(hands[1])] as [ReturnType<typeof findBestMelds>, ReturnType<typeof findBestMelds>]

  if (deck.length) hands[0].push(deck.pop()!)
  steps.push({ type: 'deal', hands: snapshotHands(), melds: snapshotMelds(), drawn: [...drawn] as [number, number] })

  {
    const discardIndex = legalDiscardIndex(hands[0], strategies[0].pickDiscard(hands[0]))
    const discarded = hands[0].splice(discardIndex, 1)[0]
    discardPile.push(discarded)
    const m7 = findBestMelds(hands[0])
    steps.push({ type: 'initial_discard', player: 0, discarded: { ...discarded }, hands: snapshotHands(), melds: snapshotMelds(), freeCards: m7.minFree, drawn: [...drawn] as [number, number] })
    if (strategies[0].canCut(m7, scores[0], hands[0])) {
      const cut = cutScore(hands[0])
      steps.push({
        type: 'cut',
        player: 0,
        card: null,
        kept: false,
        discarded: { ...discarded },
        hands: snapshotHands(),
        melds: snapshotMelds(),
        freeCards: m7.minFree,
        drawn: [...drawn] as [number, number],
        chinchon: cut.chinchon,
        score: cut.score,
      })
      return steps
    }
  }

  {
    const m7 = findBestMelds(hands[1])
    if (strategies[1].canCut(m7, scores[1], hands[1])) {
      const cut = cutScore(hands[1])
      steps.push({
        type: 'cut',
        player: 1,
        card: null,
        kept: false,
        discarded: null,
        hands: snapshotHands(),
        melds: snapshotMelds(),
        freeCards: m7.minFree,
        drawn: [...drawn] as [number, number],
        chinchon: cut.chinchon,
        score: cut.score,
      })
      return steps
    }
  }

  for (let turn = 0; turn < 80; turn++) {
    const player = (1 - (turn % 2)) as 0 | 1
    if (!deck.length) break

    const topDiscard = discardPile.length ? discardPile[discardPile.length - 1] : null
    let card: Card
    if (topDiscard && strategies[player].drawConfig && shouldDrawDiscard(hands[player], topDiscard, strategies[player])) {
      card = discardPile.pop()!
    } else {
      card = deck.pop()!
    }

    hands[player].push(card)
    const discardIndex = legalDiscardIndex(hands[player], strategies[player].pickDiscard(hands[player]))
    const discarded = hands[player][discardIndex]
    const kept = !sameCard(discarded, card)
    hands[player].splice(discardIndex, 1)
    discardPile.push(discarded)
    if (kept) drawn[player] += 1

    const m7 = findBestMelds(hands[player])
    if (strategies[player].canCut(m7, scores[player], hands[player])) {
      const cut = cutScore(hands[player])
      steps.push({
        type: 'cut',
        player,
        card: { ...card },
        kept,
        discarded: { ...discarded },
        hands: snapshotHands(),
        melds: snapshotMelds(),
        freeCards: m7.minFree,
        resto: m7.resto,
        drawn: [...drawn] as [number, number],
        chinchon: cut.chinchon,
        score: cut.score,
      })
      return steps
    }

    steps.push({
      type: 'turn',
      player,
      card: { ...card },
      kept,
      discarded: { ...discarded },
      hands: snapshotHands(),
      melds: snapshotMelds(),
      freeCards: m7.minFree,
      resto: m7.resto,
      drawn: [...drawn] as [number, number],
    })
  }

  const d0 = findBestMelds(hands[0])
  const d1 = findBestMelds(hands[1])
  steps.push({
    type: 'timeout',
    winner: d0.minFree <= d1.minFree ? 0 : 1,
    hands: snapshotHands(),
    melds: snapshotMelds(),
    restos: [d0.resto, d1.resto],
    frees: [d0.minFree, d1.minFree],
    drawn: [...drawn] as [number, number],
  })

  return steps
}

export function generateReplayPair(customConfigs: BotConfig[], bi0: number, bi1: number) {
  const bots = createRuntimeBots(customConfigs)
  const fullDeck = shuffle(createDeck())
  const h0 = fullDeck.splice(0, 7)
  const h1 = fullDeck.splice(0, 7)
  const deck = fullDeck

  return {
    replayA: playReplay(deepHand(h0), deepHand(h1), deepDeck(deck), bots[bi0], bots[bi1], [0, 0]),
    replayB: playReplay(deepHand(h0), deepHand(h1), deepDeck(deck), bots[bi1], bots[bi0], [0, 0]),
  }
}
