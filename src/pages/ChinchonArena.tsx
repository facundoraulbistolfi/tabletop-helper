// @ts-nocheck
import { startTransition, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  SUITS, RANKS, RANK_ORDER, JOKER_REST,
  isJoker, cardRest, sameCard,
  createDeck, shuffle,
  findAllMelds, findBestMelds,
  checkChinchon,
  legalDiscardIndex, cutScore,
} from "../lib/chinchon-bot-game";
import {
  MIN_SIMULATIONS_BEFORE_STABLE_STOP,
  STABLE_SIMULATION_STREAK,
  getChinchonWinRate,
  getNextStableStreak,
  getTruncatedWinRates,
  getWinRates,
} from "../lib/chinchon-sim-metrics";
import {
  TOURNAMENT_FIXTURE,
  TOURNAMENT_FIXTURE_BY_FECHA,
  buildTournamentMatchSnapshot,
  buildTournamentCeremonyData,
  createEmptyTournamentResults,
  isValidTournamentResults,
} from "../lib/chinchon-tournament";
import { generateReplayPair } from "../lib/chinchon-arena-sim";
import { LabAccordionSection, LabPanel, LabTabBar, StickyActionBar } from "./chinchon-lab/Layout";
import ChinchonLabWorker from "../workers/chinchon-lab.worker?worker";
import {
  CUSTOM_EMOJIS as LIB_CUSTOM_EMOJIS,
  CUSTOM_COLORS as LIB_CUSTOM_COLORS,
  MAX_CUSTOM_BOTS as LIB_MAX_CUSTOM_BOTS,
  BUILTIN_BOT_CONFIGS as LIB_BUILTIN_BOT_CONFIGS,
  defaultScoreRules,
  createDefaultCustomConfig,
  buildBotFromConfig as libBuildBot,
  buildCustomBot as libBuildCustomBot,
  generateDesc as libGenerateDesc,
  sanitizeImportConfig as libSanitizeImport,
  loadCustomConfigs as libLoadCustomConfigs,
  saveCustomConfigs as libSaveCustomConfigs,
  isV1Config,
  migrateV1toV2,
} from "../lib/chinchon-bot-presets";

const LAB_TABS = [
  { value: "sim", label: "🧪 Simulación", shortLabel: "🧪 Sim" },
  { value: "torneo", label: "🏆 Torneo", shortLabel: "🏆 Torneo" },
  { value: "match", label: "🎬 Ver Partida", shortLabel: "🎬 Partida" },
  { value: "play", label: "🃏 Jugar", shortLabel: "🃏 Jugar" },
  { value: "custom", label: "🤖 Bots", shortLabel: "🤖 Bots" },
  { value: "reglas", label: "📜 Reglas", shortLabel: "📜 Reglas" },
];
const SIMULATION_OPTIONS = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];
const QUICK_SIMULATION_OPTIONS = [100, 1000, 10000, 50000];

/* ==============================================================
CARD ENGINE (UI-only constants)
============================================================== */
const SUIT_ICON = ["🗡️", "🪵", "🍷", "🪙"];
const SUIT_COLOR = ["#60a5fa", "#22c55e", "#f87171", "#fbbf24"];
const RANK_LABEL = { 0: "🃏", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "11", 12: "12" };
const DRAW_MODE_LABELS = { always_deck: "Solo mazo", smart: "Robo inteligente", aggressive: "Robo agresivo" };
const DISCARD_MODE_LABELS = { default: "Descarta por valor", high_rank: "Descarta por rango", optimal: "Descarta óptimo" };
// v2 draw style labels
function getDrawStyleLabel(cfg) {
  if (cfg.draw.infoAversion >= 8) return "Solo mazo";
  if (cfg.draw.improvementThreshold <= 1) return "Robo agresivo";
  return "Robo selectivo";
}
function getDiscardStyleLabel(cfg) {
  if (cfg.discard.evalScope === "full") return "Desc. exhaustivo";
  if (cfg.discard.rankBias >= 5) return "Desc. por rango";
  if (cfg.discard.potentialBias >= 6) return "Desc. constructor";
  return "Desc. por valor";
}
const RULE_FACTS = [
  "50 cartas",
  "2 comodines",
  "7 cartas por jugador",
  "Corte: 1 suelta",
  "Resto <= 5",
  "100 puntos",
];
const RULE_SECTIONS = [
  {
    key: "mazo",
    emoji: "🃏",
    title: "Mazo",
    accent: "#fbbf24",
    summary: "El lab juega con la baraja española completa y dos comodines.",
    items: [
      "Se usan 50 cartas en total.",
      "Los 2 comodines siempre entran en el mazo.",
    ],
  },
  {
    key: "reparto",
    emoji: "🤝",
    title: "Reparto inicial",
    accent: "#22c55e",
    summary: "La ronda arranca asimétrica, como en chinchón tradicional.",
    items: [
      "Cada jugador recibe 7 cartas.",
      "El que empieza recibe una 8va carta y arranca descartando.",
    ],
  },
  {
    key: "turno",
    emoji: "🔄",
    title: "Turno",
    accent: "#38bdf8",
    summary: "Cada turno tiene una decisión de robo y una de descarte.",
    items: [
      "Podés robar del mazo o del descarte.",
      "Después tirás una carta.",
      "El comodín nunca se puede descartar.",
    ],
  },
  {
    key: "juegos",
    emoji: "🧩",
    title: "Juegos válidos",
    accent: "#a78bfa",
    summary: "Solo cuentan combinaciones cerradas de 3 o más cartas.",
    items: [
      "Escalera: cartas consecutivas del mismo palo.",
      "Grupo: cartas del mismo número.",
      "Cada juego válido necesita al menos 3 cartas.",
    ],
  },
  {
    key: "corte",
    emoji: "✂️",
    title: "Corte",
    accent: "#f97316",
    summary: "El corte está restringido para que la ronda no cierre demasiado fácil.",
    items: [
      "Podés quedar con como máximo 1 carta suelta.",
      "El resto de esa suelta no puede superar 5 puntos.",
      "No podés cortar tirando un comodín.",
    ],
  },
  {
    key: "comodines",
    emoji: "🤡",
    title: "Comodines",
    accent: "#e879f9",
    summary: "Son poderosos, pero tienen costo si no lográs cerrarlos.",
    items: [
      "Nunca se pueden tirar, ni para descartar ni para cortar.",
      "Si quedan sueltos fuera de melds, valen 50 puntos en contra.",
    ],
  },
  {
    key: "chinchon",
    emoji: "🏆",
    title: "Chinchón",
    accent: "#34d399",
    summary: "Es la condición más fuerte del juego y define muchísimas decisiones del lab.",
    items: [
      "Solo vale como chinchón si son 7 cartas consecutivas del mismo palo y sin comodines.",
      "Si se cumple, la partida se gana instantáneamente.",
      "Si la corrida usa comodín, vale -10 pero no gana automática.",
    ],
  },
  {
    key: "puntaje",
    emoji: "📈",
    title: "Puntaje y eliminación",
    accent: "#f87171",
    summary: "El objetivo final sigue siendo sobrevivir y cerrar mejor que el rival.",
    items: [
      "La partida se juega a 100 puntos.",
      "Al llegar a 100 o más, el jugador queda eliminado.",
    ],
  },
];

function getCutShortLabel(cfg) {
  if (cfg.cut.chinchonPursuit >= 4) return "Persigue chinch��n";
  if (cfg.cut.minus10Pursuit >= 7) return "Busca -10";
  if (cfg.cut.useScoreRules) return "Corte adaptativo";
  return `Corta <= ${cfg.cut.baseResto}`;
}

function getBotStrategyPills(cfg) {
  // v2 config (has global/draw.improvementThreshold)
  if (cfg.global) {
    return [
      getDrawStyleLabel(cfg),
      getDiscardStyleLabel(cfg),
      getCutShortLabel(cfg),
    ];
  }
  // v1 fallback
  return [
    DRAW_MODE_LABELS[cfg.draw?.mode] ?? "Robo",
    DISCARD_MODE_LABELS[cfg.discard?.mode] ?? "Descarte",
    getCutShortLabel(cfg),
  ];
}

function getBotPalette(cfg) {
  const palette = cfg.color
    ? { color: cfg.color }
    : CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length];
  return {
    color: palette.color,
    soft: `${palette.color}1a`,
    border: `${palette.color}66`,
  };
}

function getBotCardCopy(cfg, showDescMode) {
  if (showDescMode === "config") return generateDesc(cfg);
  if (cfg.description?.trim()) return cfg.description.trim();
  return generateDesc(cfg);
}

/* -- nearChinchon with configurable threshold (for custom bots) -- */
function nearChinchonCustom(hand, threshold) {
const jokers = hand.filter(isJoker).length;
const bySuit = {};
hand.forEach(c => { if (!isJoker(c)) (bySuit[c.suit] ??= []).push(RANK_ORDER[c.rank]); });
for (const orders of Object.values(bySuit)) {
orders.sort((a, b) => a - b);
for (let start = 0; start <= 5; start++) {
let present = 0;
for (let p = start; p <= start + 6; p++) { if (orders.includes(p)) present++; }
if (present + jokers >= threshold) return true;
}
}
return false;
}

/* -- Check if hand has 4+ consecutive same suit (for MartinMatic) -- */
function has4RunSameSuit(hand) {
const bySuit = {};
hand.forEach(c => { if (!isJoker(c)) (bySuit[c.suit] ??= []).push(RANK_ORDER[c.rank]); });
for (const orders of Object.values(bySuit)) {
if (orders.length < 4) continue;
orders.sort((a, b) => a - b);
let run = 1;
for (let i = 1; i < orders.length; i++) {
if (orders[i] === orders[i - 1] + 1) { run++; if (run >= 4) return true; } else run = 1;
}
}
return false;
}

/* ==============================================================
BOTS — delegates to src/lib/chinchon-bot-presets.ts (v2 schema)
============================================================== */
const CUSTOM_EMOJIS = LIB_CUSTOM_EMOJIS;
const CUSTOM_COLORS = LIB_CUSTOM_COLORS;
const MAX_CUSTOM_BOTS = LIB_MAX_CUSTOM_BOTS;
const BUILTIN_BOT_CONFIGS = LIB_BUILTIN_BOT_CONFIGS;
const DEFAULT_CUSTOM_CONFIG = createDefaultCustomConfig;
const DEFAULT_SCORE_RULES = defaultScoreRules;

function buildBotFromConfig(cfg) { return libBuildBot(cfg); }
function buildCustomBot(cfg) { return libBuildCustomBot(cfg); }
function generateDesc(cfg) { return libGenerateDesc(cfg); }
function sanitizeImportConfig(raw) { return libSanitizeImport(raw); }
function loadCustomConfigs() { return libLoadCustomConfigs(); }
function saveCustomConfigs(configs) { return libSaveCustomConfigs(configs); }

const BUILTIN_BOTS = BUILTIN_BOT_CONFIGS.map(buildBotFromConfig);

let BOT = [...BUILTIN_BOTS];
function syncBots(customConfigs) { BOT = [...BUILTIN_BOTS, ...customConfigs.map(buildCustomBot)]; }

/* ==============================================================
GAME ENGINE
============================================================== */
/* -- Play mode helpers -- */
function initRound(scores, dealer) {
const deck = shuffle(createDeck());
const firstTurn = dealer === 0 ? 1 : 0; // non-dealer goes first
const pHand = deck.splice(0, 7), bHand = deck.splice(0, 7);
// Non-dealer (starter) gets 8 cards — they discard first, no draw on first turn
if (firstTurn === 0) pHand.push(deck.pop()); else bHand.push(deck.pop());
// Phase: if player starts → playerDiscard (skip draw); if bot starts → botTurn (handles 8-card discard)
const phase = firstTurn === 0 ? "playerDiscard" : "botTurn";
return { phase, deck, discardPile: [], pHand, bHand, scores: [...scores], dealer, turn: firstTurn, selectedIdx: null, roundResult: null, message: null, drawnCard: null, botLastAction: null, cutMode: false };
}
function botTakeTurn(g, botObj) {
const hand = [...g.bHand.map(c => ({ ...c }))], deck = [...g.deck], dp = [...g.discardPile];
const ctx = { myScore: g.scores[1], oppScore: g.scores[0], deckRemaining: deck.length, oppKeptFromDeck: 0, oppKeptFromDiscard: 0 };
// Initial turn: bot has 8 cards, only discards (no draw)
if (hand.length === 8) {
  const wi = legalDiscardIndex(hand, botObj.pickDiscard(hand, ctx)); const disc = hand.splice(wi, 1)[0]; dp.push(disc);
  const m7 = findBestMelds(hand);
  if (botObj.canCut(m7, hand, ctx)) {
    const cs = cutScore(hand); const pM = findBestMelds(g.pHand);
    return { ...g, bHand: hand, deck, discardPile: dp, phase: "roundEnd", drawnCard: null, botDiscard: disc,
      botLastAction: { drew: "initial", discarded: disc },
      roundResult: { cutter: "bot", bScore: cs.score, pScore: pM.resto, bMelds: m7, pMelds: pM, chinchon: cs.chinchon } };
  }
  return { ...g, bHand: hand, deck, discardPile: dp, phase: "playerDraw", turn: 0, drawnCard: null, botDiscard: disc, message: null, botLastAction: { drew: "initial", discarded: disc } };
}
const top = dp.length ? dp[dp.length - 1] : null;
let drawDisc = false;
if (top && deck.length) {
  drawDisc = botObj.shouldDraw(hand, top, ctx);
}
let drawn;
if (drawDisc && dp.length) drawn = dp.pop(); else if (deck.length) drawn = deck.pop();
else return { ...g, phase: "roundEnd", roundResult: { reason: "empty" } };
hand.push(drawn);
const ctxAfterDraw = { ...ctx, deckRemaining: deck.length };
const wi = legalDiscardIndex(hand, botObj.pickDiscard(hand, ctxAfterDraw)); const disc = hand.splice(wi, 1)[0]; dp.push(disc);
const m7 = findBestMelds(hand);
if (botObj.canCut(m7, hand, ctxAfterDraw)) {
const cs = cutScore(hand); const pM = findBestMelds(g.pHand);
return { ...g, bHand: hand, deck, discardPile: dp, phase: "roundEnd", drawnCard: drawn, botDiscard: disc,
botLastAction: { drew: drawDisc ? "discard" : "deck", discarded: disc },
roundResult: { cutter: "bot", bScore: cs.score, pScore: pM.resto, bMelds: m7, pMelds: pM, chinchon: cs.chinchon } };
}
return { ...g, bHand: hand, deck, discardPile: dp, phase: "playerDraw", turn: 0, drawnCard: drawn, botDiscard: disc, message: null, botLastAction: { drew: drawDisc ? "discard" : "deck", discarded: disc } };
}

/* ==============================================================
UI COMPONENTS
============================================================== */
function cardLabel(c) { return isJoker(c) ? "🃏" : `${RANK_LABEL[c.rank]}${SUIT_ICON[c.suit]}`; }
function CardC({ card, inMeld, highlight, small, onClick, selected, faceDown }) {
const sizeClass = small ? "ch-card--small" : "";
const cardClasses = [
  "ch-card",
  sizeClass,
  onClick ? "ch-card--interactive" : "",
  selected ? "ch-card--selected" : "",
].filter(Boolean).join(" ");
if (faceDown) return (
<div className={`${cardClasses} ch-card--back`.trim()} onClick={onClick} aria-label="Carta boca abajo">
  <div className="ch-card__back-pattern" aria-hidden="true" />
  <div className="ch-card__back-center" aria-hidden="true">
    <span className="ch-card__back-glyph">✦</span>
    <span className="ch-card__back-mark">CL</span>
    <span className="ch-card__back-glyph">✦</span>
  </div>
</div>
);
const j = isJoker(card);
const color = j ? "#e879f9" : SUIT_COLOR[card.suit];
const accentClasses = [
  cardClasses,
  highlight === "drawn" ? "ch-card--drawn" : "",
  highlight === "discarded" ? "ch-card--discarded" : "",
  j ? "ch-card--joker" : "",
  !j && inMeld ? "ch-card--meld" : "",
].filter(Boolean).join(" ");
const rank = j ? "J" : RANK_LABEL[card.rank];
const suit = j ? "★" : SUIT_ICON[card.suit];
const centerIcon = j ? "🤡" : suit;
const label = cardLabel(card);
const topBladeClass = !j && card.suit === 0 ? " ch-card__icon--blade" : "";
const bottomBladeClass = !j && card.suit === 0 ? " ch-card__icon--blade-bottom" : "";
const cardStyle = j ? { "--card-accent": color } : {
  "--card-accent": color,
  "--card-tint": `${color}20`,
  "--card-border": `${color}4f`,
  "--card-inner-border": `${color}24`,
};
return (
<div
className={accentClasses}
style={cardStyle}
onClick={onClick}
title={label}
aria-label={label}
>
<span className="ch-card__corner">
  <span className="ch-card__rank">{rank}</span>
  <span className={`ch-card__suit${topBladeClass}`}>{suit}</span>
</span>
<span className={`ch-card__center${topBladeClass}`} aria-hidden="true">{centerIcon}</span>
<span className="ch-card__corner ch-card__corner--bottom" aria-hidden="true">
  <span className="ch-card__rank">{rank}</span>
  <span className={`ch-card__suit${bottomBladeClass}`}>{suit}</span>
</span>
</div>
);
}

function CardPlaceholder({ small, active, label = "∅" }) {
const sizeClass = small ? "ch-card--small" : "";
const classes = [
  "ch-card",
  sizeClass,
  "ch-card--empty",
  active ? "ch-card--selected" : "",
].filter(Boolean).join(" ");
return (
<div className={classes} aria-label="Pila vacía">
  <span className="ch-card__empty-mark" aria-hidden="true">{label}</span>
</div>
);
}

function HandRow({ hand, meldsData, drawnCard, label, color, bgClass, borderClass, onClick, selectedIdx, faceDown }) {
const meldIdx = new Set((meldsData?.meldsCut || meldsData?.melds || []).flat());
return (
<div className={`rounded-lg p-3 ${bgClass} border ${borderClass}`}>
<div className="flex items-center justify-between mb-2">
<span className={`font-bold text-sm ${color}`}>{label}</span>
{!faceDown && <span className="text-xs text-gray-500">Sueltas: {meldsData?.minFree ?? "?"} · Resto: {meldsData?.resto ?? "?"}</span>}
</div>
<div className="flex flex-wrap gap-1">
{hand.map((c, i) => {
const isDraw = drawnCard && sameCard(c, drawnCard);
return (
<CardC key={`${c.rank}-${c.suit}-${i}`} card={c} inMeld={!faceDown && meldIdx.has(i)}
highlight={isDraw ? "drawn" : null} onClick={onClick ? () => onClick(i) : null} selected={selectedIdx === i} faceDown={faceDown} />
);
})}
</div>
</div>
);
}

function BotLineupPicker({ title, subtitle, labels, values, onChange, disabled }) {
const [activeSlot, setActiveSlot] = useState(0);

useEffect(() => {
if (activeSlot >= labels.length) setActiveSlot(0);
}, [activeSlot, labels.length]);

const assignBot = (botIdx) => {
if (disabled) return;
const existingSlot = values.indexOf(botIdx);
if (existingSlot >= 0) {
setActiveSlot(existingSlot);
return;
}
const next = [...values];
next[activeSlot] = botIdx;
onChange(next);
setActiveSlot((activeSlot + 1) % labels.length);
};

return (
<div className="lab-control-card">
  <div className="lab-control-card__header">
    <div>
      <div className="lab-control-card__eyebrow">Participantes</div>
      <h3>{title}</h3>
    </div>
    <p>{subtitle}</p>
  </div>
  <div className={`lab-slot-grid${labels.length > 2 ? " is-wide" : " is-duel"}`}>
    {labels.map((slotLabel, slotIdx) => {
      const bot = BOT[values[slotIdx]];
      const isActive = activeSlot === slotIdx;
      return (
        <button
          key={slotLabel}
          type="button"
          disabled={disabled}
          aria-pressed={isActive}
          className={`lab-slot-card${isActive ? " is-active" : ""}${labels.length === 2 ? " is-duel" : ""}`}
          style={{ borderColor: isActive ? `${bot.color}80` : undefined }}
          onClick={() => setActiveSlot(slotIdx)}
        >
          <span className="lab-slot-card__label">{slotLabel}</span>
          <span className="lab-slot-card__name" style={{ color: bot.color }}>{bot.emoji} {bot.name}</span>
          <span className="lab-slot-card__desc">{bot.desc}</span>
        </button>
      );
    })}
  </div>
  <div className="lab-pill-cloud" role="group" aria-label={title}>
    {BOT.map((bot, idx) => {
      const selectedSlot = values.indexOf(idx);
      const isSelected = selectedSlot >= 0;
      return (
        <button
          key={bot.id ?? idx}
          type="button"
          disabled={disabled}
          aria-pressed={isSelected}
          className={`lab-bot-pill${isSelected ? " is-selected" : ""}`}
          style={{
            borderColor: isSelected ? `${bot.color}aa` : undefined,
            color: isSelected ? bot.color : undefined,
            background: isSelected ? `${bot.color}1a` : undefined,
          }}
          onClick={() => assignBot(idx)}
        >
          <span>{bot.emoji} {bot.name}</span>
          {isSelected && <span className="lab-bot-pill__badge">{selectedSlot + 1}</span>}
        </button>
      );
    })}
  </div>
</div>
);
}

