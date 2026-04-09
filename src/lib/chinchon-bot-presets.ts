import {
  RANK_ORDER,
  cardRest,
  findBestMelds,
  isJoker,
} from './chinchon-bot-game'
import type { Card, GameContext, MeldResult } from './chinchon-bot-game'

// ── v1 types (kept for migration) ──────────────────────────────

export type DrawMode = 'always_deck' | 'smart' | 'aggressive'
export type DiscardMode = 'default' | 'high_rank' | 'optimal'

export type BotConfigV1 = {
  id: string
  name: string
  emoji: string
  colorIdx?: number
  color?: string
  text?: string
  bg?: string
  border?: string
  description?: string
  draw: { mode: DrawMode; restoThreshold?: number }
  discard: { mode: DiscardMode }
  cut: {
    maxFree: 0 | 1
    baseResto: number
    useScoreRules: boolean
    scoreRules: ScoreRule[]
    pursueChinchon: boolean
    chinchonThreshold: 5 | 6
    chinchonRunMode: boolean
  }
}

// ── v2 types ───────────────────────────────────────────────────

export type ScoreRule = {
  minScore: number
  maxResto: number
}

export type BotConfig = {
  id: string
  name: string
  emoji: string
  colorIdx?: number
  color?: string
  text?: string
  bg?: string
  border?: string
  description?: string

  global: {
    temperature: number   // 0-10
    mistakeRate: number   // 0-10  DEBUG
  }

  draw: {
    improvementThreshold: number  // 0-10
    structuralPriority: number    // 0-10
    infoAversion: number          // 0-10
    chinchonBias: number          // 0-10
    tempoPreference: number       // 0-10
  }

  discard: {
    evalScope: 'fast' | 'full'
    restoBias: number             // 0-10
    potentialBias: number         // 0-10
    rankBias: number              // 0-10  DEBUG
    jokerProtection: number       // 0-10
  }

  cut: {
    maxFree: 0 | 1
    baseResto: number             // 0-5
    useScoreRules: boolean
    scoreRules: ScoreRule[]
    chinchonPursuit: number       // 0-10
    chinchonThreshold: 4 | 5 | 6
    minus10Pursuit: number        // 0-10
    deckUrgency: number           // 0-10
    leadProtection: number        // 0-10
    desperationMode: number       // 0-10
  }
}

export type BotRuntime = {
  id: string
  name: string
  emoji: string
  color: string
  text: string
  bg: string
  border: string
  desc: string
  description: string
  custom: boolean
  shouldDraw: (hand: Card[], top: Card, ctx: GameContext) => boolean
  canCut: (m7: MeldResult, hand: Card[], ctx: GameContext) => boolean
  pickDiscard: (hand8: Card[], ctx: GameContext) => number
}

export const CUSTOM_EMOJIS = [
  '🧬', '🧪', '⚡', '🎲', '💎', '🦾', '🧠', '🔥', '🤡',
  '🎯', '🎭', '🚀', '💀', '👻', '🕷️', '🍀', '🌟',
  '👑', '🐉', '🦊', '🦁', '🌊', '🏆', '🌋', '🛡️',
  '🎪', '🎸', '🦈', '🦋', '🌈', '🎩', '🔱', '🌀',
] as const

