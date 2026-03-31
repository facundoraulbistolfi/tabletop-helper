// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from "react";
import {
  SUITS, RANKS, RANK_ORDER, JOKER_REST,
  isJoker, cardRest, sameCard,
  createDeck, shuffle,
  findAllMelds, findBestMelds,
  checkChinchon,
  legalDiscardIndex, cutScore,
  shouldDrawDiscard, playRoundScored,
} from "../lib/chinchon-bot-game";

/* ==============================================================
CARD ENGINE (UI-only constants)
============================================================== */
const SUIT_ICON = ["⚔️", "🪵", "🏆", "🪙"];
const SUIT_COLOR = ["#60a5fa", "#22c55e", "#f87171", "#fbbf24"];
const RANK_LABEL = { 0: "🃏", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "11", 12: "12" };

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
BOTS
============================================================== */
function defaultDiscard(hand8) {
const a = findBestMelds(hand8); const inM = new Set(a.meldsCut.flat());
let wi = -1, ws = -1;
hand8.forEach((c, i) => { if (!isJoker(c) && !inM.has(i) && cardRest(c) > ws) { ws = cardRest(c); wi = i; } });
return wi === -1 ? hand8.length - 1 : wi;
}
function taiDiscard(hand8) {
const a = findBestMelds(hand8); const inM = new Set(a.melds.flat());
let wi = -1, ws = -1;
hand8.forEach((c, i) => { if (!isJoker(c) && !inM.has(i) && c.rank > ws) { ws = c.rank; wi = i; } });
if (wi === -1) { let hi = -1, hr = -1; hand8.forEach((c, i) => { if (!isJoker(c) && c.rank > hr) { hr = c.rank; hi = i; } }); return hi; }
return wi;
}

/* -- Angry DaiBot: optimal discard - tries all 8 possible discards, picks the one
that leaves the best 7-card hand (lowest resto, then fewest free cards) -- */
function angryDiscard(hand8) {
let bestIdx = 0, bestResto = 9999, bestFree = 99;
for (let i = 0; i < hand8.length; i++) {
if (isJoker(hand8[i])) continue;
const test = hand8.filter((_, j) => j !== i);
const m = findBestMelds(test);
if (m.minFree < bestFree || (m.minFree === bestFree && m.resto < bestResto)) {
bestIdx = i; bestResto = m.resto; bestFree = m.minFree;
}
}
return bestIdx;
}

/* -- Angry DaiBot: check if close to chinchón (5+ same suit consecutive, counting jokers) -- */
function nearChinchon(hand) {
const jokers = hand.filter(isJoker).length;
const bySuit = {};
hand.forEach(c => { if (!isJoker(c)) (bySuit[c.suit] ??= []).push(RANK_ORDER[c.rank]); });
for (const orders of Object.values(bySuit)) {
// best consecutive run length in this suit + available jokers
orders.sort((a, b) => a - b);
// check spans: for each window of 7, how many are present?
for (let start = 0; start <= 5; start++) {
let present = 0;
for (let p = start; p <= start + 6; p++) {
if (orders.includes(p)) present++;
}
if (present + jokers >= 6) return true; // only 1-2 cards away from chinchón
}
}
return false;
}

/* ==============================================================
CUSTOM BOT SYSTEM
============================================================== */
// Built-in bot emojis (🤖🎀🔮🔴⚙️😈) are reserved and excluded from custom selection
const CUSTOM_EMOJIS = [
"🧪", "⚡", "🎲", "💎", "🦾", "🧠", "🔥", "🤡",
"🎯", "🎭", "🚀", "💀", "👻", "🕷️", "🍀", "🌟",
"👑", "🐉", "🦊", "🦁", "🌊", "🏆", "🌋", "🛡️",
"🎪", "🎸", "🦈", "🦋", "🌈", "🎩", "🔱", "🌀",
];
const CUSTOM_COLORS = [
{ color: "#f59e0b", text: "text-amber-400", bg: "bg-amber-950", border: "border-amber-800" },
{ color: "#06b6d4", text: "text-cyan-400", bg: "bg-cyan-950", border: "border-cyan-800" },
{ color: "#f97316", text: "text-orange-400", bg: "bg-orange-950", border: "border-orange-800" },
{ color: "#14b8a6", text: "text-teal-400", bg: "bg-teal-950", border: "border-teal-800" },
{ color: "#fb7185", text: "text-rose-400", bg: "bg-rose-950", border: "border-rose-800" },
{ color: "#818cf8", text: "text-indigo-400", bg: "bg-indigo-950", border: "border-indigo-800" },
{ color: "#a3e635", text: "text-lime-400", bg: "bg-lime-950", border: "border-lime-800" },
{ color: "#c084fc", text: "text-purple-400", bg: "bg-purple-950", border: "border-purple-800" },
];
const DEFAULT_SCORE_RULES = () => [{ minScore: 0, maxResto: 5 }, { minScore: 25, maxResto: 3 }, { minScore: 50, maxResto: 2 }, { minScore: 75, maxResto: 1 }];
const DEFAULT_CUSTOM_CONFIG = () => ({
id: "custom-" + Date.now(),
name: "Mi Bot",
emoji: "🧪",
colorIdx: 0,
description: "",
draw: { mode: "smart", restoThreshold: 3 },
discard: { mode: "default" },
cut: { maxFree: 1, baseResto: 5, useScoreRules: false, scoreRules: DEFAULT_SCORE_RULES(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: false },
});


function buildCanCut(cut) {
return (m7, score, hand) => {
if (cut.pursueChinchon && nearChinchonCustom(hand, cut.chinchonThreshold ?? 6)) return m7.minFree === 0;
if (cut.chinchonRunMode && has4RunSameSuit(hand)) return m7.minFree === 0;
const maxR = cut.useScoreRules
? ([...cut.scoreRules].reverse().find(r => (score ?? 0) >= r.minScore)?.maxResto ?? cut.baseResto)
: cut.baseResto;
return m7.minFree <= cut.maxFree && m7.resto <= Math.min(maxR, 5);
};
}

function generateDesc(cfg) {
const parts = [];
const dm = { always_deck: "Solo mazo", smart: "Robo inteligente", aggressive: "Robo agresivo" };
parts.push(dm[cfg.draw.mode] || "Robo inteligente");
const dd = { default: "Desc. por valor", high_rank: "Desc. por rango", optimal: "Desc. óptimo" };
parts.push(dd[cfg.discard.mode] || "Desc. por valor");
if (cfg.cut.useScoreRules) parts.push("Corte adaptativo");
else parts.push("Corte ≤" + cfg.cut.baseResto);
if (cfg.cut.chinchonRunMode) parts.push("🏃corrida");
if (cfg.cut.pursueChinchon) parts.push("🎯chinchón(" + (cfg.cut.chinchonThreshold ?? 6) + ")");
return parts.join(" · ");
}

function buildBotFromConfig(cfg) {
const color = cfg.color ?? CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length].color;
const text = cfg.text ?? CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length].text;
const bg = cfg.bg ?? CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length].bg;
const border = cfg.border ?? CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length].border;
return {
id: cfg.id, name: cfg.name, emoji: cfg.emoji,
color, text, bg, border,
desc: generateDesc(cfg), description: cfg.description ?? "",
custom: !cfg.color, // color field present = builtin
drawConfig: cfg.draw,
canCut: buildCanCut(cfg.cut),
pickDiscard: cfg.discard.mode === "high_rank" ? taiDiscard : cfg.discard.mode === "optimal" ? angryDiscard : defaultDiscard,
};
}

function buildCustomBot(cfg) { return buildBotFromConfig(cfg); }

function sanitizeImportConfig(raw) {
if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
if (typeof raw.name !== "string" || !raw.name.trim()) return null;
if (!raw.draw || !raw.discard || !raw.cut) return null;
const draw = raw.draw ?? {};
const discard = raw.discard ?? {};
const cut = raw.cut ?? {};
const validDraw = ["always_deck", "smart", "aggressive"];
const validDiscard = ["default", "high_rank", "optimal"];
if (!validDraw.includes(draw.mode)) return null;
if (!validDiscard.includes(discard.mode)) return null;
return {
id: "custom-" + Date.now(),
name: String(raw.name).slice(0, 12).trim(),
emoji: CUSTOM_EMOJIS.includes(String(raw.emoji)) ? String(raw.emoji) : "🧪",
colorIdx: typeof raw.colorIdx === "number" ? Math.min(Math.max(0, Math.floor(raw.colorIdx)), CUSTOM_COLORS.length - 1) : 0,
description: typeof raw.description === "string" ? raw.description.slice(0, 120) : "",
draw: {
mode: draw.mode,
restoThreshold: typeof draw.restoThreshold === "number" ? Math.min(Math.max(1, Math.floor(draw.restoThreshold)), 10) : 3,
},
discard: { mode: discard.mode },
cut: {
maxFree: typeof cut.maxFree === "number" ? Math.min(Math.max(0, Math.floor(cut.maxFree)), 1) : 1,
baseResto: Math.min(Math.max(0, Math.floor(cut.baseResto ?? 5)), 5),
useScoreRules: Boolean(cut.useScoreRules),
scoreRules: Array.isArray(cut.scoreRules)
? DEFAULT_SCORE_RULES().map((def, i) => ({ minScore: def.minScore, maxResto: Math.min(Math.max(0, Math.floor(cut.scoreRules[i]?.maxResto ?? def.maxResto)), 5) }))
: DEFAULT_SCORE_RULES(),
pursueChinchon: Boolean(cut.pursueChinchon),
chinchonThreshold: [5, 6].includes(cut.chinchonThreshold) ? cut.chinchonThreshold : 6,
chinchonRunMode: Boolean(cut.chinchonRunMode),
},
};
}

function loadCustomConfigs() {
try {
const configs = JSON.parse(
localStorage.getItem("chinchon-lab-custom-bots")
?? localStorage.getItem("chinchon-arena-custom-bots")
?? "[]"
);
// Clamp resto values to the legal game maximum of 5
return configs.map(cfg => ({
...cfg,
cut: {
...cfg.cut,
baseResto: Math.min(cfg.cut?.baseResto ?? 5, 5),
scoreRules: (cfg.cut?.scoreRules ?? []).map(r => ({ ...r, maxResto: Math.min(r.maxResto ?? 5, 5) })),
},
}));
} catch { return []; }
}
function saveCustomConfigs(configs) {
localStorage.setItem("chinchon-lab-custom-bots", JSON.stringify(configs));
}