function SimulationCountPicker({
label,
value,
onChange,
disabled,
tone = "emerald",
useStabilized,
onUseStabilizedChange,
stabilizeDecimals,
onStabilizeDecimalsChange,
stabilizedCopy,
}) {
return (
<div className="lab-control-card">
  <div className="lab-control-card__header">
    <div>
      <div className="lab-control-card__eyebrow">Cantidad</div>
      <h3>{label}</h3>
    </div>
    <p>Presets rápidos arriba y selector completo abajo.</p>
  </div>
  <div className="lab-choice-grid" role="group" aria-label={label}>
    {QUICK_SIMULATION_OPTIONS.map((option) => {
      const active = value === option;
      return (
        <button
          key={option}
          type="button"
          disabled={disabled}
          aria-pressed={active}
          onClick={() => onChange(option)}
          className={`lab-choice-btn ${tone}${active ? " is-active" : ""}`}
        >
          {option >= 1000 ? `${option / 1000}k` : option}
        </button>
      );
    })}
  </div>
  <label className="lab-inline-field">
    <span>Otra escala</span>
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled}>
      {SIMULATION_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option.toLocaleString("es-AR")} simulaciones
        </option>
      ))}
    </select>
  </label>
  <div className="lab-toggle-card">
    <label className="lab-toggle-card__row">
      <span>
        <strong>Frenar antes si el winrate ya no cambia</strong>
        <small>{stabilizedCopy}</small>
      </span>
      <input
        type="checkbox"
        checked={useStabilized}
        onChange={(e) => onUseStabilizedChange(e.target.checked)}
        disabled={disabled}
      />
    </label>
    {useStabilized && (
      <label className="lab-inline-field lab-inline-field--stacked">
        <span>Precisión a comparar</span>
        <select
          value={stabilizeDecimals}
          onChange={(e) => onStabilizeDecimalsChange(Number(e.target.value))}
          disabled={disabled}
        >
          {[0, 1, 2, 3].map((digits) => (
            <option key={digits} value={digits}>
              {digits} {digits === 1 ? "decimal" : "decimales"}
            </option>
          ))}
        </select>
      </label>
    )}
  </div>
</div>
);
}

function buildChartData(f, d, n0, n1) {
const keys = new Set([...Object.keys(f), ...Object.keys(d)].map(Number));
return [...keys].sort((a, b) => a - b).map(k => ({ cartas: k, [n0]: f[k] || 0, [n1]: d[k] || 0 }));
}

function DrawsBarChart({ data, botA, botB }) {
const [hovered, setHovered] = useState<number | null>(null);
const maxValue = Math.max(1, ...data.map(d => Math.max(d[botA.name] || 0, d[botB.name] || 0)));
const hoveredData = hovered !== null ? data[hovered] : null;

return (
<div>
<div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
<div style={{ overflowX: "auto" }}>
<div className="flex items-end gap-1" style={{ height: "170px", minWidth: `${Math.max(320, data.length * 26)}px` }}>
{data.map((row, idx) => {
const aVal = row[botA.name] || 0;
const bVal = row[botB.name] || 0;
const aHeight = Math.max(3, Math.round((aVal / maxValue) * 120));
const bHeight = Math.max(3, Math.round((bVal / maxValue) * 120));
const isActive = hovered === idx;

return (
<div
key={row.cartas}
className="flex flex-col items-center justify-end"
style={{ flex: "1 0 24px", minWidth: "24px" }}
onMouseEnter={() => setHovered(idx)}
onMouseLeave={() => setHovered(null)}
>
<div className="flex items-end justify-center gap-0.5" style={{ height: "128px", width: "100%" }}>
<div
className="rounded"
style={{
height: `${aHeight}px`,
width: "8px",
background: botA.color,
opacity: isActive ? 1 : 0.85,
boxShadow: isActive ? `0 0 0 1px ${botA.color}` : "none",
}}
/>
<div
className="rounded"
style={{
height: `${bHeight}px`,
width: "8px",
background: botB.color,
opacity: isActive ? 1 : 0.85,
boxShadow: isActive ? `0 0 0 1px ${botB.color}` : "none",
}}
/>
</div>
<span className="text-xs text-gray-500 mt-1">{row.cartas}</span>
</div>
);
})}
</div>
</div>
</div>

<div className="flex justify-center gap-3 mt-2 text-xs">
<span className="inline-flex items-center gap-1" style={{ color: botA.color }}>
<span className="rounded" style={{ width: "10px", height: "10px", background: botA.color }} />
{botA.name}
</span>
<span className="inline-flex items-center gap-1" style={{ color: botB.color }}>
<span className="rounded" style={{ width: "10px", height: "10px", background: botB.color }} />
{botB.name}
</span>
</div>

<div className="text-xs text-gray-500 text-center mt-1">
{hoveredData
? `${hoveredData.cartas} carta${hoveredData.cartas !== 1 ? "s" : ""}: ${botA.name} ${hoveredData[botA.name] || 0} · ${botB.name} ${hoveredData[botB.name] || 0}`
: "Pasá el mouse por una columna para ver detalle"}
</div>
</div>
);
}

const createEmptyTourMatchSnapshots = () => TOURNAMENT_FIXTURE.map(() => null);

/* -- Shared line chart for rate evolution (winrate + sweep) -- */
function RateChart({ data, bot0, bot1 }: { data: {x: number, y0: number, y1: number}[], bot0: any, bot1: any }) {
const W = 500, H = 140;
const PAD = { top: 14, right: 52, bottom: 22, left: 38 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
// Empty state
if (data.length < 2) {
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {[25, 50, 75].map(v => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + (1 - v / 100) * plotH} y2={PAD.top + (1 - v / 100) * plotH}
            stroke={v === 50 ? "#374151" : "#1f2937"} strokeWidth={v === 50 ? 1 : 0.5} strokeDasharray="4,3" />
          <text x={PAD.left - 4} y={PAD.top + (1 - v / 100) * plotH + 3.5} textAnchor="end" fill="#374151" fontSize="9">{v}%</text>
        </g>
      ))}
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} stroke="#374151" strokeWidth="1" />
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="#374151" strokeWidth="1" />
      <text x={PAD.left + plotW / 2} y={H / 2 + 4} textAnchor="middle" fill="#374151" fontSize="11">Esperando datos…</text>
    </svg>
  );
}
const allY = data.flatMap(d => [d.y0, d.y1]);
const minR = Math.max(0, Math.floor((Math.min(...allY) - 4) / 5) * 5);
const maxR = Math.min(100, Math.ceil((Math.max(...allY) + 4) / 5) * 5);
const rng = maxR - minR || 1;
const toX = (i) => PAD.left + (i / (data.length - 1)) * plotW;
const toY = (r) => PAD.top + (1 - (r - minR) / rng) * plotH;
const path0 = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.y0).toFixed(1)}`).join(" ");
const path1 = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.y1).toFixed(1)}`).join(" ");
const midTick = Math.floor(data.length / 2);
return (
<svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
{[25, 50, 75].filter(v => v > minR && v < maxR).map(v => (
<g key={v}>
<line x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)}
stroke={v === 50 ? "#4b5563" : "#1f2937"} strokeWidth={v === 50 ? 1 : 0.5} strokeDasharray={v === 50 ? "4,3" : undefined} />
<text x={PAD.left - 4} y={toY(v) + 3.5} textAnchor="end" fill="#6b7280" fontSize="9">{v}%</text>
</g>
))}
<text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" fill="#4b5563" fontSize="9">{maxR}%</text>
<text x={PAD.left - 4} y={H - PAD.bottom + 4} textAnchor="end" fill="#4b5563" fontSize="9">{minR}%</text>
<line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} stroke="#374151" strokeWidth="1" />
<line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="#374151" strokeWidth="1" />
<text x={PAD.left} y={H - 5} textAnchor="middle" fill="#4b5563" fontSize="8">{data[0].x}</text>
<text x={PAD.left + plotW / 2} y={H - 5} textAnchor="middle" fill="#374151" fontSize="8">{data[midTick].x}</text>
<text x={W - PAD.right} y={H - 5} textAnchor="middle" fill="#4b5563" fontSize="8">{data[data.length - 1].x}</text>
<path d={path1} fill="none" stroke={bot1.color} strokeWidth="1.5" opacity="0.75" />
<path d={path0} fill="none" stroke={bot0.color} strokeWidth="1.5" opacity="0.75" />
<text x={W - PAD.right + 2} y={toY(data[data.length - 1].y0) + 3.5} fill={bot0.color} fontSize="8">{data[data.length - 1].y0.toFixed(4)}%</text>
<text x={W - PAD.right + 2} y={toY(data[data.length - 1].y1) + 3.5} fill={bot1.color} fontSize="8">{data[data.length - 1].y1.toFixed(4)}%</text>
</svg>
);
}

/* -- Prompt helpers -- */
function botConfigToPromptText(cfg) {
// v2 config
if (cfg.global) {
  const drawParts = [
    `umbral mejora=${cfg.draw.improvementThreshold}`,
    `estructura=${cfg.draw.structuralPriority}`,
    cfg.draw.infoAversion > 0 ? `aversión info=${cfg.draw.infoAversion}` : null,
    cfg.draw.chinchonBias > 0 ? `sesgo chinchón=${cfg.draw.chinchonBias}` : null,
    `tempo=${cfg.draw.tempoPreference}`,
  ].filter(Boolean).join(", ");

  const discParts = [
    `alcance=${cfg.discard.evalScope}`,
    `resto=${cfg.discard.restoBias}`,
    `potencial=${cfg.discard.potentialBias}`,
    cfg.discard.rankBias > 0 ? `rango=${cfg.discard.rankBias} [debug]` : null,
    `protección comodín=${cfg.discard.jokerProtection}`,
  ].filter(Boolean).join(", ");

  let cutDesc;
  if (cfg.cut.useScoreRules && cfg.cut.scoreRules) {
    const rules = cfg.cut.scoreRules.map(r => `${r.minScore}+ pts → ≤${r.maxResto}`).join(", ");
    cutDesc = `adaptativo [${rules}], máx ${cfg.cut.maxFree} suelta`;
  } else {
    cutDesc = `resto ≤ ${cfg.cut.baseResto}, máx ${cfg.cut.maxFree} suelta`;
  }
  const cutExtras = [
    cfg.cut.chinchonPursuit > 0 ? `chinchón=${cfg.cut.chinchonPursuit} (umbral ${cfg.cut.chinchonThreshold})` : null,
    cfg.cut.minus10Pursuit > 0 ? `−10=${cfg.cut.minus10Pursuit}` : null,
    `urgencia mazo=${cfg.cut.deckUrgency}`,
    `protección ventaja=${cfg.cut.leadProtection}`,
    `desesperación=${cfg.cut.desperationMode}`,
  ].filter(Boolean).join(", ");

  return [
    `${cfg.emoji} ${cfg.name}`,
    cfg.description ? `"${cfg.description}"` : null,
    `  Personalidad: temp=${cfg.global.temperature}${cfg.global.mistakeRate > 0 ? `, errores=${cfg.global.mistakeRate} [debug]` : ""}`,
    `  Robo: ${drawParts}`,
    `  Descarte: ${discParts}`,
    `  Corte: ${cutDesc}`,
    cutExtras ? `  Lectura: ${cutExtras}` : null,
  ].filter(Boolean).join("\n");
}

// v1 fallback
const drawDescs = {
  always_deck: "solo roba del mazo (nunca del descarte)",
  smart: `roba del descarte si reduce el resto en más de ${cfg.draw?.restoThreshold ?? 3} pts`,
  aggressive: "roba del descarte ante cualquier mejora de resto",
};
const discardDescs = {
  default: "descarta la carta suelta de mayor valor en puntos",
  high_rank: "descarta siempre la carta con número más alto",
  optimal: "evalúa las 8 opciones de descarte y elige la que deja la mejor mano",
};
let cutDesc;
if (cfg.cut?.useScoreRules && cfg.cut?.scoreRules) {
  const rules = cfg.cut.scoreRules.map(r => `${r.minScore}+ pts → resto ≤ ${r.maxResto}`).join(", ");
  cutDesc = `corte adaptativo por puntaje [${rules}], máx ${cfg.cut.maxFree ?? 1} carta suelta`;
} else {
  cutDesc = `corta con resto ≤ ${cfg.cut?.baseResto ?? 5} pts, máx ${cfg.cut?.maxFree ?? 1} carta suelta`;
}
return [
  `${cfg.emoji} ${cfg.name} [v1 legacy]`,
  cfg.description ? `"${cfg.description}"` : null,
  `  Robo: ${drawDescs[cfg.draw?.mode] ?? cfg.draw?.mode}`,
  `  Descarte: ${discardDescs[cfg.discard?.mode] ?? cfg.discard?.mode}`,
  `  Corte: ${cutDesc}`,
].filter(Boolean).join("\n");
}

function generateSimPrompt(cfg0, cfg1, metrics) {
const { gameWins, roundWins, sweepWins, chinchonWins, totalRounds, numSims } = metrics;
const total = gameWins[0] + gameWins[1];
const totalPairs = sweepWins[0] + sweepWins[1] + sweepWins[2];
return `Tengo dos bots de Chinchón (baraja española de 50 cartas, incluyendo 2 comodines) que corrieron ${totalPairs} simulaciones${totalPairs < numSims ? ` (corte antes del máximo configurado de ${numSims})` : ""}. Cada simulación es un par de partidas espejo (misma repartida, manos invertidas), dando ${total} partidas totales.

REGLAS RELEVANTES:
- 7 cartas por jugador. En su turno: roba del mazo o descarte, luego descarta 1.
- Melds válidos: escalera de 3–7 cartas del mismo palo, o grupo de 3–4 cartas del mismo número.
- Se puede cortar cuando el resto (puntos de cartas sueltas) ≤ 5 y hay máximo 1 carta suelta. Resto = suma de valores de cartas fuera de melds.
- Si todas las cartas forman melds: corte con -10 puntos.
- Chinchón: 7 cartas consecutivas del mismo palo y sin comodines = victoria instantánea de la partida.
- El jugador acumula los puntos del que cortó al revés (o su propio resto si cortó). Se elimina a los 100 puntos.
- Simulación espejo: cada simulación corre 2 partidas con la misma repartida pero intercambiando manos y turno inicial. Neutraliza la aleatoriedad.

BOT 1:
${botConfigToPromptText(cfg0)}

BOT 2:
${botConfigToPromptText(cfg1)}

RESULTADOS (${totalPairs} simulaciones = ${total} partidas totales):
- Partidas ganadas: ${cfg0.emoji} ${cfg0.name} ${gameWins[0]} (${((gameWins[0]/total)*100).toFixed(1)}%) vs ${cfg1.emoji} ${cfg1.name} ${gameWins[1]} (${((gameWins[1]/total)*100).toFixed(1)}%)
- Rondas ganadas: ${cfg0.name} ${roundWins[0]} (${((roundWins[0]/totalRounds)*100).toFixed(1)}%) vs ${cfg1.name} ${roundWins[1]} (${((roundWins[1]/totalRounds)*100).toFixed(1)}%) — ${totalRounds} rondas totales
- Promedio de rondas por partida: ${(totalRounds / total).toFixed(1)}
- Doble espejo (gana ambas con misma repartida): ${cfg0.name} ${sweepWins[0]} (${((sweepWins[0]/totalPairs)*100).toFixed(1)}%), ${cfg1.name} ${sweepWins[1]} (${((sweepWins[1]/totalPairs)*100).toFixed(1)}%), empates ${sweepWins[2]}
- Chinchones: ${cfg0.name} ${chinchonWins[0]} (${getChinchonWinRate(chinchonWins[0], gameWins[0]).toFixed(1)}% de sus victorias) vs ${cfg1.name} ${chinchonWins[1]} (${getChinchonWinRate(chinchonWins[1], gameWins[1]).toFixed(1)}% de sus victorias)

PREGUNTAS:
1. ¿Por qué creés que el bot ganador tuvo esa ventaja? Explicá en términos de las mecánicas del juego.
2. ¿Qué cambios en la configuración del bot perdedor lo harían más competitivo?
3. ¿Hay algún escenario donde la estrategia del bot perdedor sea superior?`;
}

function generateNewBotPrompt(simContext?: string) {
const schema = `{
  "name": string,         // 1–12 caracteres
  "emoji": string,        // UNO de: 🧪 ⚡ 🎲 💎 🦾 🧠 🔥 🤡 🎯 🎭 🚀 💀 👻 🕷️ 🍀 🌟 👑 🐉 🦊 🦁 🌊 🏆 🌋 🛡️ 🎪 🎸 🦈 🦋 🌈 🎩 🔱 🌀
  "colorIdx": number,     // entero 0–7
  "description": string,  // hasta 120 caracteres, descripción de la estrategia
  "global": {
    "temperature": number,  // 0–10; ruido gaussiano en evaluaciones. 0 = determinista
    "mistakeRate": number   // 0–10; probabilidad de invertir decisiones al azar (debug)
  },
  "draw": {
    "improvementThreshold": number,  // 0–10; cuánta mejora de resto exige para tomar del descarte. Alto = conservador
    "structuralPriority": number,    // 0–10; valora pares/conectores además de resto al decidir robo
    "infoAversion": number,          // 0–10; evita tomar del descarte para no revelar info. 10 = solo mazo
    "chinchonBias": number,          // 0–10; bonus por cartas que acercan al chinchón
    "tempoPreference": number        // 0–10; alto = prefiere mejorar rápido, bajo = juega lento
  },
  "discard": {
    "evalScope": "fast" | "full",    // fast = carta suelta de mayor peso; full = prueba las 8 y elige la mejor
    "restoBias": number,             // 0–10; prioriza descartar la que más reduce el resto
    "potentialBias": number,         // 0–10; protege cartas con potencial de meld
    "rankBias": number,              // 0–10; suelta cartas de rango alto sin importar melds (debug)
    "jokerProtection": number        // 0–10; evita dejar comodines sin meld
  },
  "cut": {
    "maxFree": 0 | 1,         // 0 = solo corta sin cartas sueltas; 1 = tolera hasta 1 carta suelta
    "baseResto": number,       // 0–5; umbral de resto máximo para cortar (si useScoreRules = false)
    "useScoreRules": boolean,  // true = usa scoreRules en lugar de baseResto
    "scoreRules": [            // exactamente 4 entradas, una por rango de puntaje propio
      { "minScore": 0,  "maxResto": number },   // cuando tengo 0–24 puntos
      { "minScore": 25, "maxResto": number },   // cuando tengo 25–49 puntos
      { "minScore": 50, "maxResto": number },   // cuando tengo 50–74 puntos
      { "minScore": 75, "maxResto": number }    // cuando tengo 75+ puntos
    ],
    "chinchonPursuit": number,     // 0–10; cuánto pesa esperar al chinchón. 0 = nunca, 10 = siempre
    "chinchonThreshold": 4 | 5 | 6, // cartas en posición necesarias para activar la persecución
    "minus10Pursuit": number,      // 0–10; cuánto pesa esperar al −10. 0 = corta cuando puede
    "deckUrgency": number,         // 0–10; apura corte cuando quedan pocas cartas en el mazo
    "leadProtection": number,      // 0–10; sube umbral de corte si va ganando
    "desperationMode": number      // 0–10; baja umbral si va perdiendo por mucho
  }
}`;

const example = `{
  "name": "EjemploBot",
  "emoji": "🧠",
  "colorIdx": 1,
  "description": "Equilibrado: toma del descarte con mejora moderada, corte adaptativo por marcador.",
  "global": { "temperature": 2, "mistakeRate": 0 },
  "draw": { "improvementThreshold": 3, "structuralPriority": 5, "infoAversion": 0, "chinchonBias": 0, "tempoPreference": 5 },
  "discard": { "evalScope": "fast", "restoBias": 8, "potentialBias": 3, "rankBias": 0, "jokerProtection": 5 },
  "cut": {
    "maxFree": 1,
    "baseResto": 4,
    "useScoreRules": true,
    "scoreRules": [
      { "minScore": 0,  "maxResto": 4 },
      { "minScore": 25, "maxResto": 3 },
      { "minScore": 50, "maxResto": 2 },
      { "minScore": 75, "maxResto": 1 }
    ],
    "chinchonPursuit": 0,
    "chinchonThreshold": 6,
    "minus10Pursuit": 0,
    "deckUrgency": 3,
    "leadProtection": 3,
    "desperationMode": 2
  }
}`;

return `Sos un experto en estrategia de Chinchón con baraja española (50 cartas, 2 comodines).

OBJETIVO: Diseñá un nuevo bot de Chinchón con una estrategia original y competitiva.
${simContext ? "Usá el contexto de simulación al final de este mensaje como guía para mejorar los bots analizados o crear uno que cubra sus debilidades." : "Pensá en una estrategia diferenciada: podés ser agresivo, defensivo, adaptativo, o especializado en chinchón."}

REGLAS CLAVE DEL JUEGO:
- 7 cartas por jugador. Turno: roba del mazo o del descarte, luego descarta 1.
- Melds válidos: escalera de 3–7 cartas del mismo palo, o trío/cuarteto del mismo n��mero.
- Para cortar: resto (suma de valores de cartas sueltas fuera de melds) ≤ 5 y máx 1 carta suelta.
- Corte con todas las cartas en melds: el cortador suma −10 puntos.
- Chinchón: 7 cartas consecutivas del mismo palo (sin comodines) → victoria instantánea.
- Se elimina al llegar a 100 puntos. El perdedor de cada ronda suma el resto del cortador.

ESQUEMA JSON (único formato válido para importar el bot):
${schema}

EJEMPLO DE JSON VÁLIDO:
${example}
${simContext ? `\nCONTEXTO DE SIMULACIÓN PREVIA:\n${simContext}` : ""}
INSTRUCCIÓN FINAL: Respondé ÚNICAMENTE con el JSON del nuevo bot. Sin texto antes, sin texto después, sin bloques de código markdown (no uses \`\`\`json). Solo el objeto JSON puro.`;
}