export const CUSTOM_COLORS = [
  { color: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-950', border: 'border-amber-800' },
  { color: '#06b6d4', text: 'text-cyan-400', bg: 'bg-cyan-950', border: 'border-cyan-800' },
  { color: '#f97316', text: 'text-orange-400', bg: 'bg-orange-950', border: 'border-orange-800' },
  { color: '#14b8a6', text: 'text-teal-400', bg: 'bg-teal-950', border: 'border-teal-800' },
  { color: '#fb7185', text: 'text-rose-400', bg: 'bg-rose-950', border: 'border-rose-800' },
  { color: '#818cf8', text: 'text-indigo-400', bg: 'bg-indigo-950', border: 'border-indigo-800' },
  { color: '#a3e635', text: 'text-lime-400', bg: 'bg-lime-950', border: 'border-lime-800' },
  { color: '#c084fc', text: 'text-purple-400', bg: 'bg-purple-950', border: 'border-purple-800' },
] as const

export const MAX_CUSTOM_BOTS = 8

// ── Defaults ───────────────────────────────────────────────────

export function defaultScoreRules(): ScoreRule[] {
  return [
    { minScore: 0, maxResto: 5 },
    { minScore: 25, maxResto: 3 },
    { minScore: 50, maxResto: 2 },
    { minScore: 75, maxResto: 1 },
  ]
}

export function createDefaultCustomConfig(): BotConfig {
  return {
    id: `custom-${Date.now()}`,
    name: 'Mi Bot',
    emoji: '🧪',
    colorIdx: 0,
    description: '',
    global: { temperature: 2, mistakeRate: 0 },
    draw: { improvementThreshold: 3, structuralPriority: 5, infoAversion: 0, chinchonBias: 0, tempoPreference: 5 },
    discard: { evalScope: 'fast', restoBias: 8, potentialBias: 3, rankBias: 0, jokerProtection: 5 },
    cut: {
      maxFree: 1,
      baseResto: 5,
      useScoreRules: false,
      scoreRules: defaultScoreRules(),
      chinchonPursuit: 0,
      chinchonThreshold: 6,
      minus10Pursuit: 0,
      deckUrgency: 3,
      leadProtection: 3,
      desperationMode: 3,
    },
  }
}

// ── Hand analysis helpers ──────────────────────────────────────

function nearChinchonCustom(hand: Card[], threshold: number) {
  const jokers = hand.filter(isJoker).length
  const bySuit: Record<number, number[]> = {}
  hand.forEach(card => {
    if (!isJoker(card)) (bySuit[card.suit] ??= []).push(RANK_ORDER[card.rank])
  })

  for (const orders of Object.values(bySuit)) {
    orders.sort((a, b) => a - b)
    for (let start = 0; start <= 5; start++) {
      let present = 0
      for (let pos = start; pos <= start + 6; pos++) {
        if (orders.includes(pos)) present += 1
      }
      if (present + jokers >= threshold) return true
    }
  }
  return false
}

function has4RunSameSuit(hand: Card[]) {
  const bySuit: Record<number, number[]> = {}
  hand.forEach(card => {
    if (!isJoker(card)) (bySuit[card.suit] ??= []).push(RANK_ORDER[card.rank])
  })

  for (const orders of Object.values(bySuit)) {
    if (orders.length < 4) continue
    orders.sort((a, b) => a - b)
    let run = 1
    for (let i = 1; i < orders.length; i++) {
      if (orders[i] === orders[i - 1] + 1) {
        run += 1
        if (run >= 4) return true
      } else {
        run = 1
      }
    }
  }
  return false
}

/** Count how many cards form pairs (same rank, 2+ cards) */
function countPairCards(hand: Card[]): number {
  const byRank: Record<number, number> = {}
  hand.forEach(c => { if (!isJoker(c)) byRank[c.rank] = (byRank[c.rank] ?? 0) + 1 })
  let count = 0
  for (const n of Object.values(byRank)) if (n >= 2) count += n
  return count
}

/** Count how many cards are "connectors" (consecutive same suit) */
function countConnectors(hand: Card[]): number {
  const bySuit: Record<number, number[]> = {}
  hand.forEach(c => {
    if (!isJoker(c)) (bySuit[c.suit] ??= []).push(RANK_ORDER[c.rank])
  })
  let count = 0
  for (const orders of Object.values(bySuit)) {
    orders.sort((a, b) => a - b)
    for (let i = 1; i < orders.length; i++) {
      if (orders[i] - orders[i - 1] <= 2) count += 2 // both cards are connectors
    }
  }
  return count
}

/** Check if a joker would be left "loose" (not in any meld) after removing a card */
function jokerExposedAfterDiscard(hand8: Card[], discardIdx: number): boolean {
  const testHand = hand8.filter((_, i) => i !== discardIdx)
  const hasJoker = testHand.some(isJoker)
  if (!hasJoker) return false
  const analysis = findBestMelds(testHand)
  const inMeld = new Set(analysis.meldsCut.flat())
  return testHand.some((c, i) => isJoker(c) && !inMeld.has(i))
}

// ── Noise helpers ──────────────────────────────────────────────

function applyMistake(shouldAct: boolean, mistakeRate: number): boolean {
  if (mistakeRate <= 0) return shouldAct
  return Math.random() * 100 < mistakeRate ? !shouldAct : shouldAct
}

function addNoise(score: number, temperature: number): number {
  if (temperature <= 0) return score
  const noise = (Math.random() - 0.5) * 2 * temperature
  return score + noise
}


// ── Decision builders ──────────────────────────────────────────

const BASE_INFO_COST = 3

export function buildShouldDraw(cfg: BotConfig) {
  return (hand: Card[], top: Card, _ctx: GameContext): boolean => {
    if (cfg.draw.infoAversion >= 10) return applyMistake(false, cfg.global.mistakeRate)

    const b7 = findBestMelds(hand)
    const a8 = findBestMelds([...hand, { ...top }])

    // Structural improvement (fewer free cards)
    const structImprove = (b7.minFree - a8.minFree) * cfg.draw.structuralPriority

    // Resto improvement above threshold
    const restoDelta = b7.resto - a8.resto
    const restoImprove = Math.max(0, restoDelta - cfg.draw.improvementThreshold) * 2

    // Chinchón bias: does taking this card bring us closer?
    let chinchonBonus = 0
    if (cfg.draw.chinchonBias > 0) {
      const before = nearChinchonCustom(hand, 5)
      const after = nearChinchonCustom([...hand, top], 5)
      if (!before && after) chinchonBonus = cfg.draw.chinchonBias * 2
      else if (after) chinchonBonus = cfg.draw.chinchonBias * 0.5
    }

    // Tempo: can we cut after taking this card?
    let tempoBonus = 0
    if (cfg.draw.tempoPreference > 0 && a8.minFree <= 1 && a8.resto <= 5) {
      tempoBonus = cfg.draw.tempoPreference * 1.5
    }

    // Info cost penalty
    const infoPenalty = cfg.draw.infoAversion * BASE_INFO_COST

    let score = structImprove + restoImprove + chinchonBonus + tempoBonus - infoPenalty
    score = addNoise(score, cfg.global.temperature)

    const shouldTake = score > 0
    return applyMistake(shouldTake, cfg.global.mistakeRate)
  }
}

export function buildPickDiscard(cfg: BotConfig) {
  return (hand8: Card[], _ctx: GameContext): number => {
    const analysis = findBestMelds(hand8)
    const inMeld = new Set(analysis.meldsCut.flat())

    // Determine candidates
    const candidates: number[] = []
    for (let i = 0; i < hand8.length; i++) {
      if (isJoker(hand8[i])) continue
      if (cfg.discard.evalScope === 'fast' && inMeld.has(i)) continue
      candidates.push(i)
    }
    if (candidates.length === 0) {
      // Fallback: discard last non-joker
      for (let i = hand8.length - 1; i >= 0; i--) {
        if (!isJoker(hand8[i])) return i
      }
      return hand8.length - 1
    }

    // Score each candidate
    let bestIdx = candidates[0]
    let bestScore = -Infinity

    for (const idx of candidates) {
      const card = hand8[idx]
      let score = 0

      if (cfg.discard.evalScope === 'full') {
        // Evaluate resulting 7-card hand quality
        const testHand = hand8.filter((_, i) => i !== idx)
        const result = findBestMelds(testHand)
        // Lower resto and fewer free cards = better discard (higher score to discard this card)
        score += cfg.discard.restoBias * (analysis.resto - result.resto + cardRest(card)) * 0.3
        score += (analysis.minFree - result.minFree) * 5
      } else {
        // Fast mode: score based on card properties
        score += cfg.discard.restoBias * cardRest(card) * 0.5
      }

      // Rank bias (DEBUG): prefer discarding high-rank cards
      score += cfg.discard.rankBias * card.rank * 0.3

      // Potential preservation penalty: penalize discarding connectors/pairs
      if (cfg.discard.potentialBias > 0) {
        const handWithout = hand8.filter((_, i) => i !== idx)
        const pairsBefore = countPairCards(hand8)
        const pairsAfter = countPairCards(handWithout)
        const connBefore = countConnectors(hand8)
        const connAfter = countConnectors(handWithout)
        const potentialLost = (pairsBefore - pairsAfter) + (connBefore - connAfter) * 0.5
        score -= cfg.discard.potentialBias * Math.max(0, potentialLost) * 0.8
      }

      // Joker protection: penalize if discarding this exposes a joker
      if (cfg.discard.jokerProtection > 0 && jokerExposedAfterDiscard(hand8, idx)) {
        score -= cfg.discard.jokerProtection * 3
      }

      score = addNoise(score, cfg.global.temperature * 0.5)

      if (score > bestScore) {
        bestScore = score
        bestIdx = idx
      }
    }

    // Apply mistake: pick second-best instead
    if (cfg.global.mistakeRate > 0 && Math.random() * 100 < cfg.global.mistakeRate && candidates.length > 1) {
      const sorted = candidates
        .map(idx => ({ idx, score: bestIdx === idx ? bestScore : -Infinity }))
        .sort((a, b) => b.score - a.score)
      if (sorted.length > 1) return sorted[1].idx
    }

    return bestIdx
  }
}

export function buildCanCut(cfg: BotConfig) {
  return (m7: MeldResult, hand: Card[], ctx: GameContext): boolean => {
    // Legal check
    if (m7.minFree > 1 || m7.resto > 5) return false

    // Chinchón pursuit: if near chinchón and pursuit is high, wait
    if (cfg.cut.chinchonPursuit > 0) {
      const threshold = cfg.cut.chinchonThreshold ?? 6
      if (nearChinchonCustom(hand, threshold) || (cfg.cut.chinchonPursuit >= 6 && has4RunSameSuit(hand))) {
        if (cfg.cut.chinchonPursuit >= 7) return applyMistake(m7.minFree === 0, cfg.global.mistakeRate)
        if (cfg.cut.chinchonPursuit >= 4) return applyMistake(m7.minFree === 0 && m7.resto <= 1, cfg.global.mistakeRate)
      }
    }

    // Minus10 pursuit: wait for perfect hand
    if (cfg.cut.minus10Pursuit >= 7 && m7.minFree > 0) {
      return applyMistake(false, cfg.global.mistakeRate)
    }
    if (cfg.cut.minus10Pursuit >= 4 && m7.minFree > 0 && m7.resto > 1) {
      return applyMistake(false, cfg.global.mistakeRate)
    }

    // Determine effective maxResto target
    let restoTarget: number
    if (cfg.cut.useScoreRules) {
      const rules = [...cfg.cut.scoreRules].reverse()
      restoTarget = rules.find(r => ctx.myScore >= r.minScore)?.maxResto ?? cfg.cut.baseResto
    } else {
      restoTarget = cfg.cut.baseResto
    }

    // Deck urgency: relax target when deck is low
    if (cfg.cut.deckUrgency > 0 && ctx.deckRemaining < 15) {
      const urgencyBonus = cfg.cut.deckUrgency * (1 - ctx.deckRemaining / 15) * 0.5
      restoTarget = Math.min(5, restoTarget + urgencyBonus)
    }

    // Lead protection: relax target when winning to close out faster
    if (cfg.cut.leadProtection > 0 && ctx.myScore < ctx.oppScore) {
      const leadBonus = cfg.cut.leadProtection * 0.2
      restoTarget = Math.min(5, restoTarget + leadBonus)
    }

    // Desperation mode: if losing badly, tighten target to seek -10/chinchón
    if (cfg.cut.desperationMode > 0 && ctx.myScore > ctx.oppScore + 20) {
      const despPenalty = cfg.cut.desperationMode * 0.3
      restoTarget = Math.max(0, restoTarget - despPenalty)
    }

    restoTarget = Math.min(restoTarget, 5)
    const shouldCut = m7.minFree <= cfg.cut.maxFree && m7.resto <= restoTarget
    return applyMistake(shouldCut, cfg.global.mistakeRate)
  }
}


// ── Description generator ──────────────────────────────────────

export function generateDesc(cfg: BotConfig) {
  const parts: string[] = []

  // Draw style
  if (cfg.draw.infoAversion >= 8) parts.push('Solo mazo')
  else if (cfg.draw.improvementThreshold <= 1) parts.push('Robo agresivo')
  else parts.push('Robo selectivo')

  // Discard style
  if (cfg.discard.evalScope === 'full') parts.push('Desc. exhaustivo')
  else if (cfg.discard.rankBias >= 5) parts.push('Desc. por rango')
  else if (cfg.discard.potentialBias >= 6) parts.push('Desc. constructor')
  else parts.push('Desc. por valor')

  // Cut style
  if (cfg.cut.useScoreRules) parts.push('Corte adaptativo')
  else parts.push(`Corte ≤${cfg.cut.baseResto}`)

  if (cfg.cut.chinchonPursuit >= 4) parts.push(`🎯chinchón(${cfg.cut.chinchonThreshold})`)
  if (cfg.cut.minus10Pursuit >= 4) parts.push('🎯-10')
  if (cfg.cut.desperationMode >= 5) parts.push('🔥desesperación')
  if (cfg.cut.leadProtection >= 5) parts.push('🛡️protección')
  if (cfg.global.mistakeRate > 0) parts.push('🧪debug')

  return parts.join(' · ')
}

// ── Build runtime from config ──────────────────────────────────

export function buildBotFromConfig(cfg: BotConfig): BotRuntime {
  const colorSet = CUSTOM_COLORS[(cfg.colorIdx ?? 0) % CUSTOM_COLORS.length]

  return {
    id: cfg.id,
    name: cfg.name,
    emoji: cfg.emoji,
    color: cfg.color ?? colorSet.color,
    text: cfg.text ?? colorSet.text,
    bg: cfg.bg ?? colorSet.bg,
    border: cfg.border ?? colorSet.border,
    desc: generateDesc(cfg),
    description: cfg.description ?? '',
    custom: !cfg.color,
    shouldDraw: buildShouldDraw(cfg),
    canCut: buildCanCut(cfg),
    pickDiscard: buildPickDiscard(cfg),
  }
}

export function buildCustomBot(cfg: BotConfig) {
  return buildBotFromConfig(cfg)
}

export function cloneBotConfig<T>(value: T): T {
  return structuredClone(value)
}

// ── v1 → v2 migration ─────────────────────────────────────────

export function isV1Config(raw: unknown): raw is BotConfigV1 {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return r.draw != null && typeof r.draw === 'object' && 'mode' in (r.draw as object)
}

export function migrateV1toV2(v1: BotConfigV1): BotConfig {
  // Draw migration
  let improvementThreshold = 3
  let infoAversion = 0
  if (v1.draw.mode === 'always_deck') {
    infoAversion = 10
    improvementThreshold = 5
  } else if (v1.draw.mode === 'aggressive') {
    improvementThreshold = 0
  } else {
    improvementThreshold = v1.draw.restoThreshold ?? 3
  }

  // Discard migration
  let evalScope: 'fast' | 'full' = 'fast'
  let restoBias = 8
  let potentialBias = 0
  let rankBias = 0
  if (v1.discard.mode === 'optimal') {
    evalScope = 'full'
    potentialBias = 2
  } else if (v1.discard.mode === 'high_rank') {
    restoBias = 2
    rankBias = 8
  }

  // Cut migration
  let chinchonPursuit = 0
  let chinchonThreshold: 4 | 5 | 6 = v1.cut.chinchonThreshold as 4 | 5 | 6 ?? 6
  let minus10Pursuit = 0
  if (v1.cut.pursueChinchon) chinchonPursuit = 8
  if (v1.cut.chinchonRunMode) {
    chinchonPursuit = Math.max(chinchonPursuit, 6)
    chinchonThreshold = 4
  }
  if (v1.cut.maxFree === 0 && v1.cut.baseResto === 0) minus10Pursuit = 10

  return {
    id: v1.id,
    name: v1.name,
    emoji: v1.emoji,
    colorIdx: v1.colorIdx,
    color: v1.color,
    text: v1.text,
    bg: v1.bg,
    border: v1.border,
    description: v1.description,
    global: { temperature: 1, mistakeRate: 0 },
    draw: {
      improvementThreshold,
      structuralPriority: 5,
      infoAversion,
      chinchonBias: 0,
      tempoPreference: 5,
    },
    discard: {
      evalScope,
      restoBias,
      potentialBias,
      rankBias,
      jokerProtection: 5,
    },
    cut: {
      maxFree: v1.cut.maxFree,
      baseResto: v1.cut.baseResto,
      useScoreRules: v1.cut.useScoreRules,
      scoreRules: v1.cut.scoreRules,
      chinchonPursuit,
      chinchonThreshold,
      minus10Pursuit,
      deckUrgency: 3,
      leadProtection: 3,
      desperationMode: 3,
    },
  }
}


// ── Sanitize import ────────────────────────────────────────────

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number') return fallback
  return Math.min(Math.max(min, Math.floor(val)), max)
}