const BUILTIN_BOT_CONFIGS = [
{ id: "facutron", name: "FacuTron", emoji: "🤖",
color: "#34d399", text: "text-emerald-400", bg: "bg-emerald-950", border: "border-emerald-800",
description: "Bot equilibrado. Corta en cuanto tiene la mano razonablemente limpia, sin buscar chinchón ni esperar demasiado.",
draw: { mode: "smart", restoThreshold: 3 },
discard: { mode: "default" },
cut: { maxFree: 1, baseResto: 5, useScoreRules: false, scoreRules: DEFAULT_SCORE_RULES(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: false },
},
{ id: "daibot", name: "DaiBot", emoji: "🎀",
color: "#f472b6", text: "text-pink-400", bg: "bg-pink-950", border: "border-pink-800",
description: "Muy paciente. Solo corta cuando todas sus cartas están en melds, apuntando al -10 o al chinchón. Puede tardar muchas rondas.",
draw: { mode: "smart", restoThreshold: 3 },
discard: { mode: "default" },
cut: { maxFree: 0, baseResto: 0, useScoreRules: false, scoreRules: DEFAULT_SCORE_RULES(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: false },
},
{ id: "candelaria", name: "Candelar-IA", emoji: "🔮",
color: "#38bdf8", text: "text-sky-400", bg: "bg-sky-950", border: "border-sky-800",
description: "Cambia de estrategia según el marcador: antes de los 50 puntos exige la mano perfecta, después afloja un poco y acepta hasta 3 de resto.",
draw: { mode: "smart", restoThreshold: 3 },
discard: { mode: "default" },
cut: { maxFree: 1, baseResto: 3, useScoreRules: true, scoreRules: [{ minScore: 0, maxResto: 0 }, { minScore: 25, maxResto: 0 }, { minScore: 50, maxResto: 3 }, { minScore: 75, maxResto: 3 }], pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: false },
},
{ id: "tai", name: "T.A.I", emoji: "🔴",
color: "#f87171", text: "text-red-400", bg: "bg-red-950", border: "border-red-800",
description: "Agresiva en el descarte: siempre tira la carta con número más alto. Corta apenas tiene el resto bajo, sin esperar la perfección.",
draw: { mode: "smart", restoThreshold: 3 },
discard: { mode: "high_rank" },
cut: { maxFree: 1, baseResto: 3, useScoreRules: false, scoreRules: DEFAULT_SCORE_RULES(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: false },
},
{ id: "martinmatic", name: "MartinMatic", emoji: "⚙️",
color: "#9ca3af", text: "text-gray-400", bg: "bg-gray-900", border: "border-gray-700",
description: "Juega agresivo en general, pero si arma una corrida de 4+ cartas del mismo palo cambia de modo y espera para hacer chinchón.",
draw: { mode: "smart", restoThreshold: 3 },
discard: { mode: "default" },
cut: { maxFree: 1, baseResto: 5, useScoreRules: false, scoreRules: DEFAULT_SCORE_RULES(), pursueChinchon: false, chinchonThreshold: 6, chinchonRunMode: true },
},
{ id: "angrydai", name: "Angry DaiBot", emoji: "😈",
color: "#a78bfa", text: "text-violet-400", bg: "bg-violet-950", border: "border-violet-800",
description: "La IA más compleja: descarte óptimo calculado, umbrales de corte que cambian con el puntaje y caza el chinchón cuando está cerca.",
draw: { mode: "aggressive" },
discard: { mode: "optimal" },
cut: { maxFree: 1, baseResto: 2, useScoreRules: true, scoreRules: [{ minScore: 0, maxResto: 2 }, { minScore: 25, maxResto: 2 }, { minScore: 50, maxResto: 3 }, { minScore: 75, maxResto: 1 }], pursueChinchon: true, chinchonThreshold: 6, chinchonRunMode: false },
},
];

const BUILTIN_BOTS = BUILTIN_BOT_CONFIGS.map(buildBotFromConfig);

let BOT = [...BUILTIN_BOTS];
function syncBots(customConfigs) { BOT = [...BUILTIN_BOTS, ...customConfigs.map(buildCustomBot)]; }

/* ==============================================================
GAME ENGINE
============================================================== */
const deepH = (h) => h.map(c => ({ ...c }));
const deepD = (d) => d.map(c => ({ ...c }));

function simulateGamePair(bi0, bi1) {
const b0 = BOT[bi0], b1 = BOT[bi1];
const scA = [0, 0], scB = [0, 0];
let dealer = 0; const statsA = [], statsB = [];
let aOver = false, bOver = false;
while (!aOver || !bOver) {
const fd = shuffle(createDeck());
const h0 = fd.splice(0, 7), h1 = fd.splice(0, 7), deck = fd;
const starterA = dealer === 0 ? 1 : 0;
// Mirror: swap hands AND swap who starts
const starterB = 1 - starterA;

// Game A: bot0 has h0, bot1 has h1
if (!aOver) {
  let rA;
  if (starterA === 0) { rA = playRoundScored(deepH(h0), deepH(h1), deepD(deck), b0, b1, [scA[0], scA[1]]); }
  else { const raw = playRoundScored(deepH(h1), deepH(h0), deepD(deck), b1, b0, [scA[1], scA[0]]); rA = { winner: raw.winner === 0 ? 1 : 0, cards: raw.cards, addScores: [raw.addScores[1], raw.addScores[0]], chinchon: raw.chinchon }; }
  if (rA.chinchon) { aOver = true; statsA.push({ winner: rA.winner, cards: rA.cards, chinchon: true }); scA[rA.winner === 0 ? 1 : 0] = 999; }
  else { scA[0] += rA.addScores[0]; scA[1] += rA.addScores[1]; statsA.push({ winner: rA.winner, cards: rA.cards, chinchon: false }); if (scA[0] >= 100 || scA[1] >= 100) aOver = true; }
}
// Game B (mirror): bot0 has h1, bot1 has h0, starter inverted
if (!bOver) {
  let rB;
  if (starterB === 0) { rB = playRoundScored(deepH(h1), deepH(h0), deepD(deck), b0, b1, [scB[0], scB[1]]); }
  else { const raw = playRoundScored(deepH(h0), deepH(h1), deepD(deck), b1, b0, [scB[1], scB[0]]); rB = { winner: raw.winner === 0 ? 1 : 0, cards: raw.cards, addScores: [raw.addScores[1], raw.addScores[0]], chinchon: raw.chinchon }; }
  if (rB.chinchon) { bOver = true; statsB.push({ winner: rB.winner, cards: rB.cards, chinchon: true }); scB[rB.winner === 0 ? 1 : 0] = 999; }
  else { scB[0] += rB.addScores[0]; scB[1] += rB.addScores[1]; statsB.push({ winner: rB.winner, cards: rB.cards, chinchon: false }); if (scB[0] >= 100 || scB[1] >= 100) bOver = true; }
}
dealer = 1 - dealer;

}
return [
{ gameLoser: scA[0] >= 100 ? 0 : 1, scores: scA, roundStats: statsA },
{ gameLoser: scB[0] >= 100 ? 0 : 1, scores: scB, roundStats: statsB },
];
}

/* -- Replay -- */
function playReplay(h0, h1, deckIn, strat0, strat1, scores) {
const h = [h0, h1], deck = deckIn, st = [strat0, strat1], dr = [0, 0], steps = [], dp = [];
const sn = () => [h[0].map(c => ({ ...c })), h[1].map(c => ({ ...c }))];
const ms = () => [findBestMelds(h[0]), findBestMelds(h[1])];
// Starter (h0) gets 8 cards
if (deck.length) h[0].push(deck.pop());
steps.push({ type: "deal", hands: sn(), melds: ms(), drawn: [0, 0] });
// Starter initial discard (no draw on first turn)
{ const wi = legalDiscardIndex(h[0], st[0].pickDiscard(h[0]));
  const disc = h[0].splice(wi, 1)[0]; dp.push(disc);
  const m7 = findBestMelds(h[0]);
  steps.push({ type: "initial_discard", player: 0, discarded: { ...disc }, hands: sn(), melds: ms(), freeCards: m7.minFree, drawn: [...dr] });
  if (st[0].canCut(m7, scores[0], h[0])) {
    const cs = cutScore(h[0]);
    steps.push({ type: "cut", player: 0, card: null, kept: false, discarded: { ...disc }, hands: sn(), melds: ms(), freeCards: m7.minFree, drawn: [...dr], chinchon: cs.chinchon, score: cs.score }); return steps;
  }
}
// Player 1 can cut with initial 7 cards
{ const m7 = findBestMelds(h[1]); if (st[1].canCut(m7, scores[1], h[1])) {
  const cs = cutScore(h[1]);
  steps.push({ type: "cut", player: 1, card: null, kept: false, discarded: null, hands: sn(), melds: ms(), freeCards: m7.minFree, drawn: [...dr], chinchon: cs.chinchon, score: cs.score }); return steps; } }
// Main loop: player 1 goes first
for (let t = 0; t < 80; t++) {
const p = 1 - (t % 2); if (!deck.length) break;
const top = dp.length ? dp[dp.length - 1] : null;
let card;
if (top && st[p].drawConfig && shouldDrawDiscard(h[p], top, st[p])) { card = dp.pop(); }
else { card = deck.pop(); }
h[p].push(card);
const wi = legalDiscardIndex(h[p], st[p].pickDiscard(h[p]));
const disc = h[p][wi]; const kept = !sameCard(disc, card); h[p].splice(wi, 1);
dp.push(disc);
if (kept) dr[p]++;
const m7 = findBestMelds(h[p]);
if (st[p].canCut(m7, scores[p], h[p])) {
const cs = cutScore(h[p]);
steps.push({ type: "cut", player: p, card: { ...card }, kept, discarded: { ...disc }, hands: sn(), melds: ms(), freeCards: m7.minFree, resto: m7.resto, drawn: [...dr], chinchon: cs.chinchon, score: cs.score }); return steps; }
steps.push({ type: "turn", player: p, card: { ...card }, kept, discarded: { ...disc }, hands: sn(), melds: ms(), freeCards: m7.minFree, resto: m7.resto, drawn: [...dr] });
}
const d0 = findBestMelds(h[0]), d1 = findBestMelds(h[1]);
steps.push({ type: "timeout", winner: d0.minFree <= d1.minFree ? 0 : 1, hands: sn(), melds: ms(), restos: [d0.resto, d1.resto], frees: [d0.minFree, d1.minFree], drawn: [...dr] });
return steps;
}
function generateReplayPair(bi0, bi1) {
const fd = shuffle(createDeck()); const h0 = fd.splice(0, 7), h1 = fd.splice(0, 7), deck = fd;
// Round A: bot0 in slot0 with h0 (starts), bot1 in slot1 with h1
const replayA = playReplay(deepH(h0), deepH(h1), deepD(deck), BOT[bi0], BOT[bi1], [0, 0]);
// Round B (mirror): swap hands AND who starts → bot1 in slot0 with h0 (starts), bot0 in slot1 with h1
const replayB = playReplay(deepH(h0), deepH(h1), deepD(deck), BOT[bi1], BOT[bi0], [0, 0]);
return { replayA, replayB };
}

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
// Initial turn: bot has 8 cards, only discards (no draw)
if (hand.length === 8) {
  const wi = legalDiscardIndex(hand, botObj.pickDiscard(hand)); const disc = hand.splice(wi, 1)[0]; dp.push(disc);
  const m7 = findBestMelds(hand);
  if (botObj.canCut(m7, g.scores[1], hand)) {
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
if (botObj.drawConfig) { drawDisc = shouldDrawDiscard(hand, top, botObj); }
else { const t2 = [...hand, { ...top }]; const b7 = findBestMelds(hand); const a8 = findBestMelds(t2); if (a8.minFree < b7.minFree || a8.resto < b7.resto - 3) drawDisc = true; }
}
let drawn;
if (drawDisc && dp.length) drawn = dp.pop(); else if (deck.length) drawn = deck.pop();
else return { ...g, phase: "roundEnd", roundResult: { reason: "empty" } };
hand.push(drawn);
const wi = legalDiscardIndex(hand, botObj.pickDiscard(hand)); const disc = hand.splice(wi, 1)[0]; dp.push(disc);
const m7 = findBestMelds(hand);
if (botObj.canCut(m7, g.scores[1], hand)) {
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
const sz = small ? "w-8 h-12 text-xs" : "w-11 h-16 text-sm";
if (faceDown) return (
<div className={`${sz} bg-indigo-900 border border-indigo-700 rounded flex items-center justify-center shrink-0`}><span className="text-indigo-500 text-lg">?</span></div>
);
const j = isJoker(card);
const bg = selected ? "bg-blue-800 border-blue-400 ring-2 ring-blue-400"
: highlight === "drawn" ? "bg-yellow-900/80 border-yellow-500 ring-1 ring-yellow-500/40"
: highlight === "discarded" ? "bg-red-900/60 border-red-500 opacity-50"
: j ? (inMeld ? "bg-purple-900 border-purple-400" : "bg-purple-950 border-purple-700")
: inMeld ? "bg-gray-800 border-gray-500" : "bg-gray-900 border-gray-700";
const color = j ? "#e879f9" : SUIT_COLOR[card.suit];
return (
<div className={`${sz} ${bg} border rounded flex flex-col items-center justify-center font-mono leading-tight shrink-0 ${onClick ? "cursor-pointer active:scale-95" : ""}`}
style={{ color }} onClick={onClick}>
{j ? <span className="text-lg leading-none">🃏</span> : <><span className="font-bold">{RANK_LABEL[card.rank]}</span><span className="text-xs leading-none">{SUIT_ICON[card.suit]}</span></>}
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

function BotPicker({ label, value, onChange, exclude }) {
return (
<div className="flex flex-col items-center gap-1">
<span className="text-xs text-gray-500">{label}</span>
<div className="flex flex-wrap gap-1.5 justify-center">
{BOT.map((b, i) => {
const dis = exclude !== undefined && exclude === i;
return (
<button key={i} disabled={dis} onClick={() => onChange(i)}
className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${value === i ? "border-2 scale-105" : `border-gray-700 ${dis ? "opacity-20" : "hover:border-gray-500"}`}`}
style={value === i ? { borderColor: b.color, color: b.color, background: `${b.color}15` } : { color: dis ? "#333" : b.color }}>
{b.emoji} {b.name}
</button>
);
})}
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
const extras = [];
if (cfg.cut?.pursueChinchon) extras.push(`persigue chinchón desde ${cfg.cut.chinchonThreshold ?? 6} cartas en posición`);
if (cfg.cut?.chinchonRunMode) extras.push("con corrida de 4+ cartas del mismo palo, espera el chinchón");
return [
`${cfg.emoji} ${cfg.name}`,
cfg.description ? `"${cfg.description}"` : null,
`  Robo: ${drawDescs[cfg.draw?.mode] ?? cfg.draw?.mode}`,
`  Descarte: ${discardDescs[cfg.discard?.mode] ?? cfg.discard?.mode}`,
`  Corte: ${cutDesc}`,
extras.length ? `  Especial: ${extras.join("; ")}` : null,
].filter(Boolean).join("\n");
}

function generateSimPrompt(cfg0, cfg1, metrics) {
const { gameWins, roundWins, sweepWins, chinchonWins, totalRounds, numGames } = metrics;
const total = gameWins[0] + gameWins[1];
const totalPairs = sweepWins[0] + sweepWins[1] + sweepWins[2];
return `Tengo dos bots de Chinchón (baraja española de 50 cartas, incluyendo 2 comodines) que simularon ${numGames} partidas espejo.

REGLAS RELEVANTES:
- 7 cartas por jugador. En su turno: roba del mazo o descarte, luego descarta 1.
- Melds válidos: escalera de 3–7 cartas del mismo palo, o grupo de 3–4 cartas del mismo número.
- Se puede cortar cuando el resto (puntos de cartas sueltas) ≤ 5 y hay máximo 1 carta suelta. Resto = suma de valores de cartas fuera de melds.
- Si todas las cartas forman melds: corte con -10 puntos.
- Chinchón: 7 cartas consecutivas del mismo palo y sin comodines = victoria instantánea de la partida.
- El jugador acumula los puntos del que cortó al revés (o su propio resto si cortó). Se elimina a los 100 puntos.
- Partidas espejo: misma repartida de cartas, pero se intercambian manos y quien arranca. Neutraliza la aleatoriedad.

BOT 1:
${botConfigToPromptText(cfg0)}

BOT 2:
${botConfigToPromptText(cfg1)}

RESULTADOS (${numGames} partidas espejo = ${total} partidas totales):
- Partidas ganadas: ${cfg0.emoji} ${cfg0.name} ${gameWins[0]} (${((gameWins[0]/total)*100).toFixed(1)}%) vs ${cfg1.emoji} ${cfg1.name} ${gameWins[1]} (${((gameWins[1]/total)*100).toFixed(1)}%)
- Rondas ganadas: ${cfg0.name} ${roundWins[0]} (${((roundWins[0]/totalRounds)*100).toFixed(1)}%) vs ${cfg1.name} ${roundWins[1]} (${((roundWins[1]/totalRounds)*100).toFixed(1)}%) — ${totalRounds} rondas totales
- Promedio de rondas por partida: ${(totalRounds / total).toFixed(1)}
- Doble espejo (gana ambas con misma repartida): ${cfg0.name} ${sweepWins[0]} (${((sweepWins[0]/totalPairs)*100).toFixed(1)}%), ${cfg1.name} ${sweepWins[1]} (${((sweepWins[1]/totalPairs)*100).toFixed(1)}%), empates ${sweepWins[2]}
- Chinchones: ${cfg0.name} ${chinchonWins[0]} vs ${cfg1.name} ${chinchonWins[1]}

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
  "draw": {
    "mode": "always_deck" | "smart" | "aggressive",
    //   always_deck → nunca roba del descarte
    //   smart       → roba del descarte solo si reduce el resto en más de restoThreshold puntos
    //   aggressive  → roba del descarte ante cualquier mejora de resto
    "restoThreshold": number  // 1–10; solo relevante si mode = "smart"
  },
  "discard": {
    "mode": "default" | "high_rank" | "optimal"
    //   default    → descarta la carta suelta con mayor valor en puntos
    //   high_rank  → descarta la carta con número más alto, incluso si está en meld parcial
    //   optimal    → evalúa los 8 posibles descartes y elige el que deja la mejor mano (más inteligente)
  },
  "cut": {
    "maxFree": 0 | 1,         // 0 = solo corta sin cartas sueltas; 1 = tolera hasta 1 carta suelta
    "baseResto": number,       // 0–5; umbral de resto máximo para cortar (si useScoreRules = false)
    "useScoreRules": boolean,  // true = usa scoreRules en lugar de baseResto
    "scoreRules": [            // exactamente 4 entradas fijas, una por rango de puntaje propio
      { "minScore": 0,  "maxResto": number },   // cuando tengo 0–24 puntos
      { "minScore": 25, "maxResto": number },   // cuando tengo 25–49 puntos
      { "minScore": 50, "maxResto": number },   // cuando tengo 50–74 puntos
      { "minScore": 75, "maxResto": number }    // cuando tengo 75+ puntos (cerca del límite)
    ],
    "pursueChinchon": boolean,     // true = cuando está cerca del chinchón, solo corta con mano perfecta
    "chinchonThreshold": 5 | 6,    // 6 = le faltan 1–2 cartas; 5 = activa antes (más ambicioso)
    "chinchonRunMode": boolean      // true = con corrida de 4+ cartas del mismo palo, espera el chinchón
  }
}`;

const example = `{
  "name": "EjemploBot",
  "emoji": "🧠",
  "colorIdx": 1,
  "description": "Equilibrado: roba del descarte cuando conviene y ajusta el umbral de corte según el marcador.",
  "draw": { "mode": "smart", "restoThreshold": 3 },
  "discard": { "mode": "default" },
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
    "pursueChinchon": false,
    "chinchonThreshold": 6,
    "chinchonRunMode": false
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

/* -- Bot Editor sub-component -- */
function BotEditor({ config, onSave, onCancel }) {
const [cfg, setCfg] = useState(() => JSON.parse(JSON.stringify(config)));
const upd = (path, val) => {
const next = JSON.parse(JSON.stringify(cfg));
const keys = path.split(".");
let obj = next;
for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
obj[keys[keys.length - 1]] = val;
setCfg(next);
};
const updRule = (idx, val) => {
const next = JSON.parse(JSON.stringify(cfg));
next.cut.scoreRules[idx].maxResto = val;
setCfg(next);
};
const c = CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length];

return (
<div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl p-4">
<h3 className="text-sm font-bold text-gray-200 mb-3">{config.id ? "Editar Bot" : "Nuevo Bot"}</h3>

{/* Name + Emoji + Color */}
<div className="mb-4">
<label className="text-xs text-gray-500 block mb-1">Nombre</label>
<input type="text" value={cfg.name} maxLength={12} onChange={e => upd("name", e.target.value)}
className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 w-full focus:border-gray-500 focus:outline-none" />
</div>
<div className="mb-4">
<label className="text-xs text-gray-500 block mb-1">Descripción <span className="text-gray-600">(opcional)</span></label>
<textarea value={cfg.description ?? ""} maxLength={120} rows={2} onChange={e => upd("description", e.target.value)}
placeholder="Describí la estrategia de tu bot en pocas palabras..."
className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 w-full focus:border-gray-500 focus:outline-none resize-none" />
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

{/* Draw */}
<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>🃏 Estrategia de robo</div>
<p className="text-xs text-gray-500 mb-2 leading-snug">¿Cuándo toma cartas del pozo de descarte en lugar del mazo?</p>
<div className="flex flex-col gap-2">
{([
["always_deck", "Solo del mazo", "Nunca toma del descarte. Predecible, no revela qué cartas le sirven."],
["smart", "Inteligente (umbral)", "Toma del descarte solo si reduce el resto más que el umbral configurado. Balanceado."],
["aggressive", "Agresivo", "Toma del descarte ante cualquier mejora de resto. Reactivo y oportunista."],
] as [string, string, string][]).map(([m, title, desc]) => (
<label key={m} className="flex items-start gap-2 cursor-pointer">
<input type="radio" name="draw" checked={cfg.draw.mode === m} onChange={() => upd("draw.mode", m)}
className="accent-amber-500 mt-0.5 shrink-0" />
<div>
<span className={`text-sm ${cfg.draw.mode === m ? "text-gray-100 font-medium" : "text-gray-300"}`}>{title}</span>
<p className="text-xs text-gray-500 leading-snug">{desc}</p>
</div>
</label>
))}
</div>
{cfg.draw.mode === "smart" && (
<div className="mt-3 border border-gray-600 rounded p-2">
<div className="flex items-center gap-2">
<span className="text-xs text-gray-400">Umbral de resto:</span>
<input type="range" min={1} max={10} value={cfg.draw.restoThreshold} onChange={e => upd("draw.restoThreshold", +e.target.value)}
className="flex-1 accent-amber-500" />
<span className="text-xs font-mono text-amber-400 w-5 text-right">{cfg.draw.restoThreshold}</span>
</div>
<p className="text-xs text-gray-600 mt-1 leading-snug">Toma del descarte solo si reduce el resto en más de {cfg.draw.restoThreshold} pts. Mayor = más conservador.</p>
</div>
)}
</div>

{/* Discard */}
<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>🗑️ Estrategia de descarte</div>
<p className="text-xs text-gray-500 mb-2 leading-snug">¿Qué carta elimina de su mano en cada turno?</p>
<div className="flex flex-col gap-2">
{([
["default", "Por valor (recomendado)", "Descarta la carta suelta con mayor valor en puntos. Minimiza el resto de forma directa."],
["high_rank", "Por rango numérico", "Descarta la carta con número más alto aunque forme parte de un meld parcial. Más agresivo."],
["optimal", "Óptimo (más lento)", "Evalúa las 8 posibles cartas a descartar y elige la que deja la mejor mano. Más inteligente pero más costoso computacionalmente."],
] as [string, string, string][]).map(([m, title, desc]) => (
<label key={m} className="flex items-start gap-2 cursor-pointer">
<input type="radio" name="discard" checked={cfg.discard.mode === m} onChange={() => upd("discard.mode", m)}
className="accent-amber-500 mt-0.5 shrink-0" />
<div>
<span className={`text-sm ${cfg.discard.mode === m ? "text-gray-100 font-medium" : "text-gray-300"}`}>{title}</span>
<p className="text-xs text-gray-500 leading-snug">{desc}</p>
</div>
</label>
))}
</div>
</div>

{/* Cut */}
<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-1" style={{ color: c.color }}>✂️ Condición de corte</div>
<p className="text-xs text-gray-500 mb-3 leading-snug">¿Cuándo decide que su mano es suficientemente buena para cortar la ronda?</p>

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
<p className="text-xs text-gray-500 mb-1.5 leading-snug">Suma máxima de las cartas sueltas para decidir cortar. El reglamento limita el corte a resto ≤ 5. 0 = solo corta sin puntos sueltos.</p>
<input type="range" min={0} max={5} value={cfg.cut.baseResto} onChange={e => upd("cut.baseResto", +e.target.value)}
className="w-full accent-amber-500" />
</div>
)}

<div className="border-t border-gray-700 pt-3 mb-3">
<label className="flex items-start gap-2 cursor-pointer">
<input type="checkbox" checked={cfg.cut.useScoreRules} onChange={e => upd("cut.useScoreRules", e.target.checked)}
className="accent-amber-500 mt-0.5 shrink-0" />
<div>
<span className={`text-sm ${cfg.cut.useScoreRules ? "text-gray-100 font-medium" : "text-gray-300"}`}>Corte adaptativo por puntaje</span>
<p className="text-xs text-gray-500 leading-snug">Cambia el umbral de resto según los puntos acumulados. Permite estrategias más conservadoras cuando va ganando o más agresivas cuando pierde terreno.</p>
</div>
</label>
{cfg.cut.useScoreRules && (
<div className="ml-5 flex flex-col gap-2 mt-3">
{cfg.cut.scoreRules.map((r, i) => (
<div key={i} className="flex items-center gap-2">
<span className="text-xs text-gray-500 w-20 shrink-0">{r.minScore === 0 ? "0–24 pts" : r.minScore === 25 ? "25–49 pts" : r.minScore === 50 ? "50–74 pts" : "75+ pts"}:</span>
<span className="text-xs text-gray-400 shrink-0">resto ≤</span>
<input type="range" min={0} max={5} value={r.maxResto} onChange={e => updRule(i, +e.target.value)}
className="flex-1 accent-amber-500" />
<span className="text-xs font-mono text-amber-400 w-5 text-right">{r.maxResto}</span>
</div>
))}
</div>
)}
</div>

<div className="border-t border-gray-700 pt-3 flex flex-col gap-3">
<label className="flex items-start gap-2 cursor-pointer">
<input type="checkbox" checked={cfg.cut.pursueChinchon} onChange={e => upd("cut.pursueChinchon", e.target.checked)}
className="accent-amber-500 mt-0.5 shrink-0" />
<div>
<span className={`text-sm ${cfg.cut.pursueChinchon ? "text-gray-100 font-medium" : "text-gray-300"}`}>🎯 Perseguir chinchón</span>
<p className="text-xs text-gray-500 leading-snug">Si detecta que está cerca del chinchón, espera y solo corta con todas las cartas en melds (resto 0). Alto riesgo, alta recompensa.</p>
</div>
</label>
{cfg.cut.pursueChinchon && (
<div className="ml-5">
<span className="text-xs font-medium text-gray-400 block mb-1.5">¿Cuándo activar el modo chinchón?</span>
<div className="flex gap-1.5">
{([5, 6] as number[]).map(v => (
<button key={v} onClick={() => upd("cut.chinchonThreshold", v)}
className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${(cfg.cut.chinchonThreshold ?? 6) === v ? "border-2" : "border-gray-600 text-gray-400 hover:border-gray-500"}`}
style={(cfg.cut.chinchonThreshold ?? 6) === v ? { borderColor: c.color, color: c.color, background: `${c.color}15` } : {}}>
{v === 6 ? "6 cartas — estricto" : "5 cartas — ambicioso"}
</button>
))}
</div>
<p className="text-xs text-gray-600 mt-1.5 leading-snug">
{(cfg.cut.chinchonThreshold ?? 6) === 6
? "Persigue el chinchón solo cuando le faltan 1–2 cartas para completarlo."
: "Comienza a perseguir el chinchón antes, incluso cuando le faltan 2–3 cartas."}
</p>
</div>
)}
<label className="flex items-start gap-2 cursor-pointer">
<input type="checkbox" checked={cfg.cut.chinchonRunMode ?? false} onChange={e => upd("cut.chinchonRunMode", e.target.checked)}
className="accent-amber-500 mt-0.5 shrink-0" />
<div>
<span className={`text-sm ${cfg.cut.chinchonRunMode ? "text-gray-100 font-medium" : "text-gray-300"}`}>🏃 Modo corrida</span>
<p className="text-xs text-gray-500 leading-snug">Si tiene 4 o más cartas del mismo palo consecutivas, espera para hacer chinchón (solo corta con todas en melds). Independiente del umbral de corte normal.</p>
</div>
</label>
</div>
</div>

{/* Preview */}
<div className="mb-4 bg-gray-950 border border-gray-800 rounded-lg p-3">
<div className="text-xs text-gray-500 mb-1">Vista previa</div>
<div className="flex items-center gap-2">
<span className="text-lg">{cfg.emoji}</span>
<span className="font-bold text-sm" style={{ color: c.color }}>{cfg.name || "Sin nombre"}</span>
</div>
<div className="text-xs text-gray-400 mt-1">{generateDesc(cfg)}</div>
</div>

{/* Actions */}
<div className="flex gap-2 justify-end">
<button onClick={onCancel} className="px-4 py-1.5 rounded-md text-sm text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 transition-colors">Cancelar</button>
<button onClick={() => { if (!cfg.name.trim()) return; onSave(cfg); }}
className="px-4 py-1.5 rounded-md text-sm font-semibold text-white transition-colors"
style={{ background: c.color }}>
Guardar
</button>
</div>
</div>
);
}

/* -- BotViewer: read-only config display -- */
function BotViewer({ config, onClose }) {
const cfg = config;
const color = cfg.color ?? CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length].color;
const bg = cfg.bg ?? CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length].bg;
const border = cfg.border ?? CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length].border;
const drawLabels = { always_deck: "Solo del mazo", smart: "Inteligente (umbral)", aggressive: "Agresivo" };
const discardLabels = { default: "Por valor", high_rank: "Por rango numérico", optimal: "Óptimo" };

return (
<div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl p-4">
<div className="flex items-center gap-2 mb-3">
<span className="text-2xl">{cfg.emoji}</span>
<span className="font-bold text-lg" style={{ color }}>{cfg.name}</span>
<span className="text-xs text-gray-600 ml-auto">Solo lectura</span>
</div>

{cfg.description && (
<div className={`mb-4 ${bg} border ${border} rounded-lg p-3`}>
<p className="text-sm text-gray-200 leading-snug">{cfg.description}</p>
</div>
)}

<div className="mb-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-2" style={{ color }}>🃏 Robo</div>
<div className="text-sm text-gray-200 font-medium">{drawLabels[cfg.draw.mode] ?? cfg.draw.mode}</div>
{cfg.draw.mode === "smart" && <p className="text-xs text-gray-500 mt-0.5">Umbral de resto: {cfg.draw.restoThreshold} pts</p>}
{cfg.draw.mode === "aggressive" && <p className="text-xs text-gray-500 mt-0.5">Toma del descarte ante cualquier mejora de resto.</p>}
{cfg.draw.mode === "always_deck" && <p className="text-xs text-gray-500 mt-0.5">Nunca toma del descarte.</p>}
</div>

<div className="mb-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-2" style={{ color }}>🗑️ Descarte</div>
<div className="text-sm text-gray-200 font-medium">{discardLabels[cfg.discard.mode] ?? cfg.discard.mode}</div>
<p className="text-xs text-gray-500 mt-0.5">
{cfg.discard.mode === "default" && "Descarta la carta suelta con mayor valor en puntos."}
{cfg.discard.mode === "high_rank" && "Descarta la carta con número más alto, sin importar melds parciales."}
{cfg.discard.mode === "optimal" && "Evalúa las 8 posibles cartas y elige la que deja la mejor mano."}
</p>
</div>

<div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
<div className="text-xs font-bold mb-2" style={{ color }}>✂️ Corte</div>
<div className="flex flex-col gap-1.5 text-sm">
<div className="text-gray-300">Cartas sueltas máx: <span className="text-gray-100 font-medium">{cfg.cut.maxFree}</span></div>
{!cfg.cut.useScoreRules && <div className="text-gray-300">Resto máx: <span className="text-gray-100 font-medium">{cfg.cut.baseResto} pts</span></div>}
{cfg.cut.useScoreRules && (
<div>
<div className="text-xs text-gray-500 mb-1">Corte adaptativo por puntaje:</div>
<div className="flex flex-col gap-0.5">
{cfg.cut.scoreRules.map((r, i) => (
<div key={i} className="text-xs flex gap-2">
<span className="text-gray-500 w-20 shrink-0">{r.minScore === 0 ? "0–24 pts" : r.minScore === 25 ? "25–49 pts" : r.minScore === 50 ? "50–74 pts" : "75+ pts"}:</span>
<span className="text-gray-300">resto ≤ <span className="text-gray-100 font-medium">{r.maxResto}</span></span>
</div>
))}
</div>
</div>
)}
{cfg.cut.chinchonRunMode && <div className="text-gray-300">🏃 <span className="text-gray-100">Modo corrida</span> — con 4+ cartas del mismo palo consecutivas, espera el chinchón.</div>}
{cfg.cut.pursueChinchon && <div className="text-gray-300">🎯 <span className="text-gray-100">Persigue chinchón</span> — umbral de {cfg.cut.chinchonThreshold ?? 6} cartas en posición.</div>}
</div>
</div>

<div className="text-xs text-gray-600 mb-4 leading-snug"><span className="font-medium text-gray-500">Resumen: </span>{generateDesc(cfg)}</div>

<div className="flex justify-end">
<button onClick={onClose} className="px-4 py-1.5 rounded-md text-sm text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 transition-colors">Cerrar</button>
</div>
</div>
);
}

/* -- Play sub-component -- */
function PlayGame({ g, bot, history, showBot, bML, pML, topD, canPlayerCut, setShowBot, playerDraw, selectCard, nextRound, resetGame, sortHand, toggleCutMode }) {
const [spyModal, setSpyModal] = useState(false);
const dragSrcRef = useRef(null);
const dragOccurred = useRef(false);

const handleSpy = () => {
if (showBot) { setShowBot(false); return; }
setSpyModal(true);
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
        <button onClick={handleSpy} className="text-xs text-gray-600 hover:text-gray-400">{showBot ? "Ocultar cartas" : "Espiar 👀"}</button>
      </div>
      {g.botLastAction && (
        <div className="text-xs text-center text-gray-500 mb-2 bg-gray-900/60 border border-gray-800 rounded px-2 py-1.5">
          <span style={{ color: bot.color }}>{bot.name}</span>
          {g.botLastAction.drew === "initial" ? " descartó " : g.botLastAction.drew === "discard" ? " robó del descarte y tiró " : " robó del mazo y tiró "}
          <span className="font-mono text-gray-300">{cardLabel(g.botLastAction.discarded)}</span>
        </div>
      )}
      <div className="flex items-center justify-center gap-4 mb-3">
        <div className={`flex flex-col items-center ${g.phase === "playerDraw" && g.turn === 0 ? "cursor-pointer" : ""}`} onClick={() => g.phase === "playerDraw" && g.turn === 0 && playerDraw("deck")}>
          <div className={`w-11 h-16 bg-indigo-900 border-2 ${g.phase === "playerDraw" && g.turn === 0 ? "border-indigo-400 ring-2 ring-indigo-400/30" : "border-indigo-700"} rounded flex items-center justify-center`}>
            <span className="text-indigo-400 font-bold text-sm">{g.deck.length}</span>
          </div><span className="text-xs text-gray-500 mt-0.5">Mazo</span>
        </div>
        <div className={`flex flex-col items-center ${g.phase === "playerDraw" && g.turn === 0 && topD ? "cursor-pointer" : ""}`} onClick={() => g.phase === "playerDraw" && g.turn === 0 && topD && playerDraw("discard")}>
          {topD ? <div className={g.phase === "playerDraw" && g.turn === 0 ? "ring-2 ring-amber-400/30 rounded" : ""}><CardC card={topD} /></div>
            : <div className="w-11 h-16 border-2 border-dashed border-gray-700 rounded flex items-center justify-center"><span className="text-gray-700 text-xs">∅</span></div>}
          <span className="text-xs text-gray-500 mt-0.5">Descarte</span>
        </div>
      </div>
      {g.phase === "playerDraw" && g.turn === 0 && <div className="text-center text-sm text-sky-400 mb-2">Agarrá del mazo o del descarte</div>}
      {g.phase === "playerDiscard" && <div className="text-center text-sm text-sky-400 mb-2">{g.pHand.length === 8 ? "Inicio: tenés 8 cartas, tocá una para descartarla" : g.cutMode ? "¿Qué carta tirás para cortar?" : "Tocá una carta para descartarla"}</div>}
      {g.phase === "botTurn" && <div className="text-center text-sm text-gray-500 mb-2">{bot.name} está jugando...</div>}
      {g.message && <div className="text-center text-xs text-red-400 mb-2">{g.message}</div>}

      <div className="rounded-lg p-3 bg-sky-950 border border-sky-800">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm text-sky-400">Tu mano</span>
          {pML && <span className="text-xs text-gray-500">Sueltas: {pML.minFree} · Resto: {pML.resto}</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {g.pHand.map((c, i) => {
            const meldSet = new Set((pML?.meldsCut || pML?.melds || []).flat());
            const inMeld = meldSet.has(i);
            const isDraw = g.drawnCard && sameCard(c, g.drawnCard);
            const canDrag = g.phase === "playerDiscard";
            return (
              <div
                key={`${c.rank}-${c.suit}-${i}`}
                draggable={canDrag}
                onDragStart={(e) => { dragSrcRef.current = i; dragOccurred.current = false; e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => { e.preventDefault(); if (dragSrcRef.current === null || dragSrcRef.current === i) return; dragOccurred.current = true; const newHand = [...g.pHand]; const [moved] = newHand.splice(dragSrcRef.current, 1); newHand.splice(i, 0, moved); dragSrcRef.current = null; setG({ ...g, pHand: newHand, selectedIdx: null }); }}
                onDragEnd={() => { setTimeout(() => { dragOccurred.current = false; }, 50); dragSrcRef.current = null; }}
              >
                <CardC card={c} inMeld={inMeld} highlight={isDraw ? "drawn" : null}
                  onClick={g.phase === "playerDiscard" ? () => { if (!dragOccurred.current) selectCard(i); } : null}
                  faceDown={false} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sort + cut button */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          <button onClick={() => sortHand("suit")} className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-2 py-1 rounded">Por palo</button>
          <button onClick={() => sortHand("rank")} className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-2 py-1 rounded">Por número</button>
        </div>
        {g.phase === "playerDiscard" && canPlayerCut && (
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
  {g.phase !== "gameOver" && <div className="flex justify-center mt-3"><button onClick={resetGame} className="text-xs text-gray-600 hover:text-gray-400">Abandonar</button></div>}
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
useEffect(() => { saveCustomConfigs(customConfigs); syncBots(customConfigs); }, [customConfigs]);
// Initial sync on mount
useEffect(() => { syncBots(customConfigs); }, []);

const runBenchmark = useCallback((cfg) => {
  const botIdx = BOT.findIndex(b => b.id === cfg.id);
  if (botIdx < 0) return;
  setBenchmarking(cfg.id);
  setTimeout(() => {
    let wins = 0, total = 0;
    for (let i = 0; i < 25; i++) {
      const [gA, gB] = simulateGamePair(botIdx, 0);
      if (gA.gameLoser === 1) wins++;
      if (gB.gameLoser === 1) wins++;
      total += 2;
    }
    setBenchmarks(prev => ({ ...prev, [cfg.id]: { wins, total } }));
    setBenchmarking(null);
  }, 0);
}, []);

// Sim
const [simB0, setSimB0] = useState(0);
const [simB1, setSimB1] = useState(1);
const [numGames, setNumGames] = useState(50);
const [chartData, setChartData] = useState(null);
const [roundWins, setRoundWins] = useState([0, 0]);
const [gameWins, setGameWins] = useState([0, 0]);
const [sweepWins, setSweepWins] = useState([0, 0, 0]); // [bot0 sweeps, bot1 sweeps, splits]
const [totalRounds, setTotalRounds] = useState(0);
const [winRateHistory, setWinRateHistory] = useState<{games: number, rate: number}[]>([]);
const [sweepRateHistory, setSweepRateHistory] = useState<{pairs: number, rate0: number, rate1: number}[]>([]);
const [chinchonWins, setChinchonWins] = useState([0, 0]);
const [simRun, setSimRun] = useState(false);
const [prog, setProg] = useState(0);
const [promptCopied, setPromptCopied] = useState(false);
const [newBotPromptCopied, setNewBotPromptCopied] = useState(false);
const [chartTab, setChartTab] = useState<"winrate" | "sweep">("winrate");
const [chartZoom, setChartZoom] = useState<number | null>(null);
const stopRef = useRef(false);

// Tournament
const [tourBots, setTourBots] = useState([0, 1, 2, 3]);
const [tourResults, setTourResults] = useState(null);
const [tourRunning, setTourRunning] = useState(false);
const [tourProgress, setTourProgress] = useState(0);
const [tourCurrentPair, setTourCurrentPair] = useState(null);
const [tourCurrentStats, setTourCurrentStats] = useState(null);
const stopTourRef = useRef(false);

// Stabilization config — Sim
const [useStabilized, setUseStabilized] = useState(false);
const [stabilizeDecimals, setStabilizeDecimals] = useState(1);

// Stabilization config — Tournament
const [tourUseStabilized, setTourUseStabilized] = useState(true);
const [tourStabilizeDecimals, setTourStabilizeDecimals] = useState(1);

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
stopRef.current = false; setSimRun(true); setProg(0); setChartData(null);
setRoundWins([0, 0]); setGameWins([0, 0]); setSweepWins([0, 0, 0]); setTotalRounds(0);
setWinRateHistory([]); setSweepRateHistory([]); setChinchonWins([0, 0]); setPromptCopied(false);
const fd = {}, dd = {}; let rw0 = 0, rw1 = 0, gw0 = 0, gw1 = 0, sw0 = 0, sw1 = 0, splits = 0, tr = 0, cc0 = 0, cc1 = 0, done = 0;
const wrSnaps: {games: number, rate: number}[] = [];
const swSnaps: {pairs: number, rate0: number, rate1: number}[] = [];
const n0 = BOT[simB0].name, n1 = BOT[simB1].name;
const tick = () => {
if (stopRef.current) { setSimRun(false); return; }
const batch = numGames <= 100 ? 1 : numGames <= 1000 ? 5 : numGames <= 10000 ? 50 : 200;
const end = Math.min(done + batch, numGames);
for (let i = done; i < end; i++) {
const [gA, gB] = simulateGamePair(simB0, simB1);
const winnerA = gA.gameLoser === 0 ? 1 : 0;
const winnerB = gB.gameLoser === 0 ? 1 : 0;
if (winnerA === 0) gw0++; else gw1++;
if (winnerB === 0) gw0++; else gw1++;
if (winnerA === 0 && winnerB === 0) sw0++;
else if (winnerA === 1 && winnerB === 1) sw1++;
else splits++;
for (const game of [gA, gB]) {
for (const rs of game.roundStats) {
tr++;
if (rs.winner === 0) { rw0++; fd[rs.cards] = (fd[rs.cards] || 0) + 1; } else { rw1++; dd[rs.cards] = (dd[rs.cards] || 0) + 1; }
if (rs.chinchon) { if (rs.winner === 0) cc0++; else cc1++; }
}
}
}
done = end;
const totalG = gw0 + gw1;
if (totalG > 0) wrSnaps.push({ games: totalG, rate: (gw0 / totalG) * 100 });
const totalPairs = sw0 + sw1 + splits;
if (totalPairs > 0) swSnaps.push({ pairs: totalPairs, rate0: (sw0 / totalPairs) * 100, rate1: (sw1 / totalPairs) * 100 });
setProg(Math.round(done / numGames * 100));
setChartData(buildChartData(fd, dd, n0, n1));
setRoundWins([rw0, rw1]); setGameWins([gw0, gw1]); setSweepWins([sw0, sw1, splits]); setTotalRounds(tr);
setWinRateHistory([...wrSnaps]); setSweepRateHistory([...swSnaps]); setChinchonWins([cc0, cc1]);
if (done < numGames) setTimeout(tick, 0); else setSimRun(false);
};
setTimeout(tick, 0);
}, [numGames, simB0, simB1]);

const runSimUntilStable = useCallback(() => {
stopRef.current = false; setSimRun(true); setProg(0); setChartData(null);
setRoundWins([0, 0]); setGameWins([0, 0]); setSweepWins([0, 0, 0]); setTotalRounds(0);
setWinRateHistory([]); setSweepRateHistory([]); setChinchonWins([0, 0]); setPromptCopied(false);
const fd = {}, dd = {}; let rw0 = 0, rw1 = 0, gw0 = 0, gw1 = 0, sw0 = 0, sw1 = 0, splits = 0, tr = 0, cc0 = 0, cc1 = 0, done = 0;
const wrSnaps: {games: number, rate: number}[] = [];
const swSnaps: {pairs: number, rate0: number, rate1: number}[] = [];
const n0 = BOT[simB0].name, n1 = BOT[simB1].name;
const STABLE_WINDOW = 20;
const STABLE_THRESHOLD = Math.pow(10, -stabilizeDecimals) * (stabilizeDecimals === 0 ? 3 : 1);
const MIN_GAMES = 200;
const MAX_GAMES = numGames;
const BATCH = 20;
const isStable = () => {
  if (!useStabilized) return false;
  if (wrSnaps.length < STABLE_WINDOW || done < MIN_GAMES) return false;
  const recent = wrSnaps.slice(-STABLE_WINDOW).map(s => s.rate);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const stddev = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
  return stddev < STABLE_THRESHOLD;
};
const tick = () => {
if (stopRef.current) { setSimRun(false); return; }
if (done >= MAX_GAMES) { setSimRun(false); setProg(100); return; }
for (let i = 0; i < BATCH; i++) {
if (done >= MAX_GAMES) break;
const [gA, gB] = simulateGamePair(simB0, simB1);
const winnerA = gA.gameLoser === 0 ? 1 : 0;
const winnerB = gB.gameLoser === 0 ? 1 : 0;
if (winnerA === 0) gw0++; else gw1++;
if (winnerB === 0) gw0++; else gw1++;
if (winnerA === 0 && winnerB === 0) sw0++;
else if (winnerA === 1 && winnerB === 1) sw1++;
else splits++;
for (const game of [gA, gB]) {
for (const rs of game.roundStats) {
tr++;
if (rs.winner === 0) { rw0++; fd[rs.cards] = (fd[rs.cards] || 0) + 1; } else { rw1++; dd[rs.cards] = (dd[rs.cards] || 0) + 1; }
if (rs.chinchon) { if (rs.winner === 0) cc0++; else cc1++; }
}
}
done++;
}
const totalG = gw0 + gw1;
if (totalG > 0) wrSnaps.push({ games: totalG, rate: (gw0 / totalG) * 100 });
const totalPairs = sw0 + sw1 + splits;
if (totalPairs > 0) swSnaps.push({ pairs: totalPairs, rate0: (sw0 / totalPairs) * 100, rate1: (sw1 / totalPairs) * 100 });
const progress = Math.round((done / MAX_GAMES) * 100);
setProg(Math.min(100, progress));
setChartData(buildChartData(fd, dd, n0, n1));
setRoundWins([rw0, rw1]); setGameWins([gw0, gw1]); setSweepWins([sw0, sw1, splits]); setTotalRounds(tr);
setWinRateHistory([...wrSnaps]); setSweepRateHistory([...swSnaps]); setChinchonWins([cc0, cc1]);
if (isStable() || done >= MAX_GAMES) { setSimRun(false); setProg(100); } else setTimeout(tick, 0);
};
setTimeout(tick, 0);
}, [simB0, simB1, useStabilized, stabilizeDecimals, numGames]);

const runTournament = useCallback(() => {
if (new Set(tourBots).size < 4) return;
stopTourRef.current = false;
setTourRunning(true);
setTourProgress(0);
setTourCurrentPair(0);
setTourCurrentStats(null);
setTourResults(null);

const n = 4;
const pairs = [];
for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);

const wins = Array.from({ length: n }, () => Array(n).fill(0));
const gamesPlayed = Array.from({ length: n }, () => Array(n).fill(0));
const mirrorWins = Array.from({ length: n }, () => Array(n).fill(0));
const mirrorPairs = Array.from({ length: n }, () => Array(n).fill(0));
const chinchones = Array.from({ length: n }, () => Array(n).fill(0));
const chinchonGames = Array.from({ length: n }, () => Array(n).fill(0));

const STABLE_WINDOW = 20;
const STABLE_THRESHOLD = Math.pow(10, -tourStabilizeDecimals) * (tourStabilizeDecimals === 0 ? 3 : 1);
const MIN_BATCHES = 200;
const MAX_BATCHES = numGames;
const BATCH = 20;
let pairIdx = 0, batchesDone = 0, currentWins = 0, currentTotal = 0, currentMirror = [0, 0], currentChinchones = [0, 0];
const winSnapshots = [];

const isStablePair = () => {
  if (!tourUseStabilized) return false;
  if (winSnapshots.length < STABLE_WINDOW || batchesDone < MIN_BATCHES) return false;
  const recent = winSnapshots.slice(-STABLE_WINDOW);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const stddev = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
  return stddev < STABLE_THRESHOLD;
};

const tick = () => {
  if (stopTourRef.current) { setTourRunning(false); return; }
  const [ai, bi] = pairs[pairIdx];
  const globalA = tourBots[ai], globalB = tourBots[bi];
  if (batchesDone >= MAX_BATCHES) {
    pairIdx++;
    batchesDone = 0; currentWins = 0; currentTotal = 0; currentMirror = [0, 0]; currentChinchones = [0, 0]; winSnapshots.length = 0;
    if (pairIdx >= pairs.length) { setTourRunning(false); setTourProgress(100); setTourCurrentPair(null); setTourCurrentStats(null); return; }
  }
  for (let i = 0; i < BATCH; i++) {
    const [gA, gB] = simulateGamePair(globalA, globalB);
    const wA = (gA.gameLoser === 1 ? 1 : 0) + (gB.gameLoser === 1 ? 1 : 0);
    wins[ai][bi] += wA;
    gamesPlayed[ai][bi] += 2;
    const winnerA = gA.gameLoser === 0 ? 1 : 0;
    const winnerB = gB.gameLoser === 0 ? 1 : 0;
    if (winnerA === 0 && winnerB === 0) { mirrorWins[ai][bi] += 1; currentMirror[0] += 1; }
    else if (winnerA === 1 && winnerB === 1) { mirrorWins[bi][ai] += 1; currentMirror[1] += 1; }
    mirrorPairs[ai][bi] += 1;
    const chinA0 = gA.roundStats.filter(rs => rs.chinchon && rs.winner === 0).length;
    const chinA1 = gA.roundStats.filter(rs => rs.chinchon && rs.winner === 1).length;
    const chinB0 = gB.roundStats.filter(rs => rs.chinchon && rs.winner === 0).length;
    const chinB1 = gB.roundStats.filter(rs => rs.chinchon && rs.winner === 1).length;
    const chinForA = chinA0 + chinB0;
    const chinForB = chinA1 + chinB1;
    chinchones[ai][bi] += chinForA;
    chinchones[bi][ai] += chinForB;
    chinchonGames[ai][bi] += 2;
    chinchonGames[bi][ai] += 2;
    currentChinchones[0] += chinForA;
    currentChinchones[1] += chinForB;
    currentWins += wA;
    currentTotal += 2;
  }
  batchesDone++;
  winSnapshots.push(currentTotal > 0 ? (currentWins / currentTotal) * 100 : 50);
  const stable = isStablePair();
  const fraction = stable || batchesDone >= MAX_BATCHES ? 1 : Math.min(batchesDone / MIN_BATCHES, 0.99);
  setTourProgress(Math.min(99, Math.round(((pairIdx + fraction) / pairs.length) * 100)));
  setTourCurrentPair(pairIdx);
  setTourCurrentStats({
    games: currentTotal,
    wins: [currentWins, currentTotal - currentWins],
    mirrorWins: [...currentMirror],
    chinchones: [...currentChinchones],
  });
  setTourResults({
    wins: wins.map(r => [...r]),
    games: gamesPlayed.map(r => [...r]),
    mirrorWins: mirrorWins.map(r => [...r]),
    mirrorPairs: mirrorPairs.map(r => [...r]),
    chinchones: chinchones.map(r => [...r]),
    chinchonGames: chinchonGames.map(r => [...r]),
  });
  if (stable || batchesDone >= MAX_BATCHES) {
    pairIdx++;
    batchesDone = 0; currentWins = 0; currentTotal = 0; currentMirror = [0, 0]; currentChinchones = [0, 0]; winSnapshots.length = 0;
    if (pairIdx >= pairs.length) { setTourRunning(false); setTourProgress(100); setTourCurrentPair(null); setTourCurrentStats(null); return; }
    setTourCurrentPair(pairIdx);
  }
  setTimeout(tick, 0);
};
setTimeout(tick, 0);
}, [tourBots, tourUseStabilized, tourStabilizeDecimals, numGames]);

// -- Match viewer --
const replay = replayPair ? (matchRound === "A" ? replayPair.replayA : replayPair.replayB) : null;
const matchSwapped = matchRound === "B";
const newReplay = () => { autoRef.current = false; setAutoP(false); setReplayPair(generateReplayPair(mvB0, mvB1)); setMatchRound("A"); setSi(0); };
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
const step = replay?.[si];
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
const pML = g?.pHand ? findBestMelds(g.pHand) : null;
const bML = g?.bHand ? findBestMelds(g.bHand) : null;
const topD = g?.discardPile?.length ? g.discardPile[g.discardPile.length - 1] : null;
const mvBots = [BOT[mvB0], BOT[mvB1]];
const bn = (slot) => matchSwapped ? mvBots[slot === 0 ? 1 : 0] : mvBots[slot];

return (
<div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center px-3 py-5 font-sans">
<h1 className="text-xl font-extrabold tracking-tight mb-0.5">Chinchón Lab</h1>
<p className="text-gray-600 text-xs mb-3">Baraja de 50 cartas (incluye 2 comodines) · {BOT.length} bots</p>

  <div className="flex gap-0.5 bg-gray-900 rounded-lg p-1 mb-4">
    {[["sim", "Simulación"], ["torneo", "Torneo"], ["match", "Ver Partida"], ["play", "Jugar"], ["custom", "Bots"], ["reglas", "Reglas"]].map(([k, l]) => (
      <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === k ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>{l}</button>
    ))}
  </div>

  {/* --- SIM --- */}
  {tab === "sim" && (
    <div className="flex flex-col items-center w-full max-w-2xl">
      <div className="flex flex-col gap-3 mb-4 w-full">
        <BotPicker label="Bot 1" value={simB0} onChange={(v) => { setSimB0(v); if (v === simB1) setSimB1(BOT.findIndex((_, i) => i !== v)); }} exclude={simB1} />
        <div className="text-center text-gray-600 text-xs">vs</div>
        <BotPicker label="Bot 2" value={simB1} onChange={(v) => { setSimB1(v); if (v === simB0) setSimB0(BOT.findIndex((_, i) => i !== v)); }} exclude={simB0} />
      </div>
      <div className="flex gap-3 mb-2 text-center text-xs text-gray-500">
        <div className="rounded-lg px-3 py-1.5 border" style={{ borderColor: BOT[simB0].color + "40", color: BOT[simB0].color }}>{BOT[simB0].emoji} {BOT[simB0].desc}</div>
        <div className="rounded-lg px-3 py-1.5 border" style={{ borderColor: BOT[simB1].color + "40", color: BOT[simB1].color }}>{BOT[simB1].emoji} {BOT[simB1].desc}</div>
      </div>
      <div className="flex flex-col items-center gap-2 mb-2 w-full">
        <label className="text-sm text-gray-400">Partidas</label>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {[10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000].map(n => (
            <button key={n} onClick={() => setNumGames(n)} disabled={simRun}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all disabled:opacity-40
                ${numGames === n ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}>
              {n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
        </div>

        {/* Stabilization config */}
        <div className="mt-2 w-full bg-gray-800 rounded-lg p-3 border border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={useStabilized} onChange={(e) => setUseStabilized(e.target.checked)} disabled={simRun}
              className="w-4 h-4 rounded cursor-pointer" />
            <span className="text-xs text-gray-400">Modo estabilizado</span>
          </label>
          {useStabilized && (
            <div className="flex gap-3 flex-wrap text-xs">
              <div>
                <label className="text-gray-500 block mb-1">Decimales de precisión</label>
                <select value={stabilizeDecimals} onChange={(e) => setStabilizeDecimals(Number(e.target.value))} disabled={simRun}
                  className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs">
                  {[0, 1, 2, 3].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {!simRun ? (
          <div className="flex gap-2 mt-1 flex-wrap justify-center">
            <button onClick={runSim} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-1.5 rounded-md text-sm font-semibold active:scale-95">Simular {numGames >= 1000 ? `${numGames / 1000}k` : numGames} partidas</button>
            <button onClick={runSimUntilStable} className="bg-violet-700 hover:bg-violet-600 text-white px-4 py-1.5 rounded-md text-sm font-semibold active:scale-95" title="Corre hasta que el winrate se estabilice">⚖️ Auto-estabilizar</button>
          </div>
        ) : <button onClick={() => { stopRef.current = true; }} className="bg-red-600 hover:bg-red-500 text-white px-5 py-1.5 rounded-md text-sm font-semibold mt-1">Parar ({prog}%)</button>}
      </div>
      <div className="text-xs text-gray-600 mb-3 text-center">Cada sim = 2 partidas simultáneas con rondas espejo · Chinchón = gana partida</div>
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
          <p className="text-xs text-gray-600 text-center mb-3">Gana ambas partidas con la misma repartida</p>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-lg font-bold" style={{ color: BOT[simB0].color }}>{sweepWins[0]}</div>
              <div className="text-xs text-gray-500">{(sweepWins[0] + sweepWins[1] + sweepWins[2]) > 0 ? ((sweepWins[0] / (sweepWins[0] + sweepWins[1] + sweepWins[2])) * 100).toFixed(4) : "0.0000"}%</div>
            </div>
            <div className="text-center px-3">
              <div className="text-xs text-gray-500">{sweepWins[2]} empates</div>
              <div className="text-xs text-gray-600">{sweepWins[0] + sweepWins[1] + sweepWins[2]} pares</div>
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
        const winData = winRateHistory.map(d => ({ x: d.games, y0: d.rate, y1: 100 - d.rate }));
        const sweepData = sweepRateHistory.map(d => ({ x: d.pairs, y0: d.rate0, y1: d.rate1 }));
        const activeData = chartTab === "winrate" ? winData : sweepData;
        const sliced = chartZoom ? activeData.slice(-chartZoom) : activeData;
        const ZOOM_OPTS: (number | null)[] = [null, 200, 100, 50, 20];
        return (
          <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4">
            {/* Header row: tabs left, zoom right */}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex gap-0.5 bg-gray-800 rounded-lg p-0.5">
                <button onClick={() => setChartTab("winrate")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartTab === "winrate" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                  Winrate
                </button>
                <button onClick={() => setChartTab("sweep")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartTab === "sweep" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                  Corridas espejo
                </button>
              </div>
              <div className="flex gap-0.5 items-center">
                <span className="text-xs text-gray-600 mr-1">Zoom:</span>
                {ZOOM_OPTS.map(z => (
                  <button key={z ?? "all"} onClick={() => setChartZoom(z)}
                    className={`px-1.5 py-0.5 rounded text-xs border transition-all ${chartZoom === z ? "border-gray-500 text-gray-200 bg-gray-700" : "border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-600"}`}>
                    {z === null ? "Todo" : z}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center mb-2">
              {chartTab === "winrate"
                ? "Partidas ganadas acumuladas · si la línea se estabiliza, la muestra es suficiente"
                : "% de corridas donde cada bot gana ambas partidas espejo (sin empates)"}
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
              <div className="text-xs text-gray-500">{(chinchonWins[0] / (gameWins[0] + gameWins[1]) * 100).toFixed(4)}% de partidas</div>
            </div>
            <div className="text-center px-3 text-xs text-gray-600">🏆 por bot</div>
            <div className="text-center flex-1">
              <div className="text-lg font-bold" style={{ color: BOT[simB1].color }}>{chinchonWins[1]}</div>
              <div className="text-xs text-gray-500">{(chinchonWins[1] / (gameWins[0] + gameWins[1]) * 100).toFixed(4)}% de partidas</div>
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
              { gameWins, roundWins, sweepWins, chinchonWins, totalRounds, numGames }
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
            { gameWins, roundWins, sweepWins, chinchonWins, totalRounds, numGames }
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
  )}

  {/* --- MATCH --- */}
  {tab === "match" && (
    <div className="flex flex-col items-center w-full max-w-lg">
      <div className="flex flex-col gap-3 mb-4 w-full">
        <BotPicker label="Bot 1" value={mvB0} onChange={(v) => { setMvB0(v); if (v === mvB1) setMvB1(BOT.findIndex((_, i) => i !== v)); setReplayPair(null); }} exclude={mvB1} />
        <div className="text-center text-gray-600 text-xs">vs</div>
        <BotPicker label="Bot 2" value={mvB1} onChange={(v) => { setMvB1(v); if (v === mvB0) setMvB0(BOT.findIndex((_, i) => i !== v)); setReplayPair(null); }} exclude={mvB0} />
      </div>
      <button onClick={newReplay} className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-1.5 rounded-md text-sm font-semibold active:scale-95 mb-3">Nueva repartida</button>
      {!replayPair && <div className="text-gray-600 text-sm mt-2">Dale a <span className="text-amber-400">Nueva repartida</span></div>}
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
            <button onClick={mFirst} disabled={si === 0} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white px-2 py-1 rounded text-xs font-medium">⏮</button>
            <button onClick={mPrev} disabled={si === 0} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white px-2 py-1 rounded text-xs font-medium">◀</button>
            <span className="text-xs text-gray-500 w-16 text-center">{si + 1} / {replay.length}</span>
            <button onClick={mNext} disabled={isLast} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white px-2 py-1 rounded text-xs font-medium">▶</button>
            <button onClick={mLast} disabled={isLast} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white px-2 py-1 rounded text-xs font-medium">⏭</button>
            <button onClick={togAuto} className={`px-2 py-1 rounded text-xs font-medium ${autoP ? "bg-red-700" : "bg-amber-700"} text-white`}>{autoP ? "⏸" : "▶ Auto"}</button>
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
  )}

  {/* --- PLAY --- */}
  {tab === "play" && (
    <div className="flex flex-col items-center w-full max-w-lg">
      {!g && (
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">Elegí tu rival:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {BOT.map((b, i) => (
              <button key={i} onClick={() => startGame(i)} className={`${b.bg} border ${b.border} rounded-lg px-4 py-3 transition-all hover:scale-105 active:scale-95 w-36`}>
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
          selectCard={selectCard} nextRound={nextRound} resetGame={resetGame} sortHand={sortHand} toggleCutMode={toggleCutMode} />
      )}
    </div>
  )}

  {/* --- TORNEO --- */}
  {tab === "torneo" && (() => {
    const TOUR_N = 4;
    const tourPairs = [];
    for (let i = 0; i < TOUR_N; i++) for (let j = i + 1; j < TOUR_N; j++) tourPairs.push([i, j]);

    const getBotWins = (ai) => {
      if (!tourResults) return { wins: 0, games: 0 };
      let totalW = 0, totalG = 0;
      for (let j = 0; j < TOUR_N; j++) {
        if (j === ai) continue;
        if (j > ai) { totalW += tourResults.wins[ai][j]; totalG += tourResults.games[ai][j]; }
        else { totalW += tourResults.games[j][ai] - tourResults.wins[j][ai]; totalG += tourResults.games[j][ai]; }
      }
      return { wins: totalW, games: totalG };
    };
    const getBotMirrorWins = (ai) => {
      if (!tourResults) return { wins: 0, pairs: 0 };
      let totalW = 0, totalP = 0;
      for (let j = 0; j < TOUR_N; j++) {
        if (j === ai) continue;
        totalW += tourResults.mirrorWins[ai][j];
        if (j > ai) totalP += tourResults.mirrorPairs[ai][j];
        else totalP += tourResults.mirrorPairs[j][ai];
      }
      return { wins: totalW, pairs: totalP };
    };
    const getBotChinchones = (ai) => {
      if (!tourResults) return { chinchones: 0, games: 0 };
      let totalC = 0, totalG = 0;
      for (let j = 0; j < TOUR_N; j++) {
        if (j === ai) continue;
        totalC += tourResults.chinchones[ai][j];
        totalG += tourResults.chinchonGames[ai][j];
      }
      return { chinchones: totalC, games: totalG };
    };

    const rankingWins = [0, 1, 2, 3].map(ai => {
      const { wins: w, games: g } = getBotWins(ai);
      return { idx: ai, winPct: g > 0 ? (w / g) * 100 : 0, games: g };
    }).sort((a, b) => b.winPct - a.winPct);
    const rankingMirror = [0, 1, 2, 3].map(ai => {
      const { wins: w, pairs: p } = getBotMirrorWins(ai);
      return { idx: ai, wins: w, pairs: p, winPct: p > 0 ? (w / p) * 100 : 0 };
    }).sort((a, b) => b.winPct - a.winPct);
    const rankingChinchon = [0, 1, 2, 3].map(ai => {
      const { chinchones: c, games: g } = getBotChinchones(ai);
      return { idx: ai, chinchones: c, games: g, rate: g > 0 ? (c / g) * 100 : 0 };
    }).sort((a, b) => b.chinchones - a.chinchones || b.rate - a.rate);

    const isDone = !tourRunning && tourProgress === 100 && tourResults !== null;
    const medals = ["🥇", "🥈", "🥉", "🗑️"];

    return (
      <div className="flex flex-col items-center w-full max-w-2xl">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Torneo todos contra todos</h2>
        <p className="text-xs text-gray-600 mb-4 text-center">6 enfrentamientos auto-estabilizados · Determina el mejor bot de los 4 elegidos</p>

        {/* Bot selection 2×2 */}
        <div className="grid grid-cols-2 gap-2 w-full mb-4">
          {[0, 1, 2, 3].map(slot => {
            const selBot = BOT[tourBots[slot]];
            return (
              <div key={slot} className="bg-gray-900 rounded-lg p-2.5 border border-gray-800">
                <div className="text-xs text-gray-500 mb-1.5">Bot {slot + 1}</div>
                <div className="flex flex-wrap gap-1">
                  {BOT.map((b, bi) => {
                    const taken = tourBots.some((tb, s) => s !== slot && tb === bi);
                    return (
                      <button key={bi} disabled={taken || tourRunning}
                        onClick={() => setTourBots(prev => { const next = [...prev]; next[slot] = bi; return next; })}
                        className={`px-2 py-1 rounded text-xs border transition-all disabled:cursor-not-allowed ${tourBots[slot] === bi ? "border-2 scale-105" : `border-gray-700 ${taken ? "opacity-20" : "hover:border-gray-500"}`}`}
                        style={tourBots[slot] === bi ? { borderColor: b.color, color: b.color, background: `${b.color}15` } : { color: taken ? "#333" : b.color }}>
                        {b.emoji} {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected bots summary */}
        <div className="flex gap-2 flex-wrap justify-center mb-4">
          {[0, 1, 2, 3].map(slot => {
            const b = BOT[tourBots[slot]];
            return (
              <div key={slot} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: b.color + "60", color: b.color }}>
                {b.emoji} {b.name}
              </div>
            );
          })}
        </div>

        {/* Stabilization config */}
        <div className="w-full bg-gray-800 rounded-lg p-3 border border-gray-700 mb-4">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={tourUseStabilized} onChange={(e) => setTourUseStabilized(e.target.checked)} disabled={tourRunning}
              className="w-4 h-4 rounded cursor-pointer" />
            <span className="text-xs text-gray-400">Modo estabilizado</span>
          </label>
          {tourUseStabilized && (
            <div className="flex gap-3 flex-wrap text-xs">
              <div>
                <label className="text-gray-500 block mb-1">Decimales de precisión</label>
                <select value={tourStabilizeDecimals} onChange={(e) => setTourStabilizeDecimals(Number(e.target.value))} disabled={tourRunning}
                  className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs">
                  {[0, 1, 2, 3].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Start/Stop */}
        {!tourRunning ? (
          <button onClick={runTournament}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg text-sm font-bold mb-3 active:scale-95 transition-all">
            🏆 Iniciar torneo {tourUseStabilized ? 'estabilizado' : ''}
          </button>
        ) : (
          <button onClick={() => { stopTourRef.current = true; }}
            className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-bold mb-3">
            Parar ({tourProgress}%)
          </button>
        )}

        {/* Progress bar */}
        {(tourRunning || (tourProgress > 0 && tourProgress < 100)) && (
          <div className="w-full h-1.5 bg-gray-800 rounded-full mb-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
              style={{ width: `${tourProgress}%` }} />
          </div>
        )}

        {/* Current matchup status */}
        {tourRunning && tourCurrentPair !== null && (
          <div className="text-xs text-gray-500 mb-3 text-center">
            Corriendo enfrentamiento {tourCurrentPair + 1} de {tourPairs.length}:{" "}
            <span style={{ color: BOT[tourBots[tourPairs[tourCurrentPair][0]]].color }}>
              {BOT[tourBots[tourPairs[tourCurrentPair][0]]].emoji} {BOT[tourBots[tourPairs[tourCurrentPair][0]]].name}
            </span>
            {" vs "}
            <span style={{ color: BOT[tourBots[tourPairs[tourCurrentPair][1]]].color }}>
              {BOT[tourBots[tourPairs[tourCurrentPair][1]]].emoji} {BOT[tourBots[tourPairs[tourCurrentPair][1]]].name}
            </span>
          </div>
        )}
        {tourRunning && tourCurrentStats && tourCurrentPair !== null && (
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
                  <span style={{ color: BOT[tourBots[tourPairs[tourCurrentPair][0]]].color }}>{tourCurrentStats.wins[0]}</span>
                  <span className="text-gray-500"> - </span>
                  <span style={{ color: BOT[tourBots[tourPairs[tourCurrentPair][1]]].color }}>{tourCurrentStats.wins[1]}</span>
                </div>
              </div>
              <div className="bg-gray-800/70 rounded p-2">
                <div className="text-gray-500">Victorias espejo</div>
                <div className="font-mono">
                  <span style={{ color: BOT[tourBots[tourPairs[tourCurrentPair][0]]].color }}>{tourCurrentStats.mirrorWins[0]}</span>
                  <span className="text-gray-500"> - </span>
                  <span style={{ color: BOT[tourBots[tourPairs[tourCurrentPair][1]]].color }}>{tourCurrentStats.mirrorWins[1]}</span>
                </div>
              </div>
              <div className="bg-gray-800/70 rounded p-2">
                <div className="text-gray-500">Chinchones</div>
                <div className="font-mono">
                  <span style={{ color: BOT[tourBots[tourPairs[tourCurrentPair][0]]].color }}>{tourCurrentStats.chinchones[0]}</span>
                  <span className="text-gray-500"> - </span>
                  <span style={{ color: BOT[tourBots[tourPairs[tourCurrentPair][1]]].color }}>{tourCurrentStats.chinchones[1]}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tourResults && (
          <>
            {/* Results matrix */}
            <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 overflow-x-auto">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">Matriz de resultados (% victorias fila vs columna)</h3>
              <table className="w-full text-xs min-w-[320px]">
                <thead>
                  <tr>
                    <th className="text-gray-600 text-left py-1 pr-3 font-normal w-24">Bot</th>
                    {[0, 1, 2, 3].map(j => {
                      const b = BOT[tourBots[j]];
                      return <th key={j} className="text-center px-2 py-1 font-medium" style={{ color: b.color }}>{b.emoji} {b.name}</th>;
                    })}
                    <th className="text-center px-2 py-1 text-gray-400 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3].map(ai => {
                    const b = BOT[tourBots[ai]];
                    const { wins: totalW, games: totalG } = getBotWins(ai);
                    const winPct = totalG > 0 ? (totalW / totalG) * 100 : null;
                    return (
                      <tr key={ai} className="border-t border-gray-800">
                        <td className="py-2 pr-3 font-medium" style={{ color: b.color }}>{b.emoji} {b.name}</td>
                        {[0, 1, 2, 3].map(j => {
                          if (j === ai) return <td key={j} className="text-center text-gray-700 py-2">—</td>;
                          let w, g;
                          if (j > ai) { w = tourResults.wins[ai][j]; g = tourResults.games[ai][j]; }
                          else { w = tourResults.games[j][ai] - tourResults.wins[j][ai]; g = tourResults.games[j][ai]; }
                          if (g === 0) return <td key={j} className="text-center text-gray-600 py-2">...</td>;
                          const pct = (w / g) * 100;
                          const col = pct >= 55 ? "#22c55e" : pct >= 47 ? "#9ca3af" : "#f87171";
                          return <td key={j} className="text-center py-2 font-mono" style={{ color: col }}>{pct.toFixed(1)}%</td>;
                        })}
                        <td className="text-center py-2 font-bold font-mono">
                          {winPct !== null
                            ? <span style={{ color: b.color }}>{winPct.toFixed(2)}%</span>
                            : <span className="text-gray-600">...</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 overflow-x-auto">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">Matriz espejo (% de pares donde la fila gana ambas)</h3>
              <table className="w-full text-xs min-w-[320px]">
                <thead>
                  <tr>
                    <th className="text-gray-600 text-left py-1 pr-3 font-normal w-24">Bot</th>
                    {[0, 1, 2, 3].map(j => {
                      const b = BOT[tourBots[j]];
                      return <th key={j} className="text-center px-2 py-1 font-medium" style={{ color: b.color }}>{b.emoji} {b.name}</th>;
                    })}
                    <th className="text-center px-2 py-1 text-gray-400 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3].map(ai => {
                    const b = BOT[tourBots[ai]];
                    const { wins: totalW, pairs: totalP } = getBotMirrorWins(ai);
                    const winPct = totalP > 0 ? (totalW / totalP) * 100 : null;
                    return (
                      <tr key={ai} className="border-t border-gray-800">
                        <td className="py-2 pr-3 font-medium" style={{ color: b.color }}>{b.emoji} {b.name}</td>
                        {[0, 1, 2, 3].map(j => {
                          if (j === ai) return <td key={j} className="text-center text-gray-700 py-2">—</td>;
                          const p = j > ai ? tourResults.mirrorPairs[ai][j] : tourResults.mirrorPairs[j][ai];
                          const w = tourResults.mirrorWins[ai][j];
                          if (p === 0) return <td key={j} className="text-center text-gray-600 py-2">...</td>;
                          const pct = (w / p) * 100;
                          return <td key={j} className="text-center py-2 font-mono text-violet-300">{pct.toFixed(1)}%</td>;
                        })}
                        <td className="text-center py-2 font-bold font-mono">
                          {winPct !== null ? <span style={{ color: b.color }}>{winPct.toFixed(2)}%</span> : <span className="text-gray-600">...</span>}
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
                <div className="text-center mb-5">
                  <div className="text-5xl mb-2">{BOT[tourBots[rankingWins[0].idx]].emoji}</div>
                  <div className="text-xl font-extrabold" style={{ color: BOT[tourBots[rankingWins[0].idx]].color }}>
                    {BOT[tourBots[rankingWins[0].idx]].name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    🏆 Mejor bot · {rankingWins[0].winPct.toFixed(2)}% de victorias globales
                  </div>
                </div>
              )}
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">
                {isDone ? "Clasificación final" : "Clasificación parcial"}
              </h3>
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
                      <span className="text-xs font-mono w-16 text-right shrink-0" style={{ color: bot.color }}>
                        {r.games > 0 ? `${r.winPct.toFixed(2)}%` : "..."}
                      </span>
                    </div>
                  );
                })}
              </div>
              <h4 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">2) Victorias espejo</h4>
              <div className="flex flex-col gap-2.5 mb-4">
                {rankingMirror.map((r, pos) => {
                  const bot = BOT[tourBots[r.idx]];
                  const barW = r.pairs > 0 ? Math.max(2, Math.min(100, r.winPct)) : 2;
                  return (
                    <div key={r.idx} className="flex items-center gap-2">
                      <span className="text-base w-7 text-center shrink-0">{medals[pos]}</span>
                      <span className="w-28 text-xs font-semibold shrink-0" style={{ color: bot.color }}>{bot.emoji} {bot.name}</span>
                      <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                        <div className="h-full rounded transition-all duration-300" style={{ width: `${barW}%`, background: bot.color + "99" }} />
                      </div>
                      <span className="text-xs font-mono w-24 text-right shrink-0" style={{ color: bot.color }}>
                        {r.pairs > 0 ? `${r.wins} (${r.winPct.toFixed(2)}%)` : "..."}
                      </span>
                    </div>
                  );
                })}
              </div>
              <h4 className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">3) Chinchones</h4>
              <div className="flex flex-col gap-2.5">
                {rankingChinchon.map((r, pos) => {
                  const bot = BOT[tourBots[r.idx]];
                  const barW = r.games > 0 ? Math.max(2, Math.min(100, r.rate * 2)) : 2;
                  return (
                    <div key={r.idx} className="flex items-center gap-2">
                      <span className="text-base w-7 text-center shrink-0">{medals[pos]}</span>
                      <span className="w-28 text-xs font-semibold shrink-0" style={{ color: bot.color }}>{bot.emoji} {bot.name}</span>
                      <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                        <div className="h-full rounded transition-all duration-300" style={{ width: `${barW}%`, background: bot.color + "99" }} />
                      </div>
                      <span className="text-xs font-mono w-28 text-right shrink-0" style={{ color: bot.color }}>
                        {r.games > 0 ? `${r.chinchones} (${r.rate.toFixed(2)}%)` : "..."}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!isDone && tourRunning && (
                <p className="text-xs text-gray-600 text-center mt-3">Resultados parciales — el torneo sigue corriendo</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  })()}

  {/* --- REGLAS --- */}
  {tab === "reglas" && (
    <div className="w-full max-w-lg">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm leading-relaxed">
        <h2 className="text-base font-bold text-gray-100 mb-4">Reglas oficiales — Chinchón (variante argentina)</h2>

        <div className="mb-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Mazo</h3>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li>Se juega con <span className="text-white font-medium">50 cartas</span> (incluye 2 comodines).</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Reparto inicial</h3>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li>Se reparten <span className="text-white font-medium">7 cartas por jugador</span>.</li>
            <li>El jugador que empieza recibe <span className="text-white font-medium">8 cartas</span> y arranca descartando 1.</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Turno</h3>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li>En cada turno, el jugador roba <span className="text-white font-medium">1 carta</span> del mazo o del descarte.</li>
            <li>Luego descarta <span className="text-white font-medium">1 carta</span>.</li>
            <li>El comodín <span className="text-red-400 font-medium">no puede descartarse nunca</span>.</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Juegos válidos</h3>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li><span className="text-white font-medium">Escalera</span>: 3 o más cartas consecutivas del mismo palo.</li>
            <li><span className="text-white font-medium">Grupo</span>: 3 o más cartas del mismo número.</li>
            <li>Todo juego válido debe tener al menos <span className="text-white font-medium">3 cartas</span>.</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Corte</h3>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li>Se puede cortar solo si hay como máximo <span className="text-white font-medium">1 carta sobrante</span>.</li>
            <li>El valor total del resto no debe superar <span className="text-white font-medium">5 puntos</span>.</li>
            <li>El comodín <span className="text-red-400 font-medium">no puede ser la carta que se tira</span> para cortar.</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Comodines</h3>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li>El comodín nunca se puede tirar (ni para descartar ni para cortar).</li>
            <li>Un comodín que no forma parte de ningún juego cerrado vale <span className="text-red-400 font-medium">50 puntos en contra</span>.</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Chinchón</h3>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li>El chinchón solo vale como chinchón si está hecho <span className="text-white font-medium">sin comodines</span>: 7 cartas consecutivas del mismo palo.</li>
            <li>Chinchón = <span className="text-emerald-400 font-medium">victoria instantánea de la partida</span>.</li>
            <li>Si las 7 cartas forman una corrida <span className="text-yellow-400">usando comodín</span>: vale <span className="text-white font-medium">−10 puntos</span>, no gana automáticamente.</li>
          </ul>
        </div>

        <div className="mb-2">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Puntaje y eliminación</h3>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li>La partida es a <span className="text-white font-medium">100 puntos</span>.</li>
            <li>Un jugador queda eliminado al llegar a <span className="text-red-400 font-medium">100 puntos o más</span>.</li>
          </ul>
        </div>
      </div>
    </div>
  )}

  {/* --- BOTS --- */}
  {tab === "custom" && (
    <div className="flex flex-col items-center w-full max-w-lg">
      {viewingBot ? (
        <BotViewer config={viewingBot} onClose={() => setViewingBot(null)} />
      ) : editingBot ? (
        <BotEditor config={editingBot} onCancel={() => setEditingBot(null)} onSave={(cfg) => {
          setCustomConfigs(prev => {
            const idx = prev.findIndex(c => c.id === cfg.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = cfg; return next; }
            return [...prev, cfg];
          });
          setEditingBot(null);
        }} />
      ) : (
        <div className="w-full">
          {/* Header with description/config toggle */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm">Todos los bots</p>
            <button onClick={() => setShowDescMode(m => m === "desc" ? "config" : "desc")}
              className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-2.5 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors">
              {showDescMode === "desc" ? "Ver resumen config" : "Ver descripción"}
            </button>
          </div>

          {/* Built-in bots */}
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Preconstruidos</p>
          <div className="flex flex-wrap gap-2 justify-center mb-5">
            {BUILTIN_BOT_CONFIGS.map(cfg => (
              <div key={cfg.id} className={`${cfg.bg} border ${cfg.border} rounded-lg px-4 py-3 w-44`}>
                <div className="font-bold text-sm mb-0.5" style={{ color: cfg.color }}>{cfg.emoji} {cfg.name}</div>
                <div className="text-gray-500 text-xs mb-2 leading-tight min-h-[2rem]">
                  {showDescMode === "desc"
                    ? (cfg.description || <span className="italic text-gray-600">{generateDesc(cfg)}</span>)
                    : generateDesc(cfg)}
                </div>
                <button onClick={() => setViewingBot(cfg)}
                  className="text-xs text-gray-400 hover:text-gray-200 bg-gray-900/60 px-2 py-0.5 rounded transition-colors">
                  Ver config
                </button>
              </div>
            ))}
          </div>

          {/* Custom bots */}
          <div className="border-t border-gray-800 pt-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600 uppercase tracking-wider">Mis bots</p>
              <div className="flex gap-1.5">
                <button onClick={() => { setShowImport(v => !v); setImportText(""); setImportError(null); }}
                  className="text-xs text-gray-400 hover:text-gray-200 bg-gray-800 px-2.5 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                  {showImport ? "Cancelar" : "Importar"}
                </button>
                {customConfigs.length < 4 && (
                  <button onClick={() => setEditingBot(DEFAULT_CUSTOM_CONFIG())}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-xs font-semibold active:scale-95 transition-all">
                    + Nuevo
                  </button>
                )}
              </div>
            </div>
            {showImport && (
              <div className="mb-3 bg-gray-900 border border-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2">Pegá el JSON de un bot exportado:</p>
                <textarea value={importText} onChange={e => { setImportText(e.target.value); setImportError(null); }}
                  rows={4} placeholder='{ "name": "...", "emoji": "🧪", ... }'
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 font-mono focus:border-gray-500 focus:outline-none resize-none" />
                {importError && <p className="text-xs text-red-400 mt-1">{importError}</p>}
                <button onClick={() => {
                  let raw;
                  try { raw = JSON.parse(importText); } catch { setImportError("JSON inválido"); return; }
                  const cfg = sanitizeImportConfig(raw);
                  if (!cfg) { setImportError("Configuración inválida o incompleta"); return; }
                  if (customConfigs.length >= 4) { setImportError("Ya tenés 4 bots custom (máximo)"); return; }
                  setCustomConfigs(prev => [...prev, cfg]);
                  setShowImport(false); setImportText("");
                }} className="mt-2 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-xs font-semibold transition-colors">
                  Importar bot
                </button>
              </div>
            )}
            {customConfigs.length === 0 && !showImport && (
              <div className="text-center text-gray-600 text-sm bg-gray-900 border border-gray-800 rounded-lg p-5">
                Ningún bot custom aún. ¡Creá uno!
              </div>
            )}
            {customConfigs.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {customConfigs.map((cfg) => {
                  const cc = CUSTOM_COLORS[cfg.colorIdx % CUSTOM_COLORS.length];
                  return (
                    <div key={cfg.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 w-44">
                      <div className="font-bold text-sm mb-0.5" style={{ color: cc.color }}>{cfg.emoji} {cfg.name}</div>
                      <div className="text-gray-500 text-xs mb-2 leading-tight min-h-[2rem]">
                        {showDescMode === "desc"
                          ? (cfg.description || <span className="italic text-gray-600">{generateDesc(cfg)}</span>)
                          : generateDesc(cfg)}
                      </div>
                      {benchmarks[cfg.id] && (
                        <div className="mb-1.5">
                          <div className="text-xs font-medium" style={{ color: benchmarks[cfg.id].wins / benchmarks[cfg.id].total >= 0.5 ? "#4ade80" : "#f87171" }}>
                            {Math.round(benchmarks[cfg.id].wins / benchmarks[cfg.id].total * 100)}% vs FacuTron
                          </div>
                          <div className="w-full h-1 bg-gray-800 rounded-full mt-0.5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.round(benchmarks[cfg.id].wins / benchmarks[cfg.id].total * 100)}%`, background: benchmarks[cfg.id].wins / benchmarks[cfg.id].total >= 0.5 ? "#4ade80" : "#f87171" }} />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setViewingBot(cfg)}
                          className="text-xs text-gray-400 hover:text-gray-200 bg-gray-800 px-2 py-0.5 rounded">Ver</button>
                        <button onClick={() => setEditingBot(JSON.parse(JSON.stringify(cfg)))}
                          className="text-xs text-gray-400 hover:text-gray-200 bg-gray-800 px-2 py-0.5 rounded">Editar</button>
                        <button onClick={() => {
                          const { id: _id, ...exportable } = cfg;
                          navigator.clipboard.writeText(JSON.stringify(exportable, null, 2));
                          setCopiedId(cfg.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }} className="text-xs text-sky-400 hover:text-sky-200 bg-gray-800 px-2 py-0.5 rounded">
                          {copiedId === cfg.id ? "✓ Copiado" : "Exportar"}
                        </button>
                        <button onClick={() => runBenchmark(cfg)} disabled={benchmarking === cfg.id}
                          className="text-xs text-amber-400 hover:text-amber-200 bg-gray-800 px-2 py-0.5 rounded disabled:opacity-50">
                          {benchmarking === cfg.id ? "..." : "⚡ Probar"}
                        </button>
                        <button onClick={() => setCustomConfigs(prev => prev.filter(c => c.id !== cfg.id))}
                          className="text-xs text-red-400 hover:text-red-300 bg-gray-800 px-2 py-0.5 rounded">Borrar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {customConfigs.length >= 4 && (
              <div className="text-xs text-gray-600 text-center mt-3">Máximo 4 bots custom</div>
            )}
          </div>
        </div>
      )}
    </div>
  )}
</div>

);
}