function getBotConfig(idx, customConfigs) {
if (idx < BUILTIN_BOT_CONFIGS.length) return BUILTIN_BOT_CONFIGS[idx];
return customConfigs[idx - BUILTIN_BOT_CONFIGS.length] ?? BUILTIN_BOT_CONFIGS[0];
}

/* -- Sort helpers for play mode -- */
function sortBySuit(hand) {
return [...hand].sort((a, b) => {
if (isJoker(a) && isJoker(b)) return 0;
if (isJoker(a)) return 1; if (isJoker(b)) return -1;
if (a.suit !== b.suit) return a.suit - b.suit;
return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
});
}
function sortByRank(hand) {
return [...hand].sort((a, b) => {
if (isJoker(a) && isJoker(b)) return 0;
if (isJoker(a)) return 1; if (isJoker(b)) return -1;
if (a.rank !== b.rank) return a.rank - b.rank;
return a.suit - b.suit;
});
}

function cloneEditorConfig(config) {
if (typeof structuredClone === "function") return structuredClone(config);
return JSON.parse(JSON.stringify(config));
}

function updateEditorConfig(config, path, value) {
const next = cloneEditorConfig(config);
const keys = path.split(".");
let obj = next;
for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
obj[keys[keys.length - 1]] = value;
return next;
}

function botEditorReducer(state, action) {
switch (action.type) {
case "set":
  return updateEditorConfig(state, action.path, action.value);
case "setRule": {
  const next = cloneEditorConfig(state);
  next.cut.scoreRules[action.idx].maxResto = action.value;
  return next;
}
case "reset":
  return cloneEditorConfig(action.config);
default:
  return state;
}
}

/* -- Bot Editor sub-component -- */
function BotEditor({ config, onSave, onCancel }) {
const [cfg, dispatch] = useReducer(botEditorReducer, config, cloneEditorConfig);
const upd = (path, val) => dispatch({ type: "set", path, value: val });
const updRule = (idx, val) => dispatch({ type: "setRule", idx, value: val });
const c = CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length];
const strategyPills = getBotStrategyPills(cfg);

useEffect(() => {
dispatch({ type: "reset", config });
}, [config]);