export function sanitizeImportConfig(raw: unknown): BotConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, any>
  if (typeof r.name !== 'string' || !r.name.trim()) return null

  // Detect v1 and migrate
  if (isV1Config(raw)) {
    const v1Draw = r.draw ?? {}
    const v1Discard = r.discard ?? {}
    const v1Cut = r.cut ?? {}
    if (!['always_deck', 'smart', 'aggressive'].includes(v1Draw.mode)) return null
    if (!['default', 'high_rank', 'optimal'].includes(v1Discard.mode)) return null

    const v1: BotConfigV1 = {
      id: `custom-${Date.now()}`,
      name: String(r.name).slice(0, 12).trim(),
      emoji: CUSTOM_EMOJIS.includes(String(r.emoji) as (typeof CUSTOM_EMOJIS)[number]) ? String(r.emoji) : '🧪',
      colorIdx: clampInt(r.colorIdx, 0, CUSTOM_COLORS.length - 1, 0),
      description: typeof r.description === 'string' ? String(r.description).slice(0, 120) : '',
      draw: { mode: v1Draw.mode, restoThreshold: clampInt(v1Draw.restoThreshold, 1, 10, 3) },
      discard: { mode: v1Discard.mode },
      cut: {
        maxFree: clampInt(v1Cut.maxFree, 0, 1, 1) as 0 | 1,
        baseResto: clampInt(v1Cut.baseResto, 0, 5, 5),
        useScoreRules: Boolean(v1Cut.useScoreRules),
        scoreRules: Array.isArray(v1Cut.scoreRules)
          ? defaultScoreRules().map((rule, i) => ({
              minScore: rule.minScore,
              maxResto: clampInt(v1Cut.scoreRules[i]?.maxResto, 0, 5, rule.maxResto),
            }))
          : defaultScoreRules(),
        pursueChinchon: Boolean(v1Cut.pursueChinchon),
        chinchonThreshold: [5, 6].includes(v1Cut.chinchonThreshold) ? v1Cut.chinchonThreshold : 6,
        chinchonRunMode: Boolean(v1Cut.chinchonRunMode),
      },
    }
    return migrateV1toV2(v1)
  }

  // v2 config
  const g = r.global ?? {}
  const d = r.draw ?? {}
  const disc = r.discard ?? {}
  const c = r.cut ?? {}

  return {
    id: `custom-${Date.now()}`,
    name: String(r.name).slice(0, 12).trim(),
    emoji: CUSTOM_EMOJIS.includes(String(r.emoji) as (typeof CUSTOM_EMOJIS)[number]) ? String(r.emoji) : '🧪',
    colorIdx: clampInt(r.colorIdx, 0, CUSTOM_COLORS.length - 1, 0),
    description: typeof r.description === 'string' ? String(r.description).slice(0, 120) : '',
    global: {
      temperature: clampInt(g.temperature, 0, 10, 2),
      mistakeRate: clampInt(g.mistakeRate, 0, 10, 0),
    },
    draw: {
      improvementThreshold: clampInt(d.improvementThreshold, 0, 10, 3),
      structuralPriority: clampInt(d.structuralPriority, 0, 10, 5),
      infoAversion: clampInt(d.infoAversion, 0, 10, 0),
      chinchonBias: clampInt(d.chinchonBias, 0, 10, 0),
      tempoPreference: clampInt(d.tempoPreference, 0, 10, 5),
    },
    discard: {
      evalScope: disc.evalScope === 'full' ? 'full' : 'fast',
      restoBias: clampInt(disc.restoBias, 0, 10, 8),
      potentialBias: clampInt(disc.potentialBias, 0, 10, 3),
      rankBias: clampInt(disc.rankBias, 0, 10, 0),
      jokerProtection: clampInt(disc.jokerProtection, 0, 10, 5),
    },
    cut: {
      maxFree: clampInt(c.maxFree, 0, 1, 1) as 0 | 1,
      baseResto: clampInt(c.baseResto, 0, 5, 5),
      useScoreRules: Boolean(c.useScoreRules),
      scoreRules: Array.isArray(c.scoreRules)
        ? defaultScoreRules().map((rule, i) => ({
            minScore: rule.minScore,
            maxResto: clampInt(c.scoreRules[i]?.maxResto, 0, 5, rule.maxResto),
          }))
        : defaultScoreRules(),
      chinchonPursuit: clampInt(c.chinchonPursuit, 0, 10, 0),
      chinchonThreshold: [4, 5, 6].includes(c.chinchonThreshold) ? c.chinchonThreshold : 6,
      minus10Pursuit: clampInt(c.minus10Pursuit, 0, 10, 0),
      deckUrgency: clampInt(c.deckUrgency, 0, 10, 3),
      leadProtection: clampInt(c.leadProtection, 0, 10, 3),
      desperationMode: clampInt(c.desperationMode, 0, 10, 3),
    },
  }
}

