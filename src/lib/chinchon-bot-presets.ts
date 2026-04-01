import {
  RANK_ORDER,
  cardRest,
  findBestMelds,
  isJoker,
} from './chinchon-bot-game'

export type DrawMode = 'always_deck' | 'smart' | 'aggressive'
export type DiscardMode = 'default' | 'high_rank' | 'optimal'

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
  draw: {
    mode: DrawMode
    restoThreshold?: number
  }
  discard: {
    mode: DiscardMode
  }
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
  drawConfig: BotConfig['draw']
  canCut: (m7: { minFree: number; resto: number }, score: number, hand: { suit: number; rank: number }[]) => boolean
  pickDiscard: (hand8: { suit: number; rank: number }[]) => number
}

// Built-in bot emojis are reserved and excluded from custom selection
export const CUSTOM_EMOJIS = [
  '🧪', '⚡', '🎲', '💎', '🦾', '🧠', '🔥', '🤡',
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
    draw: { mode: 'smart', restoThreshold: 3 },
    discard: { mode: 'default' },
    cut: {
      maxFree: 1,
      baseResto: 5,
      useScoreRules: false,
      scoreRules: defaultScoreRules(),
      pursueChinchon: false,
      chinchonThreshold: 6,
      chinchonRunMode: false,
    },
  }
}

function nearChinchonCustom(hand: { suit: number; rank: number }[], threshold: number) {
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

function has4RunSameSuit(hand: { suit: number; rank: number }[]) {
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

function defaultDiscard(hand8: { suit: number; rank: number }[]) {
  const analysis = findBestMelds(hand8)
  const inMeld = new Set(analysis.meldsCut.flat())
  let bestIdx = -1
  let bestScore = -1

  hand8.forEach((card, index) => {
    if (!isJoker(card) && !inMeld.has(index) && cardRest(card) > bestScore) {
      bestScore = cardRest(card)
      bestIdx = index
    }
  })

  return bestIdx === -1 ? hand8.length - 1 : bestIdx
}

function taiDiscard(hand8: { suit: number; rank: number }[]) {
  const analysis = findBestMelds(hand8)
  const inMeld = new Set(analysis.melds.flat())
  let bestIdx = -1
  let bestRank = -1

  hand8.forEach((card, index) => {
    if (!isJoker(card) && !inMeld.has(index) && card.rank > bestRank) {
      bestRank = card.rank
      bestIdx = index
    }
  })

  if (bestIdx === -1) {
    let highestIdx = -1
    let highestRank = -1
    hand8.forEach((card, index) => {
      if (!isJoker(card) && card.rank > highestRank) {
        highestRank = card.rank
        highestIdx = index
      }
    })
    return highestIdx
  }

  return bestIdx
}

function angryDiscard(hand8: { suit: number; rank: number }[]) {
  let bestIdx = 0
  let bestResto = Number.POSITIVE_INFINITY
  let bestFree = Number.POSITIVE_INFINITY

  for (let i = 0; i < hand8.length; i++) {
    if (isJoker(hand8[i])) continue
    const testHand = hand8.filter((_, idx) => idx !== i)
    const analysis = findBestMelds(testHand)
    if (analysis.minFree < bestFree || (analysis.minFree === bestFree && analysis.resto < bestResto)) {
      bestIdx = i
      bestResto = analysis.resto
      bestFree = analysis.minFree
    }
  }

  return bestIdx
}

function buildCanCut(cut: BotConfig['cut']) {
  return (m7: { minFree: number; resto: number }, score: number, hand: { suit: number; rank: number }[]) => {
    if (cut.pursueChinchon && nearChinchonCustom(hand, cut.chinchonThreshold ?? 6)) return m7.minFree === 0
    if (cut.chinchonRunMode && has4RunSameSuit(hand)) return m7.minFree === 0

    const maxResto = cut.useScoreRules
      ? [...cut.scoreRules].reverse().find(rule => (score ?? 0) >= rule.minScore)?.maxResto ?? cut.baseResto
      : cut.baseResto

    return m7.minFree <= cut.maxFree && m7.resto <= Math.min(maxResto, 5)
  }
}

export function generateDesc(cfg: BotConfig) {
  const parts: string[] = []
  const drawModes: Record<DrawMode, string> = {
    always_deck: 'Solo mazo',
    smart: 'Robo inteligente',
    aggressive: 'Robo agresivo',
  }
  const discardModes: Record<DiscardMode, string> = {
    default: 'Desc. por valor',
    high_rank: 'Desc. por rango',
    optimal: 'Desc. óptimo',
  }

  parts.push(drawModes[cfg.draw.mode] ?? 'Robo inteligente')
  parts.push(discardModes[cfg.discard.mode] ?? 'Desc. por valor')

  if (cfg.cut.useScoreRules) parts.push('Corte adaptativo')
  else parts.push(`Corte ≤${cfg.cut.baseResto}`)

  if (cfg.cut.chinchonRunMode) parts.push('🏃corrida')
  if (cfg.cut.pursueChinchon) parts.push(`🎯chinchón(${cfg.cut.chinchonThreshold ?? 6})`)

  return parts.join(' · ')
}

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
    drawConfig: cfg.draw,
    canCut: buildCanCut(cfg.cut),
    pickDiscard:
      cfg.discard.mode === 'high_rank'
        ? taiDiscard
        : cfg.discard.mode === 'optimal'
          ? angryDiscard
          : defaultDiscard,
  }
}

export function buildCustomBot(cfg: BotConfig) {
  return buildBotFromConfig(cfg)
}

export function cloneBotConfig<T>(value: T): T {
  return structuredClone(value)
}