return (
<div
  className="lab-bot-sheet"
  style={{ "--bot-accent": c.color, "--bot-accent-soft": `${c.color}14`, "--bot-accent-border": `${c.color}55` }}
>
<div className="lab-bot-sheet__hero">
  <div className="lab-bot-sheet__eyebrow">{config.id ? "Editor de bot" : "Nuevo bot"}</div>
  <div className="lab-bot-sheet__head">
    <span className="lab-bot-sheet__avatar" aria-hidden="true">{cfg.emoji}</span>
    <div className="lab-bot-sheet__intro">
      <h3>{cfg.name || "Sin nombre"}</h3>
      <p>{cfg.description?.trim() || "Definí identidad, robo, descarte y corte para darle un estilo propio a tu bot."}</p>
    </div>
  </div>
  <div className="lab-bot-sheet__pills">
    {strategyPills.map((pill) => (
      <span key={pill} className="lab-bot-sheet__pill">{pill}</span>
    ))}
  </div>
</div>

{/* Name + Emoji + Color */}
<LabAccordionSection title="Identidad" subtitle="Nombre, descripcion, emoji y color" defaultOpen>
<div className="mb-4">
<label className="text-xs text-gray-500 block mb-1">Nombre</label>
<input type="text" value={cfg.name} maxLength={12} onChange={e => upd("name", e.target.value)}
className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 w-full focus:border-gray-500" />
</div>
<div className="mb-4">
<label className="text-xs text-gray-500 block mb-1">Descripción <span className="text-gray-600">(opcional)</span></label>
<textarea value={cfg.description ?? ""} maxLength={120} rows={2} onChange={e => upd("description", e.target.value)}
placeholder="Describí la estrategia de tu bot en pocas palabras..."
className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 w-full focus:border-gray-500 resize-none" />
<div className="text-xs text-gray-600 text-right mt-0.5">{(cfg.description ?? "").length}/120</div>
</div>
<div className="mb-4">
<label className="text-xs text-gray-500 block mb-1">Emoji</label>
<div className="flex gap-1.5 flex-wrap">
{CUSTOM_EMOJIS.map(e => (
<button key={e} onClick={() => upd("emoji", e)}
className={`w-9 h-9 rounded-lg text-lg border transition-all ${cfg.emoji === e ? "border-2 scale-110" : "border-gray-700 hover:border-gray-500"}`}
style={cfg.emoji === e ? { borderColor: c.color, background: `${c.color}15` } : { background: "#111827" }}>
{e}
</button>
))}
</div>
</div>
<div className="mb-5">
<label className="text-xs text-gray-500 block mb-1">Color</label>
<div className="flex flex-wrap gap-2">
{CUSTOM_COLORS.map((cc, i) => (
<button key={i} onClick={() => upd("colorIdx", i)}
className={`w-8 h-8 rounded-full border-2 transition-all ${cfg.colorIdx === i ? "scale-110 ring-2 ring-white/60" : "hover:scale-105"}`}
style={{ background: cc.color, borderColor: cfg.colorIdx === i ? "#fff" : cc.color }} />
))}
</div>
</div>
</LabAccordionSection>

{/* Personalidad global */}
<LabAccordionSection title="Personalidad" subtitle="Ruido y aleatoriedad global" defaultOpen={false}>
<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>🎲 Personalidad del bot</div>
<p className="text-xs text-gray-500 mb-3 leading-snug">Parámetros globales que afectan todas las decisiones. Subir estos valores hace al bot más impredecible.</p>

<div className="mb-4">
<div className="flex items-center justify-between mb-0.5">
<span className="text-xs font-medium text-gray-300">Temperatura</span>
<span className="text-xs font-mono text-amber-400">{cfg.global.temperature}</span>
</div>
<p className="text-xs text-gray-500 mb-1.5 leading-snug">Agrega ruido gaussiano a todas las evaluaciones numéricas. 0 = determinista, 10 = muy caótico.</p>
<input type="range" min={0} max={10} value={cfg.global.temperature} onChange={e => upd("global.temperature", +e.target.value)} className="w-full accent-amber-500" />
</div>

<div>
<div className="flex items-center justify-between mb-0.5">
<span className="text-xs font-medium text-gray-300">
<span className="lab-debug-badge" title="Este parámetro hace al bot peor a propósito. Útil para testing.">🧪 Debug</span>
{" "}Tasa de error
</span>
<span className="text-xs font-mono text-amber-400">{cfg.global.mistakeRate}</span>
</div>
<p className="text-xs text-gray-500 mb-1.5 leading-snug">Probabilidad de invertir una decisión al azar. 0 = nunca se equivoca, 10 = invierte el 100% de las veces. Para testing.</p>
<input type="range" min={0} max={10} value={cfg.global.mistakeRate} onChange={e => upd("global.mistakeRate", +e.target.value)} className="w-full accent-amber-500" />
{cfg.global.mistakeRate > 0 && <p className="text-xs text-yellow-500/70 mt-1 leading-snug">⚠️ Con tasa de error &gt; 0 el bot tomará decisiones incorrectas a propósito.</p>}
</div>
</div>
</LabAccordionSection>

{/* Draw */}
<LabAccordionSection title="Robo" subtitle="Cómo elige entre mazo y descarte" defaultOpen>
<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>🃏 Criterios de robo</div>
<p className="text-xs text-gray-500 mb-3 leading-snug">Pesos que determinan cuándo el bot toma del descarte vs. del mazo. Los valores más altos hacen que ese criterio pese más en la decisión.</p>

{([
["draw.improvementThreshold", "Umbral de mejora", "Cuánta mejora de resto exige para tomar del descarte. Alto = conservador, solo toma si la mejora es grande.", cfg.draw.improvementThreshold],
["draw.structuralPriority", "Prioridad estructural", "Valora si la carta del descarte forma pares o conectores (escaleras parciales) además de reducir el resto.", cfg.draw.structuralPriority],
["draw.infoAversion", "Aversión a la info", "Evita tomar del descarte para no revelar al rival qué cartas le sirven. 10 = nunca toma del descarte.", cfg.draw.infoAversion],
["draw.chinchonBias", "Sesgo chinchón", "Bonus por tomar cartas que acercan al chinchón (7 cartas consecutivas del mismo palo).", cfg.draw.chinchonBias],
["draw.tempoPreference", "Preferencia de tempo", "Pondera el turno actual vs. avance: alto = prefiere mejorar rápido. Bajo = juega lento y cauteloso.", cfg.draw.tempoPreference],
] as [string, string, string, number][]).map(([path, label, tip, val]) => (
<div key={path} className="mb-3 last:mb-0">
<div className="flex items-center justify-between mb-0.5">
<span className="text-xs font-medium text-gray-300">{label}</span>
<span className="text-xs font-mono text-amber-400">{val}</span>
</div>
<p className="text-xs text-gray-500 mb-1 leading-snug">{tip}</p>
<input type="range" min={0} max={10} value={val} onChange={e => upd(path, +e.target.value)} className="w-full accent-amber-500" />
</div>
))}
</div>
</LabAccordionSection>

{/* Discard */}
<LabAccordionSection title="Descarte" subtitle="Qué carta deja ir en cada turno" defaultOpen={false}>
<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>🗑️ Criterios de descarte</div>
<p className="text-xs text-gray-500 mb-3 leading-snug">Controlan qué carta descarta el bot después de robar. Cada peso influye en la puntuación de cada carta candidata.</p>

<div className="mb-4">
<span className="text-xs font-medium text-gray-300 block mb-0.5">Alcance de evaluación</span>
<p className="text-xs text-gray-500 mb-2 leading-snug">Fast = evalúa la carta suelta de mayor peso rápido. Full = prueba descartar cada una de las 8 cartas y elige la mejor opción (más lento).</p>
<div className="flex gap-1">
{(["fast", "full"] as const).map(v => (
<button key={v} onClick={() => upd("discard.evalScope", v)}
className={`px-3 py-1 rounded text-xs font-medium border transition-all ${cfg.discard.evalScope === v ? "border-2" : "border-gray-600 text-gray-400 hover:border-gray-500"}`}
style={cfg.discard.evalScope === v ? { borderColor: c.color, color: c.color, background: `${c.color}15` } : {}}>
{v === "fast" ? "Fast — rápido" : "Full — exhaustivo"}
</button>
))}
</div>
</div>

{([
["discard.restoBias", "Peso del resto", "Prioriza descartar la carta que más reduzca el resto (suma de sueltas). Valor central de la decisión.", cfg.discard.restoBias, false],
["discard.potentialBias", "Peso del potencial", "Protege cartas que forman pares o conectores aunque sumen mucho resto. Alto = más constructor.", cfg.discard.potentialBias, false],
["discard.rankBias", "Peso del rango", "Prioriza soltar cartas de rango alto sin importar si forman melds. Útil para debugging.", cfg.discard.rankBias, true],
["discard.jokerProtection", "Protección de comodín", "Evita descartar cartas que dejen un comodín expuesto (sin meld que lo use). Alto = protege comodines.", cfg.discard.jokerProtection, false],
] as [string, string, string, number, boolean][]).map(([path, label, tip, val, isDebug]) => (
<div key={path} className="mb-3 last:mb-0">
<div className="flex items-center justify-between mb-0.5">
<span className="text-xs font-medium text-gray-300">
{isDebug && <span className="lab-debug-badge" title="Este parámetro hace al bot peor a propósito. Útil para testing.">🧪 Debug</span>}
{isDebug ? " " : ""}{label}
</span>
<span className="text-xs font-mono text-amber-400">{val}</span>
</div>
<p className="text-xs text-gray-500 mb-1 leading-snug">{tip}</p>
<input type="range" min={0} max={10} value={val} onChange={e => upd(path, +e.target.value)} className="w-full accent-amber-500" />
</div>
))}
</div>
</LabAccordionSection>

{/* Cut */}
<LabAccordionSection title="Corte" subtitle="Cuándo decide cerrar la ronda" defaultOpen={false}>
<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>✂️ Restricciones base</div>
<p className="text-xs text-gray-500 mb-3 leading-snug">Condiciones mínimas que el bot exige para cortar.</p>

<div className="mb-3">
<span className="text-xs font-medium text-gray-300 block mb-0.5">Cartas sueltas máximas</span>
<p className="text-xs text-gray-500 mb-2 leading-snug">Máximo de cartas fuera de melds al cortar. 0 = todas en juego · 1 = puede quedar una carta suelta.</p>
<div className="flex gap-1">
{[0, 1].map(v => (
<button key={v} onClick={() => upd("cut.maxFree", v)}
className={`px-3 py-1 rounded text-xs font-medium border transition-all ${cfg.cut.maxFree === v ? "border-2" : "border-gray-600 text-gray-400 hover:border-gray-500"}`}
style={cfg.cut.maxFree === v ? { borderColor: c.color, color: c.color, background: `${c.color}15` } : {}}>
{v === 0 ? "0 — sin sueltas" : "1 — una suelta"}
</button>
))}
</div>
</div>

{!cfg.cut.useScoreRules && (
<div className="mb-3">
<div className="flex items-center justify-between mb-0.5">
<span className="text-xs font-medium text-gray-300">Resto máximo para cortar</span>
<span className="text-xs font-mono text-amber-400">{cfg.cut.baseResto} pts</span>
</div>
<p className="text-xs text-gray-500 mb-1.5 leading-snug">Suma máxima de las cartas sueltas para decidir cortar. 0 = solo corta sin puntos sueltos.</p>
<input type="range" min={0} max={5} value={cfg.cut.baseResto} onChange={e => upd("cut.baseResto", +e.target.value)} className="w-full accent-amber-500" />
</div>
)}

<div className="border-t border-gray-700 pt-3 mb-3">
<label className="flex items-start gap-2 cursor-pointer">
<input type="checkbox" checked={cfg.cut.useScoreRules} onChange={e => upd("cut.useScoreRules", e.target.checked)} className="accent-amber-500 mt-0.5 shrink-0" />
<div>
<span className={`text-sm ${cfg.cut.useScoreRules ? "text-gray-100 font-medium" : "text-gray-300"}`}>Corte adaptativo por puntaje</span>
<p className="text-xs text-gray-500 leading-snug">Cambia el umbral de resto según los puntos acumulados.</p>
</div>
</label>
{cfg.cut.useScoreRules && (
<div className="ml-5 flex flex-col gap-2 mt-3">
{cfg.cut.scoreRules.map((r, i) => (
<div key={i} className="flex items-center gap-2">
<span className="text-xs text-gray-500 w-20 shrink-0">{r.minScore === 0 ? "0–24 pts" : r.minScore === 25 ? "25–49 pts" : r.minScore === 50 ? "50–74 pts" : "75+ pts"}:</span>
<span className="text-xs text-gray-400 shrink-0">resto ≤</span>
<input type="range" min={0} max={5} value={r.maxResto} onChange={e => updRule(i, +e.target.value)} className="flex-1 accent-amber-500" />
<span className="text-xs font-mono text-amber-400 w-5 text-right">{r.maxResto}</span>
</div>
))}
</div>
)}
</div>
</div>

<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>🎯 Objetivos</div>
<p className="text-xs text-gray-500 mb-3 leading-snug">Metas especiales que el bot persigue además de cortar lo antes posible.</p>

<div className="mb-3">
<div className="flex items-center justify-between mb-0.5">
<span className="text-xs font-medium text-gray-300">Persecución de chinchón</span>
<span className="text-xs font-mono text-amber-400">{cfg.cut.chinchonPursuit}</span>
</div>
<p className="text-xs text-gray-500 mb-1 leading-snug">Cuánto pesa el deseo de esperar al chinchón (−25 pts). 0 = nunca espera, 10 = siempre espera si está cerca.</p>
<input type="range" min={0} max={10} value={cfg.cut.chinchonPursuit} onChange={e => upd("cut.chinchonPursuit", +e.target.value)} className="w-full accent-amber-500" />
</div>

{cfg.cut.chinchonPursuit > 0 && (
<div className="mb-3 ml-3 border-l-2 border-gray-700 pl-3">
<span className="text-xs font-medium text-gray-400 block mb-1.5">Umbral de chinchón</span>
<p className="text-xs text-gray-500 mb-2 leading-snug">Cuántas cartas en posición necesita para activar la persecución.</p>
<div className="flex gap-1.5">
{([4, 5, 6] as const).map(v => (
<button key={v} onClick={() => upd("cut.chinchonThreshold", v)}
className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${cfg.cut.chinchonThreshold === v ? "border-2" : "border-gray-600 text-gray-400 hover:border-gray-500"}`}
style={cfg.cut.chinchonThreshold === v ? { borderColor: c.color, color: c.color, background: `${c.color}15` } : {}}>
{v === 4 ? "4 — muy ambicioso" : v === 5 ? "5 — ambicioso" : "6 — estricto"}
</button>
))}
</div>
</div>
)}

<div>
<div className="flex items-center justify-between mb-0.5">
<span className="text-xs font-medium text-gray-300">Persecución de −10</span>
<span className="text-xs font-mono text-amber-400">{cfg.cut.minus10Pursuit}</span>
</div>
<p className="text-xs text-gray-500 mb-1 leading-snug">Cuánto pesa el deseo de cortar con resto 0 (−10 pts) en vez de cortar con resto &gt; 0. 0 = corta cuando puede, 10 = siempre espera al −10.</p>
<input type="range" min={0} max={10} value={cfg.cut.minus10Pursuit} onChange={e => upd("cut.minus10Pursuit", +e.target.value)} className="w-full accent-amber-500" />
</div>
</div>

<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>📊 Lectura de partida</div>
<p className="text-xs text-gray-500 mb-3 leading-snug">Cuánto influye el contexto de la partida en las decisiones de corte.</p>

{([
["cut.deckUrgency", "Urgencia por mazo", "Apura el corte cuando quedan pocas cartas en el mazo. Alto = corta más rápido cuando el mazo se acaba.", cfg.cut.deckUrgency],
["cut.leadProtection", "Protección de ventaja", "Si va ganando, sube el umbral de corte para no regalar puntos. Alto = más conservador cuando lidera.", cfg.cut.leadProtection],
["cut.desperationMode", "Modo desesperación", "Si va perdiendo por mucho, baja el umbral para cortar antes y evitar que el rival cierre. Alto = más agresivo al perder.", cfg.cut.desperationMode],
] as [string, string, string, number][]).map(([path, label, tip, val]) => (
<div key={path} className="mb-3 last:mb-0">
<div className="flex items-center justify-between mb-0.5">
<span className="text-xs font-medium text-gray-300">{label}</span>
<span className="text-xs font-mono text-amber-400">{val}</span>
</div>
<p className="text-xs text-gray-500 mb-1 leading-snug">{tip}</p>
<input type="range" min={0} max={10} value={val} onChange={e => upd(path, +e.target.value)} className="w-full accent-amber-500" />
</div>
))}
</div>
</LabAccordionSection>

{/* Actions */}
<div className="lab-bot-sheet__footer">
<div className="lab-bot-sheet__summary">
  <span className="lab-bot-sheet__summary-label">Resumen actual</span>
  <p>{generateDesc(cfg)}</p>
</div>
<div className="lab-bot-sheet__actions">
<button onClick={onCancel} className="lab-bot-sheet__button">Cancelar</button>
<button onClick={() => { if (!cfg.name.trim()) return; onSave(cfg); }}
className="lab-bot-sheet__button is-primary"
style={{ background: c.color, borderColor: c.color }}>
Guardar
</button>
</div>
</div>
</div>
);
}

/* -- BotViewer: read-only config display -- */
function ViewerRow({ label, value, accent = false }) {
return (
<div className="flex items-center justify-between py-0.5">
<span className="text-xs text-gray-400">{label}</span>
<span className={`text-xs font-mono ${accent ? "text-amber-400" : "text-gray-200"}`}>{value}</span>
</div>
);
}

function BotViewer({ config, onClose }) {
const cfg = config;
const { color, soft, border } = getBotPalette(cfg);
const strategyPills = getBotStrategyPills(cfg);
const isPreset = Boolean(cfg.color);
const isV2 = Boolean(cfg.global);

return (
<div
  className="lab-bot-sheet"
  style={{ "--bot-accent": color, "--bot-accent-soft": soft, "--bot-accent-border": border }}
>
<div className="lab-bot-sheet__hero">
  <div className="lab-bot-sheet__eyebrow">{isPreset ? "Preset del lab" : "Bot custom"}</div>
  <div className="lab-bot-sheet__head">
    <span className="lab-bot-sheet__avatar" aria-hidden="true">{cfg.emoji}</span>
    <div className="lab-bot-sheet__intro">
      <h3>{cfg.name}</h3>
      <p>{isPreset ? "Preset estable del lab para comparar estilos de robo, descarte y corte." : "Revisá la estrategia completa antes de editarla, exportarla o medirla contra los bots base."}</p>
    </div>
    <span className="lab-bot-sheet__status">Solo lectura</span>
  </div>
  <div className="lab-bot-sheet__pills">
    {strategyPills.map((pill) => (
      <span key={pill} className="lab-bot-sheet__pill">{pill}</span>
    ))}
  </div>
</div>

{cfg.description && (
<div className="lab-bot-viewer__lead">
<p className="text-sm text-gray-200 leading-snug">{cfg.description}</p>
</div>
)}

{isV2 ? (
<div className="lab-bot-viewer__grid">
<article className="lab-bot-viewer__card">
<div className="text-xs font-bold mb-2" style={{ color }}>🎲 Personalidad</div>
<ViewerRow label="Temperatura" value={cfg.global.temperature} accent />
<ViewerRow label="Tasa de error" value={cfg.global.mistakeRate} accent />
{cfg.global.mistakeRate > 0 && <p className="text-xs text-yellow-500/70 mt-1">⚠️ Debug activo</p>}
</article>

<article className="lab-bot-viewer__card">
<div className="text-xs font-bold mb-2" style={{ color }}>🃏 Robo</div>
<ViewerRow label="Umbral mejora" value={cfg.draw.improvementThreshold} accent />
<ViewerRow label="Prioridad estructural" value={cfg.draw.structuralPriority} accent />
<ViewerRow label="Aversión info" value={cfg.draw.infoAversion} accent />
<ViewerRow label="Sesgo chinchón" value={cfg.draw.chinchonBias} accent />
<ViewerRow label="Tempo" value={cfg.draw.tempoPreference} accent />
</article>

<article className="lab-bot-viewer__card">
<div className="text-xs font-bold mb-2" style={{ color }}>🗑️ Descarte</div>
<ViewerRow label="Alcance" value={cfg.discard.evalScope === "full" ? "Exhaustivo" : "Rápido"} />
<ViewerRow label="Peso resto" value={cfg.discard.restoBias} accent />
<ViewerRow label="Peso potencial" value={cfg.discard.potentialBias} accent />
<ViewerRow label="Peso rango" value={cfg.discard.rankBias} accent />
{cfg.discard.rankBias > 0 && <p className="text-xs text-yellow-500/70 mt-1">⚠️ Debug activo</p>}
<ViewerRow label="Protección comodín" value={cfg.discard.jokerProtection} accent />
</article>

<article className="lab-bot-viewer__card is-wide">
<div className="text-xs font-bold mb-2" style={{ color }}>✂️ Corte</div>
<div className="flex flex-col gap-1.5 text-sm">
<ViewerRow label="Sueltas máx" value={cfg.cut.maxFree} />
{!cfg.cut.useScoreRules && <ViewerRow label="Resto máx" value={`${cfg.cut.baseResto} pts`} />}
{cfg.cut.useScoreRules && (
<div>
<div className="text-xs text-gray-500 mb-1">Corte adaptativo:</div>
<div className="flex flex-col gap-0.5">
{cfg.cut.scoreRules.map((r, i) => (
<div key={i} className="text-xs flex gap-2">
<span className="text-gray-500 w-20 shrink-0">{r.minScore === 0 ? "0–24" : r.minScore === 25 ? "25–49" : r.minScore === 50 ? "50–74" : "75+"} pts:</span>
<span className="text-gray-300">resto ≤ <span className="text-gray-100 font-medium">{r.maxResto}</span></span>
</div>
))}
</div>
</div>
)}
<ViewerRow label="Persecución chinchón" value={cfg.cut.chinchonPursuit} accent />
{cfg.cut.chinchonPursuit > 0 && <ViewerRow label="Umbral chinchón" value={`${cfg.cut.chinchonThreshold} cartas`} />}
<ViewerRow label="Persecución −10" value={cfg.cut.minus10Pursuit} accent />
<ViewerRow label="Urgencia mazo" value={cfg.cut.deckUrgency} accent />
<ViewerRow label="Protección ventaja" value={cfg.cut.leadProtection} accent />
<ViewerRow label="Desesperación" value={cfg.cut.desperationMode} accent />
</div>
</article>
</div>
) : (
<div className="lab-bot-viewer__grid">
<article className="lab-bot-viewer__card is-wide">
<div className="text-xs font-bold mb-2" style={{ color }}>⚠️ Config v1 (legacy)</div>
<p className="text-xs text-gray-500">Este bot usa el formato antiguo. Editalo para migrar automáticamente a v2.</p>
</article>
</div>
)}

<div className="lab-bot-sheet__footer">
<div className="lab-bot-sheet__summary">
  <span className="lab-bot-sheet__summary-label">Resumen</span>
  <p>{generateDesc(cfg)}</p>
</div>

<div className="lab-bot-sheet__actions">
<button onClick={onClose} className="lab-bot-sheet__button">Cerrar</button>
</div>
</div>
</div>
);
}

/* -- Play sub-component -- */
function PlayGame({ g, bot, history, showBot, bML, pML, topD, canPlayerCut, setShowBot, playerDraw, selectCard, nextRound, resetGame, sortHand, toggleCutMode, reorderHand }) {
const [spyModal, setSpyModal] = useState(false);
const [arrangeMode, setArrangeMode] = useState(false);
const dragSrcRef = useRef(null);
const dragOccurred = useRef(false);
const canArrangeHand = g.turn === 0 && (g.phase === "playerDraw" || g.phase === "playerDiscard");

useEffect(() => {
if (!canArrangeHand && arrangeMode) setArrangeMode(false);
if (!canArrangeHand || !arrangeMode) {
  dragSrcRef.current = null;
  dragOccurred.current = false;
}
}, [arrangeMode, canArrangeHand]);

const handleSpy = () => {
if (showBot) { setShowBot(false); return; }
setSpyModal(true);
};
const toggleArrangeMode = () => {
  if (!canArrangeHand) return;
  if (!arrangeMode && g.cutMode) toggleCutMode();
  dragSrcRef.current = null;
  dragOccurred.current = false;
  setArrangeMode(v => !v);
};

return (
<div className="w-full">
{/* Spy modal */}
{spyModal && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setSpyModal(false)}>
<div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mx-4 max-w-xs text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
<div className="text-3xl mb-3">🤨</div>
<div className="text-lg font-bold text-gray-100 mb-1">Epaaaa, ¿qué hacemos?</div>
<div className="text-sm text-gray-400 mb-5">Querés espiar las cartas de {bot.name}...</div>
<div className="flex flex-col gap-2">
<button onClick={() => { setSpyModal(false); setShowBot(true); }}
className="bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
🔧 Es para debuggear
</button>
<button onClick={() => setSpyModal(false)}
className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
😅 Bueno perdón
</button>
</div>
</div>
</div>
)}

  <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 mb-3">
    <div className="text-center"><div className="text-xs text-gray-500">Vos</div><div className="text-lg font-bold text-sky-400">{g.scores[0]}</div></div>
    <div className="text-xs text-gray-600">R{history.length + 1}{g.phase !== "gameOver" && g.phase !== "roundEnd" && <span className="block text-gray-700">Mazo: {g.deck.length}</span>}</div>
    <div className="text-center"><div className="text-xs text-gray-500">{bot.name}</div><div className="text-lg font-bold" style={{ color: bot.color }}>{g.scores[1]}</div></div>
  </div>

  {g.phase === "gameOver" && (
    <div className="text-center py-6">
      <div className="text-3xl mb-2">{g.scores[0] >= 100 ? "😢" : "🎉"}</div>
      <div className="text-xl font-bold mb-2">{g.scores[0] >= 100 ? <span className="text-red-400">Perdiste ({g.scores[0]} pts)</span> : <span className="text-emerald-400">¡Ganaste!</span>}</div>
      <button onClick={resetGame} className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-md font-semibold mt-2">Jugar de nuevo</button>
    </div>
  )}

  {g.phase === "roundEnd" && g.roundResult && (
    <div className="mb-3">
      <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-center mb-3">
        {g.roundResult.cutter === "player" ? (
          <div>
            {g.roundResult.chinchon && <div className="text-2xl">🏆</div>}
            <span className="text-sky-400 font-bold">{g.roundResult.chinchon ? "¡CHINCHÓN! Ganaste la partida!" : "¡Cortaste!"}</span>
            {!g.roundResult.chinchon && <div className="text-sm text-gray-400 mt-1">Vos: {g.roundResult.pScore > 0 ? "+" : ""}{g.roundResult.pScore} · {bot.name}: +{g.roundResult.bScore}</div>}
          </div>
        ) : (
          <div>
            {g.roundResult.chinchon && <div className="text-xl">😱</div>}
            <span className="font-bold" style={{ color: bot.color }}>{bot.name} {g.roundResult.chinchon ? "¡hizo CHINCHÓN!" : "cortó"}</span>
            {!g.roundResult.chinchon && <div className="text-sm text-gray-400 mt-1">{bot.name}: {g.roundResult.bScore > 0 ? "+" : ""}{g.roundResult.bScore} · Vos: +{g.roundResult.pScore}</div>}
          </div>
        )}
      </div>
      <HandRow hand={g.pHand} meldsData={findBestMelds(g.pHand)} label="Tu mano" color="text-sky-400" bgClass="bg-sky-950" borderClass="border-sky-800" />
      <div className="h-2" />
      <HandRow hand={g.bHand} meldsData={findBestMelds(g.bHand)} label={bot.name} color={bot.text} bgClass={bot.bg} borderClass={bot.border} />
      <div className="flex justify-center mt-3">
        <button onClick={nextRound} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-md font-semibold active:scale-95">Siguiente ronda</button>
      </div>
    </div>
  )}

  {g.phase !== "roundEnd" && g.phase !== "gameOver" && (
    <div>
      <HandRow hand={g.bHand} meldsData={showBot ? bML : null} label={bot.name + (g.phase === "botTurn" ? " (pensando...)" : "")} color={bot.text} bgClass={bot.bg} borderClass={bot.border} faceDown={!showBot} />
      <div className="flex justify-end mt-1 mb-2">
        <button onClick={handleSpy} className={`lab-secondary-button ${showBot ? "is-active" : ""}`}>{showBot ? "🙈 Ocultar cartas" : "👀 Espiar cartas"}</button>
      </div>
      {g.botLastAction && (
        <div className="text-xs text-center text-gray-500 mb-2 bg-gray-900/60 border border-gray-800 rounded px-2 py-1.5">
          <span style={{ color: bot.color }}>{bot.name}</span>
          {g.botLastAction.drew === "initial" ? " descartó " : g.botLastAction.drew === "discard" ? " robó del descarte y tiró " : " robó del mazo y tiró "}
          <span className="font-mono text-gray-300">{cardLabel(g.botLastAction.discarded)}</span>
        </div>
      )}
      <div className="flex items-center justify-center gap-4 mb-3">
        <div className="flex flex-col items-center">
          <div className="ch-card-stack">
            <CardC
              faceDown
              onClick={g.phase === "playerDraw" && g.turn === 0 ? () => playerDraw("deck") : undefined}
              selected={g.phase === "playerDraw" && g.turn === 0}
            />
            <span className="ch-card-stack__count">{g.deck.length}</span>
          </div><span className="text-xs text-gray-500 mt-0.5">Mazo</span>
        </div>
        <div className={`flex flex-col items-center ${g.phase === "playerDraw" && g.turn === 0 && topD ? "cursor-pointer" : ""}`} onClick={() => g.phase === "playerDraw" && g.turn === 0 && topD && playerDraw("discard")}>
          {topD ? <CardC card={topD} selected={g.phase === "playerDraw" && g.turn === 0} />
            : <CardPlaceholder active={g.phase === "playerDraw" && g.turn === 0} />}
          <span className="text-xs text-gray-500 mt-0.5">Descarte</span>
        </div>
      </div>
      {g.phase === "playerDraw" && g.turn === 0 && <div className="text-center text-sm text-sky-400 mb-2">Agarrá del mazo o del descarte</div>}
      {g.phase === "playerDiscard" && <div className="text-center text-sm text-sky-400 mb-2">{arrangeMode ? "Modo acomodar activo: el descarte queda en pausa" : g.pHand.length === 8 ? "Inicio de ronda: tenés 8 cartas, tocá una para descartar" : g.cutMode ? "Elegí qué carta tirás para cortar" : "Tocá una carta para descartar"}</div>}
      {g.phase === "botTurn" && <div className="text-center text-sm text-gray-500 mb-2">{bot.name} está jugando...</div>}
      {g.message && <div className="text-center text-xs text-red-400 mb-2">{g.message}</div>}

      <div className="rounded-lg p-3 bg-sky-950 border border-sky-800">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm text-sky-400">Tu mano</span>
          {pML && <span className="text-xs text-gray-500">Sueltas: {pML.minFree} · Resto: {pML.resto}</span>}
        </div>
        {canArrangeHand && arrangeMode && (
          <div className="lab-copy-note mb-2">
            Modo reordenar activo: arrastrá las cartas para acomodar tu mano.
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {g.pHand.map((c, i) => {
            const meldSet = new Set((pML?.meldsCut || pML?.melds || []).flat());
            const inMeld = meldSet.has(i);
            const isDraw = g.drawnCard && sameCard(c, g.drawnCard);
            const canDrag = canArrangeHand && arrangeMode;
            const canDiscardCard = g.phase === "playerDiscard" && !arrangeMode;
            return (
              <div
                key={`${c.rank}-${c.suit}-${i}`}
                draggable={canDrag}
                onClick={canDiscardCard ? () => selectCard(i) : undefined}
                onDragStart={(e) => { dragSrcRef.current = i; dragOccurred.current = false; e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => { e.preventDefault(); if (dragSrcRef.current === null || dragSrcRef.current === i) return; dragOccurred.current = true; reorderHand(dragSrcRef.current, i); dragSrcRef.current = null; }}
                onDragEnd={() => { setTimeout(() => { dragOccurred.current = false; }, 50); dragSrcRef.current = null; }}
              >
                <CardC card={c} inMeld={inMeld} highlight={isDraw ? "drawn" : null}
                  faceDown={false} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sort + cut button */}
      <div className="flex items-center justify-between mt-2">
        <div className="lab-secondary-row">
          <button onClick={() => sortHand("suit")} className="lab-secondary-button is-quiet">Por palo</button>
          <button onClick={() => sortHand("rank")} className="lab-secondary-button is-quiet">Por número</button>
          {canArrangeHand && (
            <button
              onClick={toggleArrangeMode}
              className={`lab-secondary-button ${arrangeMode ? "is-active" : "is-quiet"}`}
            >
              {arrangeMode ? "Listo para jugar" : "Reordenar mano"}
            </button>
          )}
        </div>
        {g.phase === "playerDiscard" && canPlayerCut && !arrangeMode && (
          <button onClick={toggleCutMode} className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all active:scale-95 ${g.cutMode ? "bg-yellow-400 text-black ring-2 ring-yellow-300" : "bg-yellow-700 hover:bg-yellow-600 text-white animate-pulse"}`}>
            {g.cutMode ? "✂️ Tocá qué carta tirás" : "✂️ ¡Cortar!"}
          </button>
        )}
      </div>
    </div>
  )}

  {history.length > 0 && g.phase !== "gameOver" && (
    <div className="mt-4 bg-gray-900 border border-gray-800 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-2 font-medium">Historial</div>
      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
        {history.map((h, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-gray-500">R{i + 1} {h.chinchon ? "🏆" : ""}</span>
            <span className="text-sky-400">{h.pScore > 0 ? "+" : ""}{h.pScore}</span>
            <span style={{ color: bot.color }}>{h.bScore > 0 ? "+" : ""}{h.bScore}</span>
          </div>
        ))}
      </div>
    </div>
  )}
  {g.phase !== "gameOver" && <div className="flex justify-center mt-3"><button onClick={resetGame} className="lab-secondary-button is-danger">🛑 Abandonar partida</button></div>}
</div>

);
}