// ── Persistence ────────────────────────────────────────────────

export function loadCustomConfigs(): BotConfig[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem('chinchon-lab-custom-bots')
      ?? localStorage.getItem('chinchon-arena-custom-bots')
      ?? '[]'
    const configs = JSON.parse(raw)
    if (!Array.isArray(configs)) return []

    return configs.slice(0, MAX_CUSTOM_BOTS).map((cfg: any) => {
      // Auto-migrate v1 configs from storage
      if (isV1Config(cfg)) return migrateV1toV2(cfg as BotConfigV1)
      return {
        ...cfg,
        global: cfg.global ?? { temperature: 1, mistakeRate: 0 },
        cut: {
          ...cfg.cut,
          baseResto: Math.min(cfg.cut?.baseResto ?? 5, 5),
          scoreRules: (cfg.cut?.scoreRules ?? defaultScoreRules()).map((rule: ScoreRule) => ({
            ...rule,
            maxResto: Math.min(rule.maxResto ?? 5, 5),
          })),
        },
      }
    })
  } catch {
    return []
  }
}

export function saveCustomConfigs(configs: BotConfig[]) {
  if (typeof localStorage === 'undefined') return
  const safeConfigs = configs.slice(0, MAX_CUSTOM_BOTS)
  const payload = JSON.stringify(safeConfigs)
  localStorage.setItem('chinchon-lab-custom-bots', payload)
  localStorage.setItem('chinchon-arena-custom-bots', payload)
}