export function sanitizeImportConfig(raw: unknown): BotConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (typeof (raw as Record<string, unknown>).name !== 'string' || !(raw as Record<string, string>).name.trim()) return null

  const draw = (raw as Record<string, any>).draw ?? {}
  const discard = (raw as Record<string, any>).discard ?? {}
  const cut = (raw as Record<string, any>).cut ?? {}

  if (!['always_deck', 'smart', 'aggressive'].includes(draw.mode)) return null
  if (!['default', 'high_rank', 'optimal'].includes(discard.mode)) return null

  return {
    id: `custom-${Date.now()}`,
    name: String((raw as Record<string, any>).name).slice(0, 12).trim(),
    emoji: CUSTOM_EMOJIS.includes(String((raw as Record<string, any>).emoji) as (typeof CUSTOM_EMOJIS)[number]) ? String((raw as Record<string, any>).emoji) : '🧪',
    colorIdx:
      typeof (raw as Record<string, any>).colorIdx === 'number'
        ? Math.min(Math.max(0, Math.floor((raw as Record<string, any>).colorIdx)), CUSTOM_COLORS.length - 1)
        : 0,
    description:
      typeof (raw as Record<string, any>).description === 'string'
        ? String((raw as Record<string, any>).description).slice(0, 120)
        : '',
    draw: {
      mode: draw.mode,
      restoThreshold:
        typeof draw.restoThreshold === 'number'
          ? Math.min(Math.max(1, Math.floor(draw.restoThreshold)), 10)
          : 3,
    },
    discard: {
      mode: discard.mode,
    },
    cut: {
      maxFree:
        typeof cut.maxFree === 'number'
          ? (Math.min(Math.max(0, Math.floor(cut.maxFree)), 1) as 0 | 1)
          : 1,
      baseResto: Math.min(Math.max(0, Math.floor(cut.baseResto ?? 5)), 5),
      useScoreRules: Boolean(cut.useScoreRules),
      scoreRules: Array.isArray(cut.scoreRules)
        ? defaultScoreRules().map((rule, index) => ({
            minScore: rule.minScore,
            maxResto: Math.min(Math.max(0, Math.floor(cut.scoreRules[index]?.maxResto ?? rule.maxResto)), 5),
          }))
        : defaultScoreRules(),
      pursueChinchon: Boolean(cut.pursueChinchon),
      chinchonThreshold: [5, 6].includes(cut.chinchonThreshold) ? cut.chinchonThreshold : 6,
      chinchonRunMode: Boolean(cut.chinchonRunMode),
    },
  }
}

export function loadCustomConfigs(): BotConfig[] {
  if (typeof localStorage === 'undefined') return []

  try {
    const configs = JSON.parse(
      localStorage.getItem('chinchon-lab-custom-bots')
      ?? localStorage.getItem('chinchon-arena-custom-bots')
      ?? '[]',
    )

    if (!Array.isArray(configs)) return []

    return configs.slice(0, MAX_CUSTOM_BOTS).map((cfg: BotConfig) => ({
      ...cfg,
      cut: {
        ...cfg.cut,
        baseResto: Math.min(cfg.cut?.baseResto ?? 5, 5),
        scoreRules: (cfg.cut?.scoreRules ?? []).map(rule => ({
          ...rule,
          maxResto: Math.min(rule.maxResto ?? 5, 5),
        })),
      },
    }))
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
    draw: { mode: 'smart', restoThreshold: 3 },
    discard: { mode: 'default' },
    cut: { maxFree: 1, baseResto: 5, useScoreRules: false, scoreRules: defaultScoreRules(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: false },
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
    draw: { mode: 'smart', restoThreshold: 3 },
    discard: { mode: 'default' },
    cut: { maxFree: 0, baseResto: 0, useScoreRules: false, scoreRules: defaultScoreRules(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: false },
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
    draw: { mode: 'smart', restoThreshold: 3 },
    discard: { mode: 'default' },
    cut: {
      maxFree: 1,
      baseResto: 3,
      useScoreRules: true,
      scoreRules: [
        { minScore: 0, maxResto: 0 },
        { minScore: 25, maxResto: 0 },
        { minScore: 50, maxResto: 3 },
        { minScore: 75, maxResto: 3 },
      ],
      pursueChinchon: false,
      chinchonThreshold: 6,
      chinchonRunMode: false,
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
    description: 'Agresiva en el descarte: siempre tira la carta con número más alto. Corta apenas tiene el resto bajo, sin esperar la perfección.',
    draw: { mode: 'smart', restoThreshold: 3 },
    discard: { mode: 'high_rank' },
    cut: { maxFree: 1, baseResto: 3, useScoreRules: false, scoreRules: defaultScoreRules(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: false },
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
    draw: { mode: 'smart', restoThreshold: 3 },
    discard: { mode: 'default' },
    cut: { maxFree: 1, baseResto: 5, useScoreRules: false, scoreRules: defaultScoreRules(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: true },
  },
  {
    id: 'angrydai',
    name: 'Angry DaiBot',
    emoji: '😈',
    color: '#a78bfa',
    text: 'text-violet-400',
    bg: 'bg-violet-950',
    border: 'border-violet-800',
    description: 'La IA más compleja: descarte óptimo calculado, umbrales de corte que cambian con el puntaje y caza el chinchón cuando está cerca.',
    draw: { mode: 'aggressive' },
    discard: { mode: 'optimal' },
    cut: {
      maxFree: 1,
      baseResto: 2,
      useScoreRules: true,
      scoreRules: [
        { minScore: 0, maxResto: 2 },
        { minScore: 25, maxResto: 2 },
        { minScore: 50, maxResto: 3 },
        { minScore: 75, maxResto: 1 },
      ],
      pursueChinchon: true,
      chinchonThreshold: 6,
      chinchonRunMode: false,
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