/* ==============================================================
MAIN
============================================================== */
export default function ChinchonArena() {
const [tab, setTab] = useState("sim");

// Custom bots
const [customConfigs, setCustomConfigs] = useState(() => loadCustomConfigs());
const [editingBot, setEditingBot] = useState(null); // null | config object being edited
const [viewingBot, setViewingBot] = useState(null); // null | config object being viewed
const [showDescMode, setShowDescMode] = useState<"desc" | "config">("desc");
const [benchmarks, setBenchmarks] = useState<Record<string, { wins: number; total: number }>>({});
const [benchmarking, setBenchmarking] = useState<string | null>(null);
const [copiedId, setCopiedId] = useState<string | null>(null);
const [showImport, setShowImport] = useState(false);
const [importText, setImportText] = useState("");
const [importError, setImportError] = useState<string | null>(null);
const workerRef = useRef<Worker | null>(null);
const activeJobIdRef = useRef(0);

const nextWorkerJobId = useCallback(() => {
  activeJobIdRef.current += 1;
  return activeJobIdRef.current;
}, []);

const cancelActiveWorkerJob = useCallback(() => {
  if (activeJobIdRef.current <= 0) return;
  workerRef.current?.postMessage({ type: "cancel", jobId: activeJobIdRef.current });
  activeJobIdRef.current += 1;
}, []);

useEffect(() => { saveCustomConfigs(customConfigs); syncBots(customConfigs); }, [customConfigs]);
// Initial sync on mount
useEffect(() => { syncBots(customConfigs); }, []);
useEffect(() => {
  const worker = new ChinchonLabWorker();
  workerRef.current = worker;

  worker.onmessage = (event) => {
    const data = event.data;
    if (data.jobId !== activeJobIdRef.current) return;

    startTransition(() => {
      if (data.type === "simProgress") {
        stopRef.current = data.progress >= 100;
        setProg(data.progress);
        setChartData(data.chartData);
        setRoundWins(data.roundWins);
        setGameWins(data.gameWins);
        setSweepWins(data.sweepWins);
        setTotalRounds(data.totalRounds);
        setWinRateHistory(data.winRateHistory);
        setSweepRateHistory(data.sweepRateHistory);
        setChinchonWins(data.chinchonWins);
        if (data.progress >= 100) setSimRun(false);
        return;
      }

      if (data.type === "benchmarkProgress") {
        setBenchmarks(prev => ({ ...prev, [data.botId]: { wins: data.wins, total: data.total } }));
        setBenchmarking(null);
        return;
      }

      if (data.type === "tournamentProgress") {
        setTourProgress(data.progress);
        setTourResults(data.results);
        setTourCurrentMatch(data.currentMatch);
        setTourCurrentStats(data.currentStats);
        setTourMatchSnapshots(data.matchSnapshots);
        if (data.done || data.progress >= 100) {
          stopTourRef.current = true;
          setTourRunning(false);
        }
      }
    });
  };

  return () => {
    worker.terminate();
    workerRef.current = null;
  };
}, []);

// Sim
const [simB0, setSimB0] = useState(0);
const [simB1, setSimB1] = useState(1);
const [numSims, setNumSims] = useState(50);
const [chartData, setChartData] = useState(null);
const [roundWins, setRoundWins] = useState([0, 0]);
const [gameWins, setGameWins] = useState([0, 0]);
const [sweepWins, setSweepWins] = useState([0, 0, 0]); // [bot0 sweeps, bot1 sweeps, splits]
const [totalRounds, setTotalRounds] = useState(0);
const [winRateHistory, setWinRateHistory] = useState<{simulations: number, rate0: number, rate1: number}[]>([]);
const [sweepRateHistory, setSweepRateHistory] = useState<{pairs: number, rate0: number, rate1: number}[]>([]);
const [chinchonWins, setChinchonWins] = useState([0, 0]);
const [simRun, setSimRun] = useState(false);
const [prog, setProg] = useState(0);
const [promptCopied, setPromptCopied] = useState(false);
const [newBotPromptCopied, setNewBotPromptCopied] = useState(false);
const [chartTab, setChartTab] = useState<"winrate" | "sweep">("winrate");
const [chartZoom, setChartZoom] = useState<number | null>(null);
const stopRef = useRef(false);

const resetSimState = useCallback(() => {
  cancelActiveWorkerJob();
  stopRef.current = true;
  setSimRun(false);
  setBenchmarking(null);
  setProg(0);
  setChartData(null);
  setRoundWins([0, 0]);
  setGameWins([0, 0]);
  setSweepWins([0, 0, 0]);
  setTotalRounds(0);
  setWinRateHistory([]);
  setSweepRateHistory([]);
  setChinchonWins([0, 0]);
  setPromptCopied(false);
  setNewBotPromptCopied(false);
}, [cancelActiveWorkerJob]);

// Tournament
const [tourBots, setTourBots] = useState([0, 1, 2, 3]);
const [tourResults, setTourResults] = useState(null);
const [tourRunning, setTourRunning] = useState(false);
const [tourProgress, setTourProgress] = useState(0);
const [tourCurrentMatch, setTourCurrentMatch] = useState(null);
const [tourCurrentStats, setTourCurrentStats] = useState(null);
const [tourMatchSnapshots, setTourMatchSnapshots] = useState(() => createEmptyTourMatchSnapshots());
const stopTourRef = useRef(false);

// Stabilization config — Sim
const [useStabilized, setUseStabilized] = useState(false);
const [stabilizeDecimals, setStabilizeDecimals] = useState(1);

// Stabilization config — Tournament
const [tourUseStabilized, setTourUseStabilized] = useState(true);
const [tourStabilizeDecimals, setTourStabilizeDecimals] = useState(1);
const [tourMatrixView, setTourMatrixView] = useState<"percent" | "absolute">("percent");
const [tourSection, setTourSection] = useState<"fixture" | "results">("fixture");

const resetTournamentState = useCallback(() => {
  cancelActiveWorkerJob();
  stopTourRef.current = true;
  setTourRunning(false);
  setBenchmarking(null);
  setTourProgress(0);
  setTourCurrentMatch(null);
  setTourCurrentStats(null);
  setTourResults(null);
  setTourMatchSnapshots(createEmptyTourMatchSnapshots());
  setTourSection("fixture");
}, [cancelActiveWorkerJob]);

const handleTabChange = useCallback((nextTab) => {
  resetSimState();
  resetTournamentState();
  autoRef.current = false;
  setAutoP(false);
  setTab(nextTab);
}, [resetSimState, resetTournamentState]);

// Match viewer
const [mvB0, setMvB0] = useState(0);
const [mvB1, setMvB1] = useState(1);
const [replayPair, setReplayPair] = useState(null);
const [matchRound, setMatchRound] = useState("A");
const [si, setSi] = useState(0);
const [autoP, setAutoP] = useState(false);
const autoRef = useRef(false);

// Play
const [botChoice, setBotChoice] = useState(null);
const [g, setG] = useState(null);
const [history, setHistory] = useState([]);
const [showBot, setShowBot] = useState(false);

// -- Sim --
const runSim = useCallback(() => {
  resetSimState();
  const jobId = nextWorkerJobId();
  stopRef.current = false;
  setSimRun(true);
  workerRef.current?.postMessage({
    type: "runSim",
    jobId,
    customConfigs,
    simB0,
    simB1,
    numSims,
    useStabilized,
    stabilizeDecimals,
  });
}, [customConfigs, nextWorkerJobId, numSims, resetSimState, simB0, simB1, stabilizeDecimals, useStabilized]);

const runTournament = useCallback(() => {
  if (new Set(tourBots).size < 4) return;
  cancelActiveWorkerJob();
  const jobId = nextWorkerJobId();
  const initialResults = createEmptyTournamentResults();
  const initialSnapshots = createEmptyTourMatchSnapshots();
  const firstMatch = TOURNAMENT_FIXTURE[0] ?? null;
  if (firstMatch) initialSnapshots[firstMatch.flatIndex] = buildTournamentMatchSnapshot(firstMatch, initialResults, "running");
  stopTourRef.current = false;
  setTourRunning(true);
  setTourProgress(0);
  setTourCurrentMatch(firstMatch);
  setTourCurrentStats(firstMatch ? initialSnapshots[firstMatch.flatIndex] : null);
  setTourResults(initialResults);
  setTourMatchSnapshots(initialSnapshots);
  workerRef.current?.postMessage({
    type: "runTournament",
    jobId,
    customConfigs,
    tourBots,
    numSims,
    useStabilized: tourUseStabilized,
    stabilizeDecimals: tourStabilizeDecimals,
  });
}, [cancelActiveWorkerJob, customConfigs, nextWorkerJobId, numSims, tourBots, tourStabilizeDecimals, tourUseStabilized]);

const runBenchmark = useCallback((cfg) => {
  cancelActiveWorkerJob();
  const jobId = nextWorkerJobId();
  setBenchmarking(cfg.id);
  workerRef.current?.postMessage({
    type: "runBenchmark",
    jobId,
    customConfigs,
    botId: cfg.id,
  });
}, [cancelActiveWorkerJob, customConfigs, nextWorkerJobId]);

// -- Match viewer --
const replay = useMemo(() => replayPair ? (matchRound === "A" ? replayPair.replayA : replayPair.replayB) : null, [matchRound, replayPair]);
const matchSwapped = matchRound === "B";
const newReplay = () => { autoRef.current = false; setAutoP(false); setReplayPair(generateReplayPair(customConfigs, mvB0, mvB1)); setMatchRound("A"); setSi(0); };
const switchMR = (r) => { autoRef.current = false; setAutoP(false); setMatchRound(r); setSi(0); };
const mNext = useCallback(() => setSi(p => replay ? Math.min(p + 1, replay.length - 1) : p), [replay]);
const mPrev = () => setSi(p => Math.max(p - 1, 0));
const mFirst = () => setSi(0);
const mLast = () => { if (replay) setSi(replay.length - 1); };
const togAuto = () => { autoRef.current = !autoP; setAutoP(!autoP); };
useEffect(() => {
if (!autoP || !replay) return;
const iv = setInterval(() => {
if (!autoRef.current) { clearInterval(iv); return; }
setSi(p => { if (p >= replay.length - 1) { autoRef.current = false; setAutoP(false); clearInterval(iv); return p; } return p + 1; });
}, 1200);
return () => clearInterval(iv);
}, [autoP, replay]);

// -- Play --
const startGame = (bi) => { setBotChoice(bi); const gs = initRound([0, 0], 0); setG(gs); setHistory([]); setShowBot(false); };
const playerDraw = (src) => {
if (!g || g.phase !== "playerDraw" || g.turn !== 0) return;
const ng = { ...g, pHand: [...g.pHand], deck: [...g.deck], discardPile: [...g.discardPile] };
let card;
if (src === "discard" && ng.discardPile.length) card = ng.discardPile.pop(); else if (ng.deck.length) card = ng.deck.pop(); else return;
ng.pHand.push(card); ng.drawnCard = card; ng.phase = "playerDiscard"; ng.selectedIdx = null; ng.message = null; setG(ng);
};
const reorderHand = useCallback((fromIdx, toIdx) => {
if (!g || g.turn !== 0) return;
if (g.phase !== "playerDraw" && g.phase !== "playerDiscard") return;
if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
const nextHand = [...g.pHand];
const [moved] = nextHand.splice(fromIdx, 1);
if (!moved) return;
nextHand.splice(toIdx, 0, moved);
setG({ ...g, pHand: nextHand, selectedIdx: null });
}, [g]);
const playerDiscardWithIdx = (idx) => {
if (!g || g.phase !== "playerDiscard") return;
const ng = { ...g, pHand: [...g.pHand], discardPile: [...g.discardPile] };
if (isJoker(ng.pHand[idx])) { setG({ ...g, message: "No podés descartar comodines" }); return; }
const disc = ng.pHand.splice(idx, 1)[0]; ng.discardPile.push(disc);
ng.selectedIdx = null; ng.drawnCard = null; ng.phase = "botTurn"; ng.turn = 1; ng.message = null; ng.cutMode = false; setG(ng);
};
const playerCutWithIdx = (idx) => {
if (!g || g.phase !== "playerDiscard") return;
if (isJoker(g.pHand[idx])) { setG({ ...g, message: "No podés cortar tirando un comodín" }); return; }
const testHand = g.pHand.filter((_, i) => i !== idx);
const f7 = findBestMelds(testHand);
if (f7.minFree > 1) { setG({ ...g, message: "No podés cortar — más de 1 carta suelta" }); return; }
if (f7.resto > 5) { setG({ ...g, message: "No podés cortar — el resto supera 5 puntos" }); return; }
const ng = { ...g, pHand: [...g.pHand], discardPile: [...g.discardPile] };
const disc = ng.pHand.splice(idx, 1)[0]; ng.discardPile.push(disc);
const cs = cutScore(ng.pHand); const bM = findBestMelds(ng.bHand);
ng.phase = "roundEnd"; ng.drawnCard = null; ng.selectedIdx = null; ng.cutMode = false;
ng.roundResult = { cutter: "player", pScore: cs.score, bScore: bM.resto, chinchon: cs.chinchon };
setG(ng);
};
const selectCard = (i) => {
if (!g || g.phase !== "playerDiscard") return;
if (g.cutMode) { playerCutWithIdx(i); } else { playerDiscardWithIdx(i); }
};
const toggleCutMode = () => { if (!g) return; setG({ ...g, cutMode: !g.cutMode, message: null }); };
const sortHand = (mode) => {
if (!g) return;
const sorted = mode === "suit" ? sortBySuit(g.pHand) : sortByRank(g.pHand);
setG({ ...g, pHand: sorted, selectedIdx: null });
};
useEffect(() => {
if (!g || g.phase !== "botTurn" || botChoice === null) return;
const t = setTimeout(() => setG(botTakeTurn(g, BOT[botChoice])), 800);
return () => clearTimeout(t);
}, [g?.phase, botChoice]);
const nextRound = () => {
if (!g || !g.roundResult) return;
const r = g.roundResult;
if (r.chinchon) {
// Chinchón = instant game win
const winner = r.cutter === "player" ? 0 : 1;
const ns = [...g.scores]; ns[1 - winner] = 999;
setHistory(h => [...h, { pScore: r.pScore, bScore: r.bScore, cutter: r.cutter, chinchon: true }]);
setG({ ...g, phase: "gameOver", scores: ns }); return;
}
const ns = [g.scores[0] + r.pScore, g.scores[1] + r.bScore];
setHistory(h => [...h, { pScore: r.pScore, bScore: r.bScore, cutter: r.cutter, chinchon: false }]);
if (ns[0] >= 100 || ns[1] >= 100) { setG({ ...g, phase: "gameOver", scores: ns }); return; }
const ng = initRound(ns, g.dealer === 0 ? 1 : 0); setG(ng);
};
const resetGame = () => { setG(null); setBotChoice(null); setHistory([]); };

// Derived
const step = useMemo(() => replay?.[si], [replay, si]);
const isLast = replay && si >= replay.length - 1;
const total = gameWins[0] + gameWins[1];
const totalR = totalRounds;
let canPlayerCut = false;
if (g?.phase === "playerDiscard" && g.pHand.length <= 8) {
canPlayerCut = g.pHand.some((c, i) => {
if (isJoker(c)) return false;
const test = g.pHand.filter((_, j) => j !== i);
const m = findBestMelds(test);
return m.minFree <= 1 && m.resto <= 5;
});
}
const pML = useMemo(() => g?.pHand ? findBestMelds(g.pHand) : null, [g?.pHand]);
const bML = useMemo(() => g?.bHand ? findBestMelds(g.bHand) : null, [g?.bHand]);
const topD = g?.discardPile?.length ? g.discardPile[g.discardPile.length - 1] : null;
const mvBots = [BOT[mvB0], BOT[mvB1]];
const bn = (slot) => matchSwapped ? mvBots[slot === 0 ? 1 : 0] : mvBots[slot];
const safeTourResults = useMemo(
  () => (isValidTournamentResults(tourResults) ? tourResults : null),
  [tourResults],
);
const tournamentCeremony = useMemo(
  () => {
    if (!safeTourResults) return null;
    try {
      return buildTournamentCeremonyData(safeTourResults);
    } catch {
      return null;
    }
  },
  [safeTourResults],
);
const liveRegionMessage = useMemo(() => {
if (simRun) return `Simulación en curso: ${prog}% completado.`;
if (tourRunning && tourCurrentMatch) return `Torneo en curso: fecha ${tourCurrentMatch.fechaIndex + 1}, partido ${tourCurrentMatch.matchIndex + 1}.`;
if (tab === "torneo" && tourProgress === 100 && safeTourResults) return "Torneo finalizado. Ya podés pasar a resultados.";
if (tab === "match" && replay) return `Replay listo. Paso ${si + 1} de ${replay.length}.`;
if (benchmarking) return "Benchmark de bot en curso.";
return "Chinchón Lab listo.";
}, [benchmarking, prog, replay, safeTourResults, si, simRun, tab, tourCurrentMatch, tourProgress, tourRunning]);

return (
<main id="main-content" className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center px-3 py-5 font-sans chinchon-lab-page">
  <header className="lab-hero" aria-label="Encabezado de Chinchón Lab">
    <h1 className="lab-hero__title">
      Chinchón Lab <span className="lab-hero__title-mark" aria-hidden="true">🧪</span>
    </h1>
    <p className="lab-hero__subtitle">Arena de bots 🤖, partidas espejo 🪞 y torneos 🏆 con mucha aura ✨.</p>
  </header>
  <div className="lab-status sr-only" aria-live="polite">{liveRegionMessage}</div>

  <LabTabBar current={tab} onChange={handleTabChange} tabs={LAB_TABS} />

  {/* --- SIM --- */}
  {tab === "sim" && (
    <LabPanel
      title="Simulación"
      subtitle="Configurá el cruce, corré miles de partidas espejo y seguí el progreso sin congelar la UI."
    >
    <div className="lab-workspace">
      <div className="lab-config-grid mb-4 w-full">
        <BotLineupPicker
          title="Elegí el cruce"
          subtitle="Una sola lista, dos seleccionados y orden visual de enfrentamiento."
          labels={["Bot 1", "Bot 2"]}
          values={[simB0, simB1]}
          onChange={(next) => { setSimB0(next[0]); setSimB1(next[1]); resetSimState(); }}
          disabled={simRun}
        />
        <SimulationCountPicker
          label="Simulaciones"
          value={numSims}
          onChange={setNumSims}
          disabled={simRun}
          tone="emerald"
          useStabilized={useStabilized}
          onUseStabilizedChange={setUseStabilized}
          stabilizeDecimals={stabilizeDecimals}
          onStabilizeDecimalsChange={setStabilizeDecimals}
          stabilizedCopy={`Se corta solo si el winrate truncado a ${stabilizeDecimals} ${stabilizeDecimals === 1 ? "decimal" : "decimales"} no cambia durante ${STABLE_SIMULATION_STREAK} simulaciones seguidas.`}
        />
      </div>
      <div className="flex flex-col items-center gap-2 mb-2 w-full">
        <StickyActionBar>
        {!simRun ? (
          <div className="flex gap-2 mt-1 flex-wrap justify-center">
            <button onClick={runSim} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-1.5 rounded-md text-sm font-semibold active:scale-95">
              {useStabilized
                ? `Simular hasta ${numSims >= 1000 ? `${numSims / 1000}k` : numSims} o estabilizar`
                : `Simular ${numSims >= 1000 ? `${numSims / 1000}k` : numSims} simulaciones`}
            </button>
          </div>
        ) : <button onClick={resetSimState} className="bg-red-600 hover:bg-red-500 text-white px-5 py-1.5 rounded-md text-sm font-semibold mt-1">Parar ({prog}%)</button>}
        </StickyActionBar>
      </div>
      <div className="lab-copy-note mb-3 text-center">Cada simulación son 2 partidas espejo con la misma repartida e inversión de manos. Si aparece chinchón, la partida termina al instante.</div>
      {simRun && <div className="w-full h-1 bg-gray-800 rounded-full mb-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 transition-all" style={{ width: `${prog}%` }} /></div>}

      {total > 0 && (
        <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <h2 className="text-xs text-gray-500 text-center mb-3 uppercase tracking-wider">Partidas ganadas</h2>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1"><div className="text-3xl font-bold" style={{ color: BOT[simB0].color }}>{gameWins[0]}</div><div className="text-xs text-gray-500">{((gameWins[0] / total) * 100).toFixed(4)}%</div><div className="text-xs mt-0.5" style={{ color: BOT[simB0].color }}>{BOT[simB0].name}</div></div>
            <div className="text-center px-3"><div className="text-xs text-gray-600">{total} partidas</div><div className="text-gray-700 text-xl">-</div></div>
            <div className="text-center flex-1"><div className="text-3xl font-bold" style={{ color: BOT[simB1].color }}>{gameWins[1]}</div><div className="text-xs text-gray-500">{((gameWins[1] / total) * 100).toFixed(4)}%</div><div className="text-xs mt-0.5" style={{ color: BOT[simB1].color }}>{BOT[simB1].name}</div></div>
          </div>
        </div>
      )}

      {totalR > 0 && (
        <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
          <h2 className="text-xs text-gray-500 text-center mb-2 uppercase tracking-wider">Rondas ganadas</h2>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1"><div className="text-lg font-bold" style={{ color: BOT[simB0].color }}>{roundWins[0]}</div><div className="text-xs text-gray-500">{((roundWins[0] / totalR) * 100).toFixed(4)}%</div></div>
            <div className="text-center px-3"><div className="text-xs text-gray-600">{totalR} rondas</div></div>
            <div className="text-center flex-1"><div className="text-lg font-bold" style={{ color: BOT[simB1].color }}>{roundWins[1]}</div><div className="text-xs text-gray-500">{((roundWins[1] / totalR) * 100).toFixed(4)}%</div></div>
          </div>
        </div>
      )}

      {(sweepWins[0] + sweepWins[1] + sweepWins[2]) > 0 && (
        <div className="w-full bg-gray-900 border border-yellow-900/50 rounded-lg p-3 mb-4">
          <h2 className="text-xs text-yellow-600 text-center mb-1 uppercase tracking-wider">Doble espejo ganado</h2>
          <p className="text-xs text-gray-600 text-center mb-3">Gana ambas partidas de la misma simulación espejo</p>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-lg font-bold" style={{ color: BOT[simB0].color }}>{sweepWins[0]}</div>
              <div className="text-xs text-gray-500">{(sweepWins[0] + sweepWins[1] + sweepWins[2]) > 0 ? ((sweepWins[0] / (sweepWins[0] + sweepWins[1] + sweepWins[2])) * 100).toFixed(4) : "0.0000"}%</div>
            </div>
            <div className="text-center px-3">
              <div className="text-xs text-gray-500">{sweepWins[2]} empates</div>
              <div className="text-xs text-gray-600">{sweepWins[0] + sweepWins[1] + sweepWins[2]} simulaciones</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-lg font-bold" style={{ color: BOT[simB1].color }}>{sweepWins[1]}</div>
              <div className="text-xs text-gray-500">{(sweepWins[0] + sweepWins[1] + sweepWins[2]) > 0 ? ((sweepWins[1] / (sweepWins[0] + sweepWins[1] + sweepWins[2])) * 100).toFixed(4) : "0.0000"}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Combined charts panel — always visible */}
      {(() => {
        const winData = winRateHistory.map(d => ({ x: d.simulations, y0: d.rate0, y1: d.rate1 }));
        const sweepData = sweepRateHistory.map(d => ({ x: d.pairs, y0: d.rate0, y1: d.rate1 }));
        const activeData = chartTab === "winrate" ? winData : sweepData;
        const sliced = chartZoom ? activeData.slice(-chartZoom) : activeData;
        const ZOOM_OPTS: (number | null)[] = [null, 200, 100, 50, 20];
        return (
          <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4">
            {/* Header row: tabs left, zoom right */}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="lab-segmented">
                <button onClick={() => setChartTab("winrate")}
                  aria-pressed={chartTab === "winrate"}
                  className="lab-segmented__button">
                  Winrate
                </button>
                <button onClick={() => setChartTab("sweep")}
                  aria-pressed={chartTab === "sweep"}
                  className="lab-segmented__button">
                  Corridas espejo
                </button>
              </div>
              <div className="lab-chip-row">
                <span className="text-xs text-gray-600 mr-1">Zoom:</span>
                {ZOOM_OPTS.map(z => (
                  <button key={z ?? "all"} onClick={() => setChartZoom(z)}
                    aria-pressed={chartZoom === z}
                    className="lab-chip-button">
                    {z === null ? "Todo" : z}
                  </button>
                ))}
              </div>
            </div>
            <p className="lab-copy-note text-center mb-2">
              {chartTab === "winrate"
                ? "Winrate acumulado por simulación espejo. Si los porcentajes truncados dejan de moverse, la muestra ya alcanzó estabilidad."
                : "% de simulaciones donde cada bot gana ambas partidas espejo (sin empates)"}
            </p>
            <RateChart data={sliced} bot0={BOT[simB0]} bot1={BOT[simB1]} />
            <div className="flex justify-center gap-4 mt-1.5 text-xs">
              <span className="inline-flex items-center gap-1" style={{ color: BOT[simB0].color }}>
                <span className="rounded" style={{ width: "10px", height: "2px", background: BOT[simB0].color, display: "inline-block" }} />
                {BOT[simB0].name}
              </span>
              <span className="inline-flex items-center gap-1" style={{ color: BOT[simB1].color }}>
                <span className="rounded" style={{ width: "10px", height: "2px", background: BOT[simB1].color, display: "inline-block" }} />
                {BOT[simB1].name}
              </span>
            </div>
          </div>
        );
      })()}

      {(chinchonWins[0] + chinchonWins[1]) > 0 && (
        <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
          <h2 className="text-xs text-gray-500 text-center mb-2 uppercase tracking-wider">Chinchones</h2>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-lg font-bold" style={{ color: BOT[simB0].color }}>{chinchonWins[0]}</div>
              <div className="text-xs text-gray-500">{getChinchonWinRate(chinchonWins[0], gameWins[0]).toFixed(4)}% de sus victorias</div>
            </div>
            <div className="text-center px-3 text-xs text-gray-600">🏆 sobre victorias</div>
            <div className="text-center flex-1">
              <div className="text-lg font-bold" style={{ color: BOT[simB1].color }}>{chinchonWins[1]}</div>
              <div className="text-xs text-gray-500">{getChinchonWinRate(chinchonWins[1], gameWins[1]).toFixed(4)}% de sus victorias</div>
            </div>
          </div>
        </div>
      )}

      {totalRounds > 0 && (
        <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
          <h2 className="text-xs text-gray-500 text-center mb-2 uppercase tracking-wider">Duración promedio</h2>
          <div className="flex justify-center gap-6 text-center">
            <div>
              <div className="text-lg font-bold text-gray-200">{((gameWins[0] + gameWins[1]) > 0 ? totalRounds / (gameWins[0] + gameWins[1]) : 0).toFixed(1)}</div>
              <div className="text-xs text-gray-500">rondas / partida</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-200">{(totalRounds > 0 ? (roundWins[0] + roundWins[1]) / totalRounds * 100 : 0).toFixed(0)}%</div>
              <div className="text-xs text-gray-500">rondas con corte</div>
            </div>
          </div>
        </div>
      )}

      {chartData?.length > 0 && (
        <div className="w-full bg-gray-900 rounded-xl border border-gray-800 p-3 mb-4">
          <h2 className="text-xs text-gray-400 text-center mb-2">Cartas agarradas por ronda</h2>
          <DrawsBarChart data={chartData} botA={BOT[simB0]} botB={BOT[simB1]} />
        </div>
      )}

      <div className="w-full flex flex-col items-center gap-2 mb-4">
        {total > 0 && (
          <button onClick={() => {
            const prompt = generateSimPrompt(
              getBotConfig(simB0, customConfigs),
              getBotConfig(simB1, customConfigs),
              { gameWins, roundWins, sweepWins, chinchonWins, totalRounds, numSims }
            );
            navigator.clipboard.writeText(prompt);
            setPromptCopied(true);
            setTimeout(() => setPromptCopied(false), 3000);
          }} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors active:scale-95">
            {promptCopied ? "✓ Copiado" : "🤖 Analizar resultados con LLM"}
          </button>
        )}
        <button onClick={() => {
          const simContext = total > 0 ? generateSimPrompt(
            getBotConfig(simB0, customConfigs),
            getBotConfig(simB1, customConfigs),
            { gameWins, roundWins, sweepWins, chinchonWins, totalRounds, numSims }
          ) : undefined;
          navigator.clipboard.writeText(generateNewBotPrompt(simContext));
          setNewBotPromptCopied(true);
          setTimeout(() => setNewBotPromptCopied(false), 3000);
        }} className="flex items-center gap-2 bg-violet-900 hover:bg-violet-800 border border-violet-700 hover:border-violet-500 text-violet-200 hover:text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors active:scale-95">
          {newBotPromptCopied ? "✓ Copiado" : "🧬 Generar nuevo bot con LLM"}
        </button>
        {total > 0 && <p className="text-xs text-gray-600 text-center">Usá ambos prompts juntos: primero el análisis, después el generador</p>}
      </div>

      {!chartData && !simRun && <div className="text-gray-600 mt-6 text-sm">Elegí los bots y dale a <span className="text-emerald-500">Simular</span></div>}
    </div>
    </LabPanel>
  )}

  {/* --- MATCH --- */}
  {tab === "match" && (
    <LabPanel
      title="Ver partida"
      subtitle="Replay espejo paso a paso para inspeccionar decisiones, robos y cortes."
    >
    <div className="lab-workspace lab-workspace--compact">
      <BotLineupPicker
        title="Elegí la partida a inspeccionar"
        subtitle="Marcá dos bots y después generá una repartida espejo para mirar paso a paso."
        labels={["Bot 1", "Bot 2"]}
        values={[mvB0, mvB1]}
        onChange={(next) => { setMvB0(next[0]); setMvB1(next[1]); setReplayPair(null); }}
      />
      <div className="lab-inline-actions">
        <button onClick={newReplay} className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-1.5 rounded-md text-sm font-semibold active:scale-95">Nueva repartida</button>
      </div>
      {!replayPair && <div className="w-full text-gray-600 text-sm">Dale a <span className="text-amber-400">Nueva repartida</span></div>}
      {replayPair && replay && step && (
        <div className="w-full">
          <div className="flex items-center justify-center gap-1 mb-3">
            <div className="flex bg-gray-900 rounded-lg p-0.5">
              <button onClick={() => switchMR("A")} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${matchRound === "A" ? "text-white" : "text-gray-500"}`}
                style={matchRound === "A" ? { background: mvBots[0].color + "30" } : {}}>Ronda A - {mvBots[0].name} empieza</button>
              <button onClick={() => switchMR("B")} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${matchRound === "B" ? "text-white" : "text-gray-500"}`}
                style={matchRound === "B" ? { background: mvBots[1].color + "30" } : {}}>Ronda B - {mvBots[1].name} empieza</button>
            </div>
          </div>
          <div className="text-center text-xs text-gray-600 mb-2">Misma repartida, manos invertidas</div>

          {/* Step counter + controls together */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <button aria-label="Ir al primer paso" onClick={mFirst} disabled={si === 0} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white px-2 py-1 rounded text-xs font-medium">⏮</button>
            <button aria-label="Ir al paso anterior" onClick={mPrev} disabled={si === 0} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white px-2 py-1 rounded text-xs font-medium">◀</button>
            <span className="text-xs text-gray-500 w-16 text-center">{si + 1} / {replay.length}</span>
            <button aria-label="Ir al siguiente paso" onClick={mNext} disabled={isLast} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white px-2 py-1 rounded text-xs font-medium">▶</button>
            <button aria-label="Ir al último paso" onClick={mLast} disabled={isLast} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white px-2 py-1 rounded text-xs font-medium">⏭</button>
            <button aria-label={autoP ? "Pausar reproducción automática" : "Iniciar reproducción automática"} onClick={togAuto} className={`px-2 py-1 rounded text-xs font-medium ${autoP ? "bg-red-700" : "bg-amber-700"} text-white`}>{autoP ? "⏸" : "▶ Auto"}</button>
          </div>

          {/* Event box */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 mb-3 text-center min-h-[48px] flex items-center justify-center text-sm">
            {step.type === "deal" && <span className="text-gray-300">Reparto: <span className="text-white font-bold">8</span> cartas al que empieza, <span className="text-white font-bold">7</span> al segundo</span>}
            {step.type === "initial_discard" && (
              <div>
                <span className="font-bold" style={{ color: bn(step.player).color }}>{bn(step.player).name}</span>
                <span className="text-gray-400"> descarta de entrada </span><span className="inline-flex align-middle mx-0.5"><CardC card={step.discarded} small highlight="discarded" /></span>
                <div className="text-xs text-gray-600 mt-0.5">Sueltas: {step.freeCards}</div>
              </div>
            )}
            {step.type === "turn" && (
              <div>
                <span className="font-bold" style={{ color: bn(step.player).color }}>{bn(step.player).name}</span>
                <span className="text-gray-400"> agarra </span><span className="inline-flex align-middle mx-0.5"><CardC card={step.card} small /></span>
                {step.kept ? <><span className="text-emerald-400"> se la queda</span><span className="text-gray-400">, descarta <span className="inline-flex align-middle mx-0.5"><CardC card={step.discarded} small highlight="discarded" /></span></span></>
                  : <span className="text-red-400"> no le sirve</span>}
                <div className="text-xs text-gray-600 mt-0.5">Sueltas: {step.freeCards} · Agarradas: {step.drawn[step.player]}</div>
              </div>
            )}
            {step.type === "cut" && (
              <div>
                {step.chinchon && <div className="text-lg">🏆</div>}
                <span className="font-bold" style={{ color: bn(step.player).color }}>{bn(step.player).name}</span>
                <span className="text-yellow-400 font-bold">{step.chinchon ? " ¡CHINCHÓN! Gana la partida" : step.score === -10 ? " ¡CORTA! (-10)" : " ¡CORTA!"}</span>
                {step.card && <div className="text-xs text-gray-500 mt-0.5">{step.drawn[step.player]} carta{step.drawn[step.player] !== 1 ? "s" : ""} del mazo</div>}
                {!step.card && <div className="text-xs text-gray-500">¡De entrada!</div>}
              </div>
            )}
            {step.type === "timeout" && (
              <div><span className="text-gray-400">Mazo vacío - </span><span className="font-bold" style={{ color: bn(step.winner).color }}>{bn(step.winner).name}</span><span className="text-gray-400"> gana</span></div>
            )}
          </div>

          {/* Hands */}
          {(matchSwapped ? [1, 0] : [0, 1]).map(slot => {
            const bot = bn(slot); const isAct = (step.type === "turn" || step.type === "cut" || step.type === "initial_discard") && step.player === slot;
            return (
              <div key={slot} className="mb-2">
                <HandRow hand={step.hands[slot]} meldsData={step.melds[slot]} drawnCard={isAct && step.kept ? step.card : null}
                  label={bot.emoji + " " + bot.name} color={bot.text} bgClass={bot.bg} borderClass={bot.border} />
              </div>
            );
          })}
        </div>
      )}
    </div>
    </LabPanel>
  )}

  {/* --- PLAY --- */}
  {tab === "play" && (
    <LabPanel
      title="Jugar"
      subtitle="Modo práctica contra bots, con historial de rondas y ayudas de lectura para la mano."
    >
    <div className="lab-workspace lab-workspace--compact">
      {!g && (
        <div className="w-full">
          <p className="text-gray-400 text-sm mb-4">Elegí tu rival:</p>
          <div className="lab-card-grid">
            {BOT.map((b, i) => (
              <button key={i} onClick={() => startGame(i)} className={`${b.bg} border ${b.border} rounded-lg px-4 py-3 transition-all hover:scale-105 active:scale-95 w-full text-left`}>
                <div className="font-bold text-sm mb-0.5" style={{ color: b.color }}>{b.emoji} {b.name}</div>
                <div className="text-gray-400 text-xs">{b.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {g && botChoice !== null && (
        <PlayGame g={g} bot={BOT[botChoice]} history={history} showBot={showBot} bML={bML} pML={pML} topD={topD}
          canPlayerCut={canPlayerCut} setShowBot={setShowBot} playerDraw={playerDraw}
          selectCard={selectCard} nextRound={nextRound} resetGame={resetGame} sortHand={sortHand} toggleCutMode={toggleCutMode}
          reorderHand={reorderHand} />
      )}
    </div>
    </LabPanel>
  )}

  {/* --- TORNEO --- */}
  {tab === "torneo" && (() => {
    const hasTournamentResults = safeTourResults !== null;
    const fallbackCeremony = buildTournamentCeremonyData(createEmptyTournamentResults());
    const {
      botTotals,
      rankingWins,
      rankingMirror,
      rankingChinchon,
      beatAllAwardWinner,
      lostToEveryoneAward,
      noRiskBots,
      everyoneShouldWinPrizeBots,
      ceremonyRanking,
      ceremonyChampion,
      winsAwardWinner,
      chinchonAwardWinner,
      mirrorAwardWinner,
    } = tournamentCeremony ?? fallbackCeremony;
    const isDone = !tourRunning && tourProgress === 100 && hasTournamentResults;
    const medals = ["🥇", "🥈", "🥉", "🗑️"];
    const slots = tourBots.map((_, idx) => idx);
    const goodAwardCards = [
      {
        key: "wins",
        title: "Mayor ganador",
        subtitle: "2 pts al primero, el resto nada",
        emoji: "👑",
        accent: "#fbbf24",
        winners: [{ idx: winsAwardWinner.idx, detail: `${winsAwardWinner.wins} victorias totales` }],
      },
      {
        key: "chinchones",
        title: "Farmeada de Aura",
        subtitle: "Reconocimiento + 2 pts",
        emoji: "✨",
        accent: "#a78bfa",
        winners: [{ idx: chinchonAwardWinner.idx, detail: `${chinchonAwardWinner.chinchones} chinchones` }],
      },
      {
        key: "mirror",
        title: "Más Letal",
        subtitle: "4 pts al primero, 2 pts al segundo",
        emoji: "⚔️",
        accent: "#f87171",
        winners: [{ idx: mirrorAwardWinner.idx, detail: `${mirrorAwardWinner.mirrorWins} espejos ganados` }],
      },
      beatAllAwardWinner ? {
        key: "beat-all",
        title: "Aquel que le ganó a todos",
        subtitle: "Reconocimiento + 2 pts",
        emoji: "🧨",
        accent: "#34d399",
        winners: [{ idx: beatAllAwardWinner.idx, detail: "Ganó su head-to-head contra todos" }],
      } : null,
    ].filter(Boolean);
    const badAwardCards = [
      lostToEveryoneAward ? {
        key: "lost-all",
        title: "Bolsa de boxeo",
        subtitle: "La gastada oficial del torneo",
        emoji: "🥊",
        accent: "#fb7185",
        winners: [{ idx: lostToEveryoneAward.idx, detail: "Perdió contra todos" }],
      } : null,
      noRiskBots.length > 0 ? {
        key: "no-risk",
        title: "No se arriesga",
        subtitle: "Terminó con 0 chinchones",
        emoji: "🧱",
        accent: "#f87171",
        winners: noRiskBots.map((entry) => ({ idx: entry.idx, detail: "0 chinchones en todo el torneo" })),
      } : null,
      everyoneShouldWinPrizeBots.length > 0 ? {
        key: "participation",
        title: "Todos deberían ganar un premio",
        subtitle: "No ligó ni una buena ni una mala mención",
        emoji: "🪑",
        accent: "#ef4444",
        winners: everyoneShouldWinPrizeBots.map((entry) => ({ idx: entry.idx, detail: "Pasó desapercibido" })),
      } : null,
    ].filter(Boolean);
    const ceremonyRunnerUp = ceremonyRanking[1] ?? null;
    const championReasonItems = [
      ceremonyChampion.winsPoints > 0 ? `Se quedó con Mayor ganador (+${ceremonyChampion.winsPoints}).` : null,
      ceremonyChampion.mirrorPoints > 0
        ? `${ceremonyChampion.wonMasLetal ? "Ganó" : "Sumó desde"} Más Letal (+${ceremonyChampion.mirrorPoints}).`
        : null,
      ceremonyChampion.auraPoints > 0 ? `Farmeó aura con ${botTotals[ceremonyChampion.idx].chinchones} chinchones (+${ceremonyChampion.auraPoints}).` : null,
      ceremonyChampion.beatAllPoints > 0 ? `Ganó el grupo completo en los cruces directos (+${ceremonyChampion.beatAllPoints}).` : null,
      ceremonyRunnerUp && ceremonyRunnerUp.score === ceremonyChampion.score
        ? `Desempató por el duelo directo ante ${BOT[tourBots[ceremonyRunnerUp.idx]].emoji} ${BOT[tourBots[ceremonyRunnerUp.idx]].name}.`
        : null,
    ].filter(Boolean);

    return (
      <LabPanel
        title="Torneo"
        subtitle="Fixture por fechas, resultados parciales en vivo y ceremonia final cuando termina todo el grupo."
      >
      <div className="lab-workspace">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Torneo todos contra todos</h2>
        <p className="text-xs text-gray-600 mb-4 text-center">3 fechas estilo fase de grupos FIFA · 6 enfrentamientos para encontrar al mejor bot</p>

        <div className="lab-config-grid mb-4 w-full">
          <BotLineupPicker
            title="Armá el grupo"
            subtitle="Una sola lista con 4 cupos. Tocá un cupo arriba y luego el bot que querés asignar."
            labels={["Bot 1", "Bot 2", "Bot 3", "Bot 4"]}
            values={tourBots}
            onChange={(next) => { resetTournamentState(); setTourBots(next); }}
            disabled={tourRunning}
          />
          <SimulationCountPicker
            label="Simulaciones por cruce"
            value={numSims}
            onChange={setNumSims}
            disabled={tourRunning}
            tone="amber"
            useStabilized={tourUseStabilized}
            onUseStabilizedChange={setTourUseStabilized}
            stabilizeDecimals={tourStabilizeDecimals}
            onStabilizeDecimalsChange={setTourStabilizeDecimals}
            stabilizedCopy={`Cada cruce se corta solo si el winrate truncado a ${tourStabilizeDecimals} ${tourStabilizeDecimals === 1 ? "decimal" : "decimales"} no cambia durante ${STABLE_SIMULATION_STREAK} simulaciones seguidas.`}
          />
        </div>

        <div className="lab-note-card mb-4">
          <p className="text-center">
            Cada fecha juega sus cruces con el mismo reglamento, y el modo estabilizado corta antes si el resultado ya quedó planchado.
          </p>
        </div>

        {/* Start/Stop */}
        <StickyActionBar>
        {!tourRunning ? (
          <button onClick={runTournament}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg text-sm font-bold mb-3 active:scale-95 transition-all">
            🏆 Iniciar torneo {tourUseStabilized ? 'estabilizado' : ''}
          </button>
        ) : (
          <button onClick={resetTournamentState}
            className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-bold mb-3">
            Parar ({tourProgress}%)
          </button>
        )}
        </StickyActionBar>

        {/* Progress bar */}
        {(tourRunning || (tourProgress > 0 && tourProgress < 100)) && (
          <div className="w-full h-1.5 bg-gray-800 rounded-full mb-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
              style={{ width: `${tourProgress}%` }} />
          </div>
        )}

        {/* Current matchup status */}
        {tourRunning && tourCurrentMatch && (
          <div className="lab-copy-note mb-3 text-center">
            Corriendo Fecha {tourCurrentMatch.fechaIndex + 1} · Partido {tourCurrentMatch.matchIndex + 1}:{" "}
            <span style={{ color: BOT[tourBots[tourCurrentMatch.aSlot]].color }}>
              {BOT[tourBots[tourCurrentMatch.aSlot]].emoji} {BOT[tourBots[tourCurrentMatch.aSlot]].name}
            </span>
            {" vs "}
            <span style={{ color: BOT[tourBots[tourCurrentMatch.bSlot]].color }}>
              {BOT[tourBots[tourCurrentMatch.bSlot]].emoji} {BOT[tourBots[tourCurrentMatch.bSlot]].name}
            </span>
          </div>
        )}
        {tourRunning && tourCurrentStats && tourCurrentMatch && (
          <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2 text-center">Enfrentamiento actual</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-gray-800/70 rounded p-2">
                <div className="text-gray-500">Partidas</div>
                <div className="text-gray-200 font-mono">{tourCurrentStats.games}</div>
              </div>
              <div className="bg-gray-800/70 rounded p-2">
                <div className="text-gray-500">Victorias</div>
                <div className="font-mono">
                  <span style={{ color: BOT[tourBots[tourCurrentMatch.aSlot]].color }}>{tourCurrentStats.wins[0]}</span>
                  <span className="text-gray-500"> - </span>
                  <span style={{ color: BOT[tourBots[tourCurrentMatch.bSlot]].color }}>{tourCurrentStats.wins[1]}</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  {tourCurrentStats.winPct[0].toFixed(2)}% · {tourCurrentStats.winPct[1].toFixed(2)}%
                </div>
              </div>
              <div className="bg-gray-800/70 rounded p-2">
                <div className="text-gray-500">Victorias espejo</div>
                <div className="font-mono">
                  <span style={{ color: BOT[tourBots[tourCurrentMatch.aSlot]].color }}>{tourCurrentStats.mirrorWins[0]}</span>
                  <span className="text-gray-500"> - </span>
                  <span style={{ color: BOT[tourBots[tourCurrentMatch.bSlot]].color }}>{tourCurrentStats.mirrorWins[1]}</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  {tourCurrentStats.mirrorPct[0].toFixed(2)}% · {tourCurrentStats.mirrorPct[1].toFixed(2)}%
                </div>
              </div>
              <div className="bg-gray-800/70 rounded p-2">
                <div className="text-gray-500">Chinchones</div>
                <div className="font-mono">
                  <span style={{ color: BOT[tourBots[tourCurrentMatch.aSlot]].color }}>{tourCurrentStats.chinchones[0]}</span>
                  <span className="text-gray-500"> - </span>
                  <span style={{ color: BOT[tourBots[tourCurrentMatch.bSlot]].color }}>{tourCurrentStats.chinchones[1]}</span>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {[tourCurrentMatch.aSlot, tourCurrentMatch.bSlot].map((slot, idx) => {
                const bot = BOT[tourBots[slot]];
                const totals = tourCurrentStats.totals[idx];
                return (
                  <div key={slot} className="bg-gray-800/70 rounded p-2 text-xs">
                    <div className="font-semibold mb-1" style={{ color: bot.color }}>{bot.emoji} {bot.name}</div>
                    <div className="text-gray-400">Victorias totales: <span className="font-mono" style={{ color: bot.color }}>{totals.wins} ({totals.winPct.toFixed(2)}%)</span></div>
                    <div className="text-gray-400 mt-1">Victorias espejo: <span className="font-mono" style={{ color: bot.color }}>{totals.mirrorWins} ({totals.mirrorPct.toFixed(2)}%)</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="w-full flex justify-center mb-4">
          <div className="lab-segmented">
            <button
              onClick={() => setTourSection("fixture")}
              aria-pressed={tourSection === "fixture"}
              className="lab-segmented__button"
            >
              Fixture
            </button>
            <button
              onClick={() => setTourSection("results")}
              aria-pressed={tourSection === "results"}
              className="lab-segmented__button"
            >
              Resultados
            </button>
          </div>
        </div>

        {tourSection === "fixture" && (
          <div className="w-full flex flex-col gap-4 mb-4">
            {TOURNAMENT_FIXTURE_BY_FECHA.map((fecha, fechaIndex) => (
              <div key={fechaIndex} className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs text-gray-400 uppercase tracking-wider">Fecha {fechaIndex + 1}</h3>
                  <span className="text-[11px] text-gray-600">2 partidos</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {fecha.map((match) => {
                    const botA = BOT[tourBots[match.aSlot]];
                    const botB = BOT[tourBots[match.bSlot]];
                    const snapshot = tourMatchSnapshots[match.flatIndex] ?? buildTournamentMatchSnapshot(match, null, "pending");
                    const isRunning = snapshot.status === "running";
                    const isFinished = snapshot.status === "finished";
                    const badgeClass = isFinished
                      ? "border-emerald-700/80 bg-emerald-900/20 text-emerald-300"
                      : isRunning
                        ? "border-amber-700/80 bg-amber-900/20 text-amber-300"
                        : "border-gray-700 bg-gray-800/80 text-gray-500";
                    const cardClass = isRunning
                      ? "border-amber-700/60 shadow-[0_0_0_1px_rgba(217,119,6,0.2)]"
                      : isFinished
                        ? "border-emerald-800/60"
                        : "border-gray-800";
                    return (
                      <div key={match.flatIndex} className={`rounded-xl border bg-gray-950/60 p-3 ${cardClass}`}>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[11px] text-gray-600">Partido {match.matchIndex + 1}</span>
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${badgeClass}`}>
                            {snapshot.status === "finished" ? "Finalizado" : snapshot.status === "running" ? "En juego" : "Pendiente"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="text-xs font-semibold text-left" style={{ color: botA.color }}>{botA.emoji} {botA.name}</div>
                          <div className="text-[11px] text-gray-600 uppercase tracking-wider">vs</div>
                          <div className="text-xs font-semibold text-right" style={{ color: botB.color }}>{botB.emoji} {botB.name}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-gray-900/80 p-2">
                            <div className="text-gray-500">Partidas</div>
                            <div className="text-gray-200 font-mono mt-1">{snapshot.games}</div>
                          </div>
                          <div className="rounded-lg bg-gray-900/80 p-2">
                            <div className="text-gray-500">Chinchones</div>
                            <div className="font-mono mt-1">
                              <span style={{ color: botA.color }}>{snapshot.chinchones[0]}</span>
                              <span className="text-gray-500"> - </span>
                              <span style={{ color: botB.color }}>{snapshot.chinchones[1]}</span>
                            </div>
                          </div>
                          <div className="rounded-lg bg-gray-900/80 p-2">
                            <div className="text-gray-500">Victorias</div>
                            <div className="font-mono mt-1">
                              <span style={{ color: botA.color }}>{snapshot.wins[0]}</span>
                              <span className="text-gray-500"> - </span>
                              <span style={{ color: botB.color }}>{snapshot.wins[1]}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1">
                              {snapshot.winPct[0].toFixed(2)}% · {snapshot.winPct[1].toFixed(2)}%
                            </div>
                          </div>
                          <div className="rounded-lg bg-gray-900/80 p-2">
                            <div className="text-gray-500">Victorias espejo</div>
                            <div className="font-mono mt-1">
                              <span style={{ color: botA.color }}>{snapshot.mirrorWins[0]}</span>
                              <span className="text-gray-500"> - </span>
                              <span style={{ color: botB.color }}>{snapshot.mirrorWins[1]}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1">
                              {snapshot.mirrorPct[0].toFixed(2)}% · {snapshot.mirrorPct[1].toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-800">
                          <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Acumulado del torneo</div>
                          <div className="space-y-2 text-xs">
                            <div className="rounded-lg bg-gray-900/70 p-2">
                              <div className="font-semibold mb-1" style={{ color: botA.color }}>{botA.emoji} {botA.name}</div>
                              <div className="text-gray-400">Victorias totales: <span className="font-mono" style={{ color: botA.color }}>{snapshot.totals[0].wins} ({snapshot.totals[0].winPct.toFixed(2)}%)</span></div>
                              <div className="text-gray-400 mt-1">Victorias espejo: <span className="font-mono" style={{ color: botA.color }}>{snapshot.totals[0].mirrorWins} ({snapshot.totals[0].mirrorPct.toFixed(2)}%)</span></div>
                            </div>
                            <div className="rounded-lg bg-gray-900/70 p-2">
                              <div className="font-semibold mb-1" style={{ color: botB.color }}>{botB.emoji} {botB.name}</div>
                              <div className="text-gray-400">Victorias totales: <span className="font-mono" style={{ color: botB.color }}>{snapshot.totals[1].wins} ({snapshot.totals[1].winPct.toFixed(2)}%)</span></div>
                              <div className="text-gray-400 mt-1">Victorias espejo: <span className="font-mono" style={{ color: botB.color }}>{snapshot.totals[1].mirrorWins} ({snapshot.totals[1].mirrorPct.toFixed(2)}%)</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="lab-copy-note mb-3">
                {isDone
                  ? "Ya terminaron todas las fechas. Podés pasar a la parte de resultados."
                  : "El botón de resultados se habilita cuando terminen todas las fechas."}
              </div>
              <button
                onClick={() => setTourSection("results")}
                disabled={!isDone}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  isDone
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95"
                    : "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed"
                }`}
              >
                Ver resultados
              </button>
            </div>
          </div>
        )}

        {tourSection === "results" && (
          hasTournamentResults ? (
            <>
              <div className="w-full flex justify-center mb-3">
                <div className="lab-segmented">
                  <button
                    onClick={() => setTourMatrixView("percent")}
                    aria-pressed={tourMatrixView === "percent"}
                    className="lab-segmented__button"
                  >
                    Ver %
                  </button>
                  <button
                    onClick={() => setTourMatrixView("absolute")}
                    aria-pressed={tourMatrixView === "absolute"}
                    className="lab-segmented__button"
                  >
                    Ver absolutos
                  </button>
                </div>
              </div>

              {/* Results matrix */}
              <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 overflow-x-auto">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">
                  {tourMatrixView === "percent"
                    ? "Matriz de resultados (% victorias fila vs columna)"
                    : "Matriz de resultados (victorias absolutas fila vs columna)"}
                </h3>
                <table className="w-full text-xs min-w-[320px]">
                  <thead>
                    <tr>
                      <th className="text-gray-600 text-left py-1 pr-3 font-normal w-24">Bot</th>
                      {slots.map(j => {
                        const b = BOT[tourBots[j]];
                        return <th key={j} className="text-center px-2 py-1 font-medium" style={{ color: b.color }}>{b.emoji} {b.name}</th>;
                      })}
                      <th className="text-center px-2 py-1 text-gray-400 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map(ai => {
                      const b = BOT[tourBots[ai]];
                      const total = botTotals[ai];
                      const winPct = total.games > 0 ? total.winPct : null;
                      return (
                        <tr key={ai} className="border-t border-gray-800">
                          <td className="py-2 pr-3 font-medium" style={{ color: b.color }}>{b.emoji} {b.name}</td>
                          {slots.map(j => {
                            if (j === ai) return <td key={j} className="text-center text-gray-700 py-2">—</td>;
                            const low = Math.min(ai, j);
                            const high = Math.max(ai, j);
                            const g = safeTourResults.games[low][high];
                            const w = ai < j ? safeTourResults.wins[ai][j] : g - safeTourResults.wins[j][ai];
                            if (g === 0) return <td key={j} className="text-center text-gray-600 py-2">...</td>;
                            const pct = (w / g) * 100;
                            const col = pct >= 55 ? "#22c55e" : pct >= 47 ? "#9ca3af" : "#f87171";
                            return (
                              <td key={j} className="text-center py-2 font-mono" style={{ color: col }}>
                                {tourMatrixView === "percent" ? `${pct.toFixed(1)}%` : w}
                              </td>
                            );
                          })}
                          <td className="text-center py-2 font-bold font-mono">
                            {winPct !== null
                              ? <span style={{ color: b.color }}>{tourMatrixView === "percent" ? `${winPct.toFixed(2)}%` : total.wins}</span>
                              : <span className="text-gray-600">...</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 overflow-x-auto">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">
                  {tourMatrixView === "percent"
                    ? "Matriz espejo (% de pares donde la fila gana ambas)"
                    : "Matriz espejo (dobles espejo ganados por la fila)"}
                </h3>
                <table className="w-full text-xs min-w-[320px]">
                  <thead>
                    <tr>
                      <th className="text-gray-600 text-left py-1 pr-3 font-normal w-24">Bot</th>
                      {slots.map(j => {
                        const b = BOT[tourBots[j]];
                        return <th key={j} className="text-center px-2 py-1 font-medium" style={{ color: b.color }}>{b.emoji} {b.name}</th>;
                      })}
                      <th className="text-center px-2 py-1 text-gray-400 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map(ai => {
                      const b = BOT[tourBots[ai]];
                      const total = botTotals[ai];
                      const winPct = total.mirrorPairs > 0 ? total.mirrorPct : null;
                      return (
                        <tr key={ai} className="border-t border-gray-800">
                          <td className="py-2 pr-3 font-medium" style={{ color: b.color }}>{b.emoji} {b.name}</td>
                          {slots.map(j => {
                            if (j === ai) return <td key={j} className="text-center text-gray-700 py-2">—</td>;
                            const p = ai < j ? safeTourResults.mirrorPairs[ai][j] : safeTourResults.mirrorPairs[j][ai];
                            const w = safeTourResults.mirrorWins[ai][j];
                            if (p === 0) return <td key={j} className="text-center text-gray-600 py-2">...</td>;
                            const pct = (w / p) * 100;
                            return (
                              <td key={j} className="text-center py-2 font-mono text-violet-300">
                                {tourMatrixView === "percent" ? `${pct.toFixed(1)}%` : w}
                              </td>
                            );
                          })}
                          <td className="text-center py-2 font-bold font-mono">
                            {winPct !== null
                              ? <span style={{ color: b.color }}>{tourMatrixView === "percent" ? `${winPct.toFixed(2)}%` : total.mirrorWins}</span>
                              : <span className="text-gray-600">...</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Ranking / Podium */}
              <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4">
                {isDone && (
                  <div className="lab-ceremony mb-5">
                    <div className="text-center">
                      <div className="text-[11px] text-amber-300 uppercase tracking-[0.2em] mb-1">🎖️ Ceremonia de premios</div>
                      <div className="text-sm font-semibold text-gray-100">El torneo terminó y ahora toca repartir flores, ladrillos y la corona.</div>
                      <div className="text-xs text-gray-500 mt-1">Primero la gastada, después los aplausos y al final el campeón con sus motivos.</div>
                    </div>

                    <section className="lab-ceremony-section lab-ceremony-section--bad">
                      <div className="lab-ceremony-section__head">
                        <div>
                          <div className="lab-ceremony-section__eyebrow text-rose-300">Premios malos</div>
                          <h4 className="lab-ceremony-section__title">La parte donde el torneo se pone mala leche</h4>
                        </div>
                        <div className="lab-ceremony-section__emoji">🚨</div>
                      </div>
                      {badAwardCards.length > 0 ? (
                        <div className="lab-ceremony-grid">
                          {badAwardCards.map((award) => (
                            <div key={award.key} className="lab-ceremony-award lab-ceremony-award--bad">
                              <div className="lab-ceremony-award__head">
                                <div>
                                  <div className="lab-ceremony-award__eyebrow" style={{ color: award.accent }}>{award.title}</div>
                                  <div className="lab-ceremony-award__subtitle">{award.subtitle}</div>
                                </div>
                                <div className="lab-ceremony-award__emoji">{award.emoji}</div>
                              </div>
                              <div className="lab-ceremony-award__stack">
                                {award.winners.map((winner) => {
                                  const bot = BOT[tourBots[winner.idx]];
                                  return (
                                    <div key={`${award.key}-${winner.idx}`} className="lab-ceremony-award__winner lab-ceremony-award__winner--bad">
                                      <div className="text-lg leading-none mb-1">{bot.emoji}</div>
                                      <div className="text-sm font-bold" style={{ color: bot.color }}>{bot.name}</div>
                                      <div className="text-xs text-gray-300 mt-1">{winner.detail}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="lab-ceremony-empty lab-ceremony-empty--bad">No hubo papelones esta vez.</div>
                      )}
                    </section>

                    <section className="lab-ceremony-section lab-ceremony-section--good">
                      <div className="lab-ceremony-section__head">
                        <div>
                          <div className="lab-ceremony-section__eyebrow text-emerald-300">Premios buenos</div>
                          <h4 className="lab-ceremony-section__title">Los que sí se ganaron algo para mostrar</h4>
                        </div>
                        <div className="lab-ceremony-section__emoji">🏅</div>
                      </div>
                      <div className="lab-ceremony-grid">
                        {goodAwardCards.map((award) => (
                          <div key={award.key} className="lab-ceremony-award lab-ceremony-award--good">
                            <div className="lab-ceremony-award__head">
                              <div>
                                <div className="lab-ceremony-award__eyebrow" style={{ color: award.accent }}>{award.title}</div>
                                <div className="lab-ceremony-award__subtitle">{award.subtitle}</div>
                              </div>
                              <div className="lab-ceremony-award__emoji">{award.emoji}</div>
                            </div>
                            <div className="lab-ceremony-award__stack">
                              {award.winners.map((winner) => {
                                const bot = BOT[tourBots[winner.idx]];
                                return (
                                  <div key={`${award.key}-${winner.idx}`} className="lab-ceremony-award__winner">
                                    <div className="text-lg leading-none mb-1">{bot.emoji}</div>
                                    <div className="text-sm font-bold" style={{ color: bot.color }}>{bot.name}</div>
                                    <div className="text-xs text-gray-400 mt-1">{winner.detail}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="lab-ceremony-section lab-ceremony-section--champion">
                      <div className="lab-ceremony-section__head">
                        <div>
                          <div className="lab-ceremony-section__eyebrow text-amber-300">Ganador y por qué</div>
                          <h4 className="lab-ceremony-section__title">La corona queda en manos de quien más convirtió premios en puntos</h4>
                        </div>
                        <div className="lab-ceremony-section__emoji">👑</div>
                      </div>
                      <div className="lab-ceremony-champion">
                        <div className="text-base font-extrabold" style={{ color: BOT[tourBots[ceremonyChampion.idx]].color }}>
                          {BOT[tourBots[ceremonyChampion.idx]].emoji} {BOT[tourBots[ceremonyChampion.idx]].name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Se lleva el título por sumar más puntos de premios. Si dos bots empatan, primero manda el duelo directo entre ellos.
                        </div>
                        <div className="lab-ceremony-points">
                          <div className="lab-ceremony-points__item">
                            <div className="text-gray-500">Mayor ganador</div>
                            <div className="font-mono mt-1" style={{ color: BOT[tourBots[ceremonyChampion.idx]].color }}>
                              {ceremonyChampion.winsPoints > 0 ? `+${ceremonyChampion.winsPoints}` : "0"}
                            </div>
                          </div>
                          <div className="lab-ceremony-points__item">
                            <div className="text-gray-500">Aura</div>
                            <div className="font-mono mt-1" style={{ color: BOT[tourBots[ceremonyChampion.idx]].color }}>
                              {ceremonyChampion.auraPoints > 0 ? `+${ceremonyChampion.auraPoints}` : "0"}
                            </div>
                          </div>
                          <div className="lab-ceremony-points__item">
                            <div className="text-gray-500">Letalidad</div>
                            <div className="font-mono mt-1" style={{ color: BOT[tourBots[ceremonyChampion.idx]].color }}>
                              {ceremonyChampion.mirrorPoints > 0 ? `+${ceremonyChampion.mirrorPoints}` : "0"}
                            </div>
                          </div>
                          <div className="lab-ceremony-points__item">
                            <div className="text-gray-500">Le ganó a todos</div>
                            <div className="font-mono mt-1" style={{ color: BOT[tourBots[ceremonyChampion.idx]].color }}>
                              {ceremonyChampion.beatAllPoints > 0 ? `+${ceremonyChampion.beatAllPoints}` : "0"}
                            </div>
                          </div>
                        </div>
                        <div className="lab-ceremony-reasons">
                          {championReasonItems.map((reason) => (
                            <div key={reason} className="lab-ceremony-reasons__item">
                              {reason}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-gray-400">
                          Puntaje total del campeón: <span className="font-mono" style={{ color: BOT[tourBots[ceremonyChampion.idx]].color }}>{ceremonyChampion.score}</span>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">
                  {isDone ? "Clasificación final" : "Clasificación parcial (3 fechas)"}
                </h3>
                <h4 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">0) Puntos de premios</h4>
                <div className="w-full mb-4 overflow-x-auto">
                  <table className="w-full text-xs min-w-[420px]">
                    <thead>
                      <tr>
                        <th className="text-left py-1 pr-3 text-gray-500 font-normal">Bot</th>
                        <th className="text-center px-2 py-1 text-gray-500 font-normal">Mayor</th>
                        <th className="text-center px-2 py-1 text-gray-500 font-normal">Letal</th>
                        <th className="text-center px-2 py-1 text-gray-500 font-normal">Aura</th>
                        <th className="text-center px-2 py-1 text-gray-500 font-normal">Le ganó a todos</th>
                        <th className="text-center px-2 py-1 text-gray-300 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ceremonyRanking.map((r, pos) => {
                        const bot = BOT[tourBots[r.idx]];
                        return (
                          <tr key={r.idx} className="border-t border-gray-800">
                            <td className="py-2 pr-3 font-medium" style={{ color: bot.color }}>
                              <span className="inline-flex items-center gap-2">
                                <span>{medals[pos]}</span>
                                <span>{bot.emoji} {bot.name}</span>
                              </span>
                            </td>
                            <td className="text-center py-2 font-mono" style={{ color: r.winsPoints > 0 ? bot.color : "#6b7280" }}>
                              {r.winsPoints}
                            </td>
                            <td className="text-center py-2 font-mono" style={{ color: r.mirrorPoints > 0 ? bot.color : "#6b7280" }}>
                              {r.mirrorPoints}
                            </td>
                            <td className="text-center py-2 font-mono" style={{ color: r.auraPoints > 0 ? bot.color : "#6b7280" }}>
                              {r.auraPoints}
                            </td>
                            <td className="text-center py-2 font-mono" style={{ color: r.beatAllPoints > 0 ? bot.color : "#6b7280" }}>
                              {r.beatAllPoints}
                            </td>
                            <td className="text-center py-2 font-bold font-mono" style={{ color: bot.color }}>
                              {r.score}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <h4 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">1) Victorias totales</h4>
                <div className="flex flex-col gap-2.5 mb-4">
                  {rankingWins.map((r, pos) => {
                    const bot = BOT[tourBots[r.idx]];
                    const barW = r.games > 0 ? Math.max(2, Math.min(100, r.winPct * 2 - 50)) : 2;
                    return (
                      <div key={r.idx} className="flex items-center gap-2">
                        <span className="text-base w-7 text-center shrink-0">{medals[pos]}</span>
                        <span className="w-28 text-xs font-semibold shrink-0" style={{ color: bot.color }}>{bot.emoji} {bot.name}</span>
                        <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                          <div className="h-full rounded transition-all duration-300"
                            style={{ width: `${barW}%`, background: bot.color + "99" }} />
                        </div>
                        <span className="text-xs font-mono w-24 text-right shrink-0" style={{ color: bot.color }}>
                          {r.games > 0 ? `${r.wins} (${r.winPct.toFixed(2)}%)` : "..."}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <h4 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">2) Victorias espejo</h4>
                <div className="flex flex-col gap-2.5 mb-4">
                  {rankingMirror.map((r, pos) => {
                    const bot = BOT[tourBots[r.idx]];
                    const barW = r.mirrorPairs > 0 ? Math.max(2, Math.min(100, r.mirrorPct)) : 2;
                    return (
                      <div key={r.idx} className="flex items-center gap-2">
                        <span className="text-base w-7 text-center shrink-0">{medals[pos]}</span>
                        <span className="w-28 text-xs font-semibold shrink-0" style={{ color: bot.color }}>{bot.emoji} {bot.name}</span>
                        <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                          <div className="h-full rounded transition-all duration-300" style={{ width: `${barW}%`, background: bot.color + "99" }} />
                        </div>
                        <span className="text-xs font-mono w-24 text-right shrink-0" style={{ color: bot.color }}>
                          {r.mirrorPairs > 0 ? `${r.mirrorWins} (${r.mirrorPct.toFixed(2)}%)` : "..."}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <h4 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">3) Chinchones (% de victorias)</h4>
                <div className="flex flex-col gap-2.5">
                  {rankingChinchon.map((r, pos) => {
                    const bot = BOT[tourBots[r.idx]];
                    const barW = r.wins > 0 ? Math.max(2, Math.min(100, r.rate)) : 2;
                    return (
                      <div key={r.idx} className="flex items-center gap-2">
                        <span className="text-base w-7 text-center shrink-0">{medals[pos]}</span>
                        <span className="w-28 text-xs font-semibold shrink-0" style={{ color: bot.color }}>{bot.emoji} {bot.name}</span>
                        <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                          <div className="h-full rounded transition-all duration-300" style={{ width: `${barW}%`, background: bot.color + "99" }} />
                        </div>
                        <span className="text-xs font-mono w-28 text-right shrink-0" style={{ color: bot.color }}>
                          {r.wins > 0 ? `${r.chinchones} (${r.rate.toFixed(2)}%)` : "..."}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {!isDone && tourRunning && (
                  <p className="text-xs text-gray-600 text-center mt-3">Resultados parciales por fecha — el torneo sigue corriendo</p>
                )}
              </div>
            </>
          ) : (
            <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-5 text-center text-sm text-gray-500 mb-4">
              Todavía no hay resultados listos para mostrar. Terminá el torneo o dejá que llegue el próximo snapshot antes de pasar a esta vista.
            </div>
          )
        )}
      </div>
      </LabPanel>
    );
  })()}

  {/* --- REGLAS --- */}
  {tab === "reglas" && (
    <LabPanel>
    <div className="lab-workspace lab-workspace--prose">
      <section className="lab-rules" aria-label="Reglas oficiales de Chinchón">
        <div className="lab-rules__intro">
          <div className="lab-rules__eyebrow">🇦🇷 Variante argentina</div>
          <h2 className="lab-rules__title">Las reglas que usan la simulación, el torneo y el modo práctica.</h2>
          <p className="lab-rules__copy">
            Todo el lab corre con esta misma base: misma baraja, mismo corte y la misma lógica de chinchón para comparar bots y revisar jugadas.
          </p>
          <div className="lab-rules__facts">
            {RULE_FACTS.map((fact) => (
              <span key={fact} className="lab-rules__fact">{fact}</span>
            ))}
          </div>
        </div>

        <div className="lab-rules__spotlight">
          <div className="lab-rules__spotlight-card is-good">
            <span className="lab-rules__spotlight-icon" aria-hidden="true">🏆</span>
            <div>
              <h3>Chinchón puro</h3>
              <p>7 cartas consecutivas del mismo palo, sin comodines. Si lo hacés, ganás la partida al instante.</p>
            </div>
          </div>
          <div className="lab-rules__spotlight-card is-warn">
            <span className="lab-rules__spotlight-icon" aria-hidden="true">🤡</span>
            <div>
              <h3>Comodín con costo</h3>
              <p>No se puede tirar nunca, y si queda suelto fuera de melds suma 50 puntos en contra.</p>
            </div>
          </div>
        </div>

        <div className="lab-rules__grid">
          {RULE_SECTIONS.map((section) => (
            <article
              key={section.key}
              className="lab-rules__card"
              style={{ "--rules-accent": section.accent }}
            >
              <div className="lab-rules__card-head">
                <span className="lab-rules__icon" aria-hidden="true">{section.emoji}</span>
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.summary}</p>
                </div>
              </div>
              <ul className="lab-rules__list">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="lab-rules__about">
          <div className="lab-rules__about-eyebrow">🇦🇷 Hecho en Argentina</div>
          <div className="lab-rules__about-head">
            <span className="lab-rules__about-icon" aria-hidden="true">🧪</span>
            <div>
              <h3>Chinchón Lab existe para mezclar estrategia, barajas y un poco de aura.</h3>
              <p>
                La app la hizo{" "}
                <a
                  className="lab-rules__about-link"
                  href="https://github.com/facundoraulbistolfi"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facundo Bistolfi
                </a>{" "}
                con ayuda de Claude y Codex, entre pruebas espejo, torneos raros y bastante curiosidad por ver qué decisiones terminan jugando mejor.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
    </LabPanel>
  )}

  {/* --- BOTS --- */}
  {tab === "custom" && (
    <LabPanel
      title="Bots"
      subtitle="Tus bots custom primero, persistencia local automática e importación/exportación desde el navegador."
    >
    <div className="lab-workspace">
      {viewingBot ? (
        <BotViewer config={viewingBot} onClose={() => setViewingBot(null)} />
      ) : editingBot ? (
        <BotEditor config={editingBot} onCancel={() => setEditingBot(null)} onSave={(cfg) => {
          setCustomConfigs(prev => {
            const idx = prev.findIndex(c => c.id === cfg.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = cfg; return next; }
            if (prev.length >= MAX_CUSTOM_BOTS) return prev;
            return [...prev, cfg];
          });
          setEditingBot(null);
        }} />
      ) : (
        <div className="lab-bots">
          <section className="lab-bots__intro">
            <div className="lab-bots__eyebrow">Biblioteca de bots</div>
            <h3 className="lab-bots__title">Diseñá estilos de juego, comparalos rápido y guardalos en este navegador.</h3>
            <p className="lab-bots__copy">
              La idea es iterar sin fricción: creás un bot, le das personalidad con robo, descarte y corte, y después lo probás contra los presets del lab.
            </p>
            <div className="lab-bots__facts">
              <span className="lab-bots__fact">Hasta {MAX_CUSTOM_BOTS} custom</span>
              <span className="lab-bots__fact">Persistencia local</span>
              <span className="lab-bots__fact">Importar / exportar JSON</span>
              <span className="lab-bots__fact">Benchmark express vs FacuTron</span>
            </div>
            <div className="lab-bots__toolbar">
              <div className="lab-bots__toolbar-copy">
                <span className="lab-bots__toolbar-label">Vista de las cards</span>
                <p>Alterná entre descripción libre y resumen táctico para escanear mejor la biblioteca.</p>
              </div>
              <div className="lab-bots__segmented" role="group" aria-label="Modo de vista de bots">
                <button
                  type="button"
                  className="lab-bots__segment"
                  aria-pressed={showDescMode === "desc"}
                  onClick={() => setShowDescMode("desc")}
                >
                  Descripción
                </button>
                <button
                  type="button"
                  className="lab-bots__segment"
                  aria-pressed={showDescMode === "config"}
                  onClick={() => setShowDescMode("config")}
                >
                  Resumen config
                </button>
              </div>
            </div>
          </section>

          <LabAccordionSection title="Mis bots" subtitle="Persistencia local, importación y benchmarking" defaultOpen>
          <div className="lab-bot-library">
            <div className="lab-bot-library__header">
              <div>
                <div className="lab-bot-library__eyebrow">Custom</div>
                <h3>{customConfigs.length} / {MAX_CUSTOM_BOTS} bots guardados</h3>
                <p>Todo queda persistido en este navegador, así que podés probar ideas y volver después sin perderlas.</p>
              </div>
              <div className="lab-bot-library__actions">
                <button
                  type="button"
                  onClick={() => { setShowImport(v => !v); setImportText(""); setImportError(null); }}
                  className="lab-bot-library__action"
                  aria-pressed={showImport}
                >
                  {showImport ? "Cerrar importación" : "Importar JSON"}
                </button>
                {customConfigs.length < MAX_CUSTOM_BOTS && (
                  <button
                    type="button"
                    onClick={() => setEditingBot(DEFAULT_CUSTOM_CONFIG())}
                    className="lab-bot-library__action is-primary"
                  >
                    + Nuevo bot
                  </button>
                )}
              </div>
            </div>

            {showImport && (
              <div className="lab-bot-import">
                <div className="lab-bot-import__head">
                  <div>
                    <div className="lab-bot-import__eyebrow">Importar</div>
                    <h4>Pegá el JSON exportado de otro bot</h4>
                  </div>
                  <span className="lab-bot-import__hint">Se valida antes de guardarlo</span>
                </div>
                <textarea
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setImportError(null); }}
                  rows={5}
                  placeholder='{ "name": "...", "emoji": "🧪", ... }'
                  className="lab-bot-import__textarea"
                />
                <div className="lab-bot-import__footer">
                  <div className="lab-bot-import__status">
                    {importError ? <span className="lab-bot-import__error">{importError}</span> : "Podés importar una configuración completa y seguir editándola acá."}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      let raw;
                      try { raw = JSON.parse(importText); } catch { setImportError("JSON inválido"); return; }
                      const cfg = sanitizeImportConfig(raw);
                      if (!cfg) { setImportError("Configuración inválida o incompleta"); return; }
                      if (customConfigs.length >= MAX_CUSTOM_BOTS) { setImportError(`Ya tenés ${MAX_CUSTOM_BOTS} bots custom (máximo)`); return; }
                      setCustomConfigs(prev => [...prev, cfg]);
                      setShowImport(false); setImportText("");
                    }}
                    className="lab-bot-library__action is-primary"
                  >
                    Importar bot
                  </button>
                </div>
              </div>
            )}

            {customConfigs.length === 0 && !showImport ? (
              <div className="lab-bot-empty">
                <span className="lab-bot-empty__icon" aria-hidden="true">🧪</span>
                <div>
                  <h4>Arrancá tu propia camada de bots</h4>
                  <p>Creá uno desde cero o importá una configuración para tunearla. Después podés medirlo rápido contra FacuTron.</p>
                </div>
              </div>
            ) : null}

            {customConfigs.length > 0 && (
              <div className="lab-card-grid">
                {customConfigs.map((cfg) => {
                  const { color, soft, border } = getBotPalette(cfg);
                  const bench = benchmarks[cfg.id];
                  const benchRate = bench ? Math.round((bench.wins / bench.total) * 100) : null;
                  return (
                    <article
                      key={cfg.id}
                      className="lab-bot-card"
                      style={{ "--bot-accent": color, "--bot-accent-soft": soft, "--bot-accent-border": border }}
                    >
                      <div className="lab-bot-card__hero">
                        <span className="lab-bot-card__avatar" aria-hidden="true">{cfg.emoji}</span>
                        <div className="lab-bot-card__identity">
                          <div className="lab-bot-card__name-row">
                            <h4>{cfg.name}</h4>
                            <span className="lab-bot-card__kind">Custom</span>
                          </div>
                          <p>{getBotCardCopy(cfg, showDescMode)}</p>
                        </div>
                      </div>

                      <div className="lab-bot-card__tags">
                        {getBotStrategyPills(cfg).map((pill) => (
                          <span key={pill} className="lab-bot-card__tag">{pill}</span>
                        ))}
                      </div>

                      {bench && (
                        <div className="lab-bot-card__metric">
                          <div className="lab-bot-card__metric-head">
                            <span>Benchmark vs FacuTron</span>
                            <strong style={{ color: benchRate >= 50 ? "#4ade80" : "#f87171" }}>{benchRate}%</strong>
                          </div>
                          <div className="lab-bot-card__bar">
                            <div
                              className="lab-bot-card__bar-fill"
                              style={{ width: `${benchRate}%`, background: benchRate >= 50 ? "#10b981" : "#ef4444" }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="lab-bot-card__actions">
                        <button onClick={() => setViewingBot(cfg)} className="lab-bot-card__action">👀 Ver</button>
                        <button onClick={() => setEditingBot(cloneEditorConfig(cfg))} className="lab-bot-card__action">✏️ Editar</button>
                        <button
                          onClick={() => {
                            const { id: _id, ...exportable } = cfg;
                            navigator.clipboard.writeText(JSON.stringify(exportable, null, 2));
                            setCopiedId(cfg.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="lab-bot-card__action is-accent"
                        >
                          {copiedId === cfg.id ? "✓ Copiado" : "📤 Exportar"}
                        </button>
                        <button
                          onClick={() => runBenchmark(cfg)}
                          disabled={benchmarking === cfg.id}
                          className="lab-bot-card__action is-warm"
                        >
                          {benchmarking === cfg.id ? "Midiendo..." : "⚡ Probar"}
                        </button>
                        <button onClick={() => setCustomConfigs(prev => prev.filter(c => c.id !== cfg.id))} className="lab-bot-card__action is-danger">🗑️ Borrar</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {customConfigs.length >= MAX_CUSTOM_BOTS && (
              <div className="lab-bot-library__limit">Llegaste al máximo de {MAX_CUSTOM_BOTS} bots custom para este navegador.</div>
            )}
          </div>
          </LabAccordionSection>

          <LabAccordionSection title="Preconstruidos" subtitle="Base estable para comparar y extender" defaultOpen={false}>
          <div className="lab-bot-library">
            <div className="lab-bot-library__header">
              <div>
                <div className="lab-bot-library__eyebrow">Presets</div>
                <h3>Los bots base del lab</h3>
                <p>Sirven como punto de partida visual y táctico para comparar decisiones de robo, descarte y corte.</p>
              </div>
            </div>

            <div className="lab-card-grid">
              {BUILTIN_BOT_CONFIGS.map(cfg => {
                const { color, soft, border } = getBotPalette(cfg);
                return (
                  <article
                    key={cfg.id}
                    className="lab-bot-card is-preset"
                    style={{ "--bot-accent": color, "--bot-accent-soft": soft, "--bot-accent-border": border }}
                  >
                    <div className="lab-bot-card__hero">
                      <span className="lab-bot-card__avatar" aria-hidden="true">{cfg.emoji}</span>
                      <div className="lab-bot-card__identity">
                        <div className="lab-bot-card__name-row">
                          <h4>{cfg.name}</h4>
                          <span className="lab-bot-card__kind">Preset</span>
                        </div>
                        <p>{getBotCardCopy(cfg, showDescMode)}</p>
                      </div>
                    </div>

                    <div className="lab-bot-card__tags">
                      {getBotStrategyPills(cfg).map((pill) => (
                        <span key={pill} className="lab-bot-card__tag">{pill}</span>
                      ))}
                    </div>

                    <div className="lab-bot-card__actions">
                      <button onClick={() => setViewingBot(cfg)} className="lab-bot-card__action">👀 Ver config</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
          </LabAccordionSection>
        </div>
      )}
    </div>
    </LabPanel>
  )}
</main>

);
}