// ── Built-in presets (v2) ──────────────────────────────────────

export const BUILTIN_BOT_CONFIGS: BotConfig[] = [
  {
    id: 'facutron',
    name: 'FacuTron',
    emoji: '🤖',
    color: '#34d399',
    text: 'text-emerald-400',
    bg: 'bg-emerald-950',
    border: 'border-emerald-800',
    description: 'Bot equilibrado. Corta en cuanto tiene la mano razonablemente limpia, sin buscar chinchón ni esperar demasiado.',
    global: { temperature: 1, mistakeRate: 0 },
    draw: { improvementThreshold: 3, structuralPriority: 5, infoAversion: 0, chinchonBias: 0, tempoPreference: 5 },
    discard: { evalScope: 'fast', restoBias: 8, potentialBias: 2, rankBias: 0, jokerProtection: 5 },
    cut: { maxFree: 1, baseResto: 5, useScoreRules: false, scoreRules: defaultScoreRules(), chinchonPursuit: 0, chinchonThreshold: 6, minus10Pursuit: 0, deckUrgency: 3, leadProtection: 3, desperationMode: 2 },
  },
  {
    id: 'daibot',
    name: 'DaiBot',
    emoji: '🎀',
    color: '#f472b6',
    text: 'text-pink-400',
    bg: 'bg-pink-950',
    border: 'border-pink-800',
    description: 'Muy paciente. Solo corta cuando todas sus cartas están en melds, apuntando al -10 o al chinchón. Puede tardar muchas rondas.',
    global: { temperature: 1, mistakeRate: 0 },
    draw: { improvementThreshold: 3, structuralPriority: 7, infoAversion: 2, chinchonBias: 3, tempoPreference: 1 },
    discard: { evalScope: 'fast', restoBias: 7, potentialBias: 5, rankBias: 0, jokerProtection: 8 },
    cut: { maxFree: 0, baseResto: 0, useScoreRules: false, scoreRules: defaultScoreRules(), chinchonPursuit: 3, chinchonThreshold: 6, minus10Pursuit: 10, deckUrgency: 1, leadProtection: 1, desperationMode: 1 },
  },
  {
    id: 'candelaria',
    name: 'Candelar-IA',
    emoji: '🔮',
    color: '#38bdf8',
    text: 'text-sky-400',
    bg: 'bg-sky-950',
    border: 'border-sky-800',
    description: 'Cambia de estrategia según el marcador: antes de los 50 puntos exige la mano perfecta, después afloja un poco y acepta hasta 3 de resto.',
    global: { temperature: 1, mistakeRate: 0 },
    draw: { improvementThreshold: 3, structuralPriority: 5, infoAversion: 1, chinchonBias: 0, tempoPreference: 4 },
    discard: { evalScope: 'fast', restoBias: 8, potentialBias: 3, rankBias: 0, jokerProtection: 5 },
    cut: {
      maxFree: 1, baseResto: 3, useScoreRules: true,
      scoreRules: [
        { minScore: 0, maxResto: 0 },
        { minScore: 25, maxResto: 0 },
        { minScore: 50, maxResto: 3 },
        { minScore: 75, maxResto: 3 },
      ],
      chinchonPursuit: 0, chinchonThreshold: 6, minus10Pursuit: 3, deckUrgency: 4, leadProtection: 5, desperationMode: 4,
    },
  },
  {
    id: 'tai',
    name: 'T.A.I',
    emoji: '🔴',
    color: '#f87171',
    text: 'text-red-400',
    bg: 'bg-red-950',
    border: 'border-red-800',
    description: 'Agresiva en el descarte: prioriza soltar cartas de rango alto. Corta apenas tiene el resto bajo, sin esperar la perfección.',
    global: { temperature: 1, mistakeRate: 0 },
    draw: { improvementThreshold: 3, structuralPriority: 4, infoAversion: 0, chinchonBias: 0, tempoPreference: 7 },
    discard: { evalScope: 'fast', restoBias: 3, potentialBias: 1, rankBias: 7, jokerProtection: 4 },
    cut: { maxFree: 1, baseResto: 3, useScoreRules: false, scoreRules: defaultScoreRules(), chinchonPursuit: 0, chinchonThreshold: 6, minus10Pursuit: 0, deckUrgency: 5, leadProtection: 4, desperationMode: 2 },
  },
  {
    id: 'martinmatic',
    name: 'MartinMatic',
    emoji: '⚙️',
    color: '#9ca3af',
    text: 'text-gray-400',
    bg: 'bg-gray-900',
    border: 'border-gray-700',
    description: 'Juega agresivo en general, pero si arma una corrida de 4+ cartas del mismo palo cambia de modo y espera para hacer chinchón.',
    global: { temperature: 1, mistakeRate: 0 },
    draw: { improvementThreshold: 3, structuralPriority: 5, infoAversion: 0, chinchonBias: 4, tempoPreference: 5 },
    discard: { evalScope: 'fast', restoBias: 8, potentialBias: 4, rankBias: 0, jokerProtection: 5 },
    cut: { maxFree: 1, baseResto: 5, useScoreRules: false, scoreRules: defaultScoreRules(), chinchonPursuit: 6, chinchonThreshold: 4, minus10Pursuit: 0, deckUrgency: 3, leadProtection: 3, desperationMode: 3 },
  },
  {
    id: 'angrydai',
    name: 'Angry DaiBot',
    emoji: '😈',
    color: '#a78bfa',
    text: 'text-violet-400',
    bg: 'bg-violet-950',
    border: 'border-violet-800',
    description: 'La IA más compleja: descarte exhaustivo, umbrales de corte que cambian con el puntaje y caza el chinchón cuando está cerca.',
    global: { temperature: 2, mistakeRate: 0 },
    draw: { improvementThreshold: 0, structuralPriority: 7, infoAversion: 0, chinchonBias: 4, tempoPreference: 3 },
    discard: { evalScope: 'full', restoBias: 7, potentialBias: 5, rankBias: 0, jokerProtection: 7 },
    cut: {
      maxFree: 1, baseResto: 2, useScoreRules: true,
      scoreRules: [
        { minScore: 0, maxResto: 2 },
        { minScore: 25, maxResto: 2 },
        { minScore: 50, maxResto: 3 },
        { minScore: 75, maxResto: 1 },
      ],
      chinchonPursuit: 7, chinchonThreshold: 6, minus10Pursuit: 4, deckUrgency: 5, leadProtection: 5, desperationMode: 6,
    },
  },
]

export const BUILTIN_BOTS = BUILTIN_BOT_CONFIGS.map(buildBotFromConfig)

export function createBotCatalog(customConfigs: BotConfig[]) {
  return [...BUILTIN_BOTS, ...customConfigs.map(buildCustomBot)]
}

export function getBotConfig(idx: number, customConfigs: BotConfig[]) {
  if (idx < BUILTIN_BOT_CONFIGS.length) return BUILTIN_BOT_CONFIGS[idx]
  return customConfigs[idx - BUILTIN_BOT_CONFIGS.length] ?? BUILTIN_BOT_CONFIGS[0]
}
