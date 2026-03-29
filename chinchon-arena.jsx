import { useState, useRef, useCallback, useEffect } from “react”;
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from “recharts”;

/* ══════════════════════════════════════════════════════════════
CARD ENGINE
══════════════════════════════════════════════════════════════ */
const SUITS = [0, 1, 2, 3];
const SUIT_ICON = [“⚔️”, “🪵”, “🏆”, “🪙”];
const SUIT_COLOR = [”#60a5fa”, “#22c55e”, “#f87171”, “#fbbf24”];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const RANK_LABEL = { 0: “🃏”, 1: “1”, 2: “2”, 3: “3”, 4: “4”, 5: “5”, 6: “6”, 7: “7”, 8: “8”, 9: “9”, 10: “10”, 11: “11”, 12: “12” };
const RANK_ORDER = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11 };
const JOKER_REST = 25;
const isJoker = (c) => c.rank === 0;
const cardRest = (c) => isJoker(c) ? JOKER_REST : c.rank;
const sameCard = (a, b) => a && b && a.rank === b.rank && a.suit === b.suit;

function createDeck() {
const d = [];
for (const s of SUITS) for (const r of RANKS) d.push({ suit: s, rank: r });
d.push({ suit: -1, rank: 0 }, { suit: -1, rank: 0 });
return d;
}
function shuffle(a) {
const arr = […a];
for (let i = arr.length - 1; i > 0; i–) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[j], arr[i]];
}
return arr;
}

/* ══════════════════════════════════════════════════════════════
MELD FINDING
══════════════════════════════════════════════════════════════ */
function combos(arr, k) {
if (k === 0) return [[]];
if (arr.length < k) return [];
const res = [];
const go = (s, cur) => {
if (cur.length === k) { res.push([…cur]); return; }
for (let i = s; i <= arr.length - (k - cur.length); i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); }
};
go(0, []);
return res;
}

function findAllMelds(hand) {
const melds = [], jIds = [];
hand.forEach((c, i) => { if (isJoker(c)) jIds.push(i); });
const nJ = jIds.length;
const byRank = {};
hand.forEach((c, i) => { if (!isJoker(c)) (byRank[c.rank] ??= []).push(i); });
for (const indices of Object.values(byRank)) {
for (let sz = Math.min(indices.length, 4); sz >= 2; sz–)
for (const sub of combos(indices, sz))
for (let j = 0; j <= nJ; j++) { if (sz + j < 3 || sz + j > 4) continue; for (const jc of combos(jIds, j)) melds.push([…sub, …jc]); }
if (nJ >= 2) for (const idx of indices) for (const jc of combos(jIds, 2)) melds.push([idx, …jc]);
}
const bySuit = {};
hand.forEach((c, i) => { if (!isJoker(c)) (bySuit[c.suit] ??= []).push(i); });
for (const indices of Object.values(bySuit)) {
const om = {};
for (const i of indices) om[RANK_ORDER[hand[i].rank]] = i;
for (let s = 0; s <= 11; s++) for (let e = s + 2; e <= 11; e++) {
if (e - s + 1 > 7) break;
const present = []; let gaps = 0;
for (let p = s; p <= e; p++) { if (om[p] !== undefined) present.push(om[p]); else gaps++; }
if (present.length < 2 || gaps > nJ) continue;
if (gaps === 0) melds.push([…present]);
else for (const jc of combos(jIds, gaps)) melds.push([…present, …jc]);
}
}
if (nJ >= 2) for (const indices of Object.values(bySuit)) {
const om = {};
for (const i of indices) om[RANK_ORDER[hand[i].rank]] = i;
for (const [ps, idx] of Object.entries(om)) {
const pos = +ps;
for (let s = pos - 2; s <= pos; s++) {
const e2 = s + 2; if (s < 0 || e2 > 11) continue;
let rc = 0; for (let p = s; p <= e2; p++) if (om[p] !== undefined) rc++;
if (rc === 1) for (const jc of combos(jIds, 2)) melds.push([idx, …jc]);
}
}
}
return melds;
}

function findBestMelds(hand) {
const all = findAllMelds(hand);
const totalR = hand.reduce((s, c) => s + cardRest(c), 0);
let bestR = totalR, bestSet = [], minFree = hand.length, minFreeSet = [], minFreeR = totalR;
const bt = (idx, used, cur) => {
const free = hand.filter((_, i) => !used.has(i));
const r = free.reduce((s, c) => s + cardRest(c), 0);
const cnt = free.length;
if (r < bestR) { bestR = r; bestSet = […cur]; }
if (cnt < minFree || (cnt === minFree && r < minFreeR)) { minFree = cnt; minFreeSet = […cur]; minFreeR = r; }
for (let i = idx; i < all.length; i++) {
const m = all[i];
if (m.some(x => used.has(x))) continue;
m.forEach(x => used.add(x)); cur.push(m);
bt(i + 1, used, cur);
cur.pop(); m.forEach(x => used.delete(x));
}
};
bt(0, new Set(), []);
return { melds: bestSet, resto: bestR, minFree, meldsCut: minFreeSet };
}

/* ── Chinchón detection: 7 cards, one run of 7 consecutive same suit (jokers fill gaps) ── */
function checkChinchon(hand) {
if (hand.length !== 7) return false;
const jokers = hand.filter(isJoker).length;
const normals = hand.filter(c => !isJoker(c));
// All normals must be same suit
if (normals.length > 0) {
const suit = normals[0].suit;
if (!normals.every(c => c.suit === suit)) return false;
}
// Check if they form 7 consecutive with jokers filling gaps
const orders = normals.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
// Try all possible spans of 7 consecutive positions
for (let start = 0; start <= 5; start++) {
const end = start + 6;
let gaps = 0;
let allPresent = true;
for (let p = start; p <= end; p++) {
if (!orders.includes(p)) gaps++;
}
if (gaps <= jokers) return true;
}
return false;
}

/* ── Check if hand has 4+ consecutive same suit (for MartinMatic) ── */
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

/* ══════════════════════════════════════════════════════════════
BOTS
══════════════════════════════════════════════════════════════ */
function defaultDiscard(hand8) {
const a = findBestMelds(hand8); const inM = new Set(a.meldsCut.flat());
let wi = -1, ws = -1;
hand8.forEach((c, i) => { if (!inM.has(i) && cardRest(c) > ws) { ws = cardRest(c); wi = i; } });
return wi === -1 ? hand8.length - 1 : wi;
}
function taiDiscard(hand8) {
const a = findBestMelds(hand8); const inM = new Set(a.melds.flat());
let wi = -1, ws = -1;
hand8.forEach((c, i) => { if (!inM.has(i) && c.rank > ws) { ws = c.rank; wi = i; } });
if (wi === -1) { let hi = -1, hr = -1; hand8.forEach((c, i) => { if (c.rank > hr) { hr = c.rank; hi = i; } }); return hi; }
return wi;
}

/* ── Angry DaiBot: optimal discard — tries all 8 possible discards, picks the one
that leaves the best 7-card hand (lowest resto, then fewest free cards) ── */
function angryDiscard(hand8) {
let bestIdx = 0, bestResto = 9999, bestFree = 99;
for (let i = 0; i < hand8.length; i++) {
const test = hand8.filter((_, j) => j !== i);
const m = findBestMelds(test);
if (m.minFree < bestFree || (m.minFree === bestFree && m.resto < bestResto)) {
bestIdx = i; bestResto = m.resto; bestFree = m.minFree;
}
}
return bestIdx;
}

/* ── Angry DaiBot: check if close to chinchón (5+ same suit consecutive, counting jokers) ── */
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

const BOT = [
{ id: “facutron”, name: “FacuTron”, emoji: “🤖”, color: “#34d399”, text: “text-emerald-400”, bg: “bg-emerald-950”, border: “border-emerald-800”,
desc: “Agresivo — corta con resto ≤ 5”,
canCut: (m7) => m7.minFree <= 1 && m7.resto <= 5, pickDiscard: defaultDiscard },
{ id: “daibot”, name: “DaiBot”, emoji: “🎀”, color: “#f472b6”, text: “text-pink-400”, bg: “bg-pink-950”, border: “border-pink-800”,
desc: “Solo corta sin resto (-10 o chinchón)”,
canCut: (m7) => m7.minFree === 0, pickDiscard: defaultDiscard },
{ id: “candelaria”, name: “Candelar-IA”, emoji: “🔮”, color: “#38bdf8”, text: “text-sky-400”, bg: “bg-sky-950”, border: “border-sky-800”,
desc: “< 50pts → sin resto · ≥ 50pts → corta con resto ≤ 3”,
canCut: (m7, score) => score < 50 ? m7.minFree === 0 : (m7.minFree <= 1 && m7.resto <= 3), pickDiscard: defaultDiscard },
{ id: “tai”, name: “T.A.I”, emoji: “🔴”, color: “#f87171”, text: “text-red-400”, bg: “bg-red-950”, border: “border-red-800”,
desc: “Descarta altas primero · Corta con resto ≤ 3”,
canCut: (m7) => m7.minFree <= 1 && m7.resto <= 3, pickDiscard: taiDiscard },
{ id: “martinmatic”, name: “MartinMatic”, emoji: “⚙️”, color: “#9ca3af”, text: “text-gray-400”, bg: “bg-gray-900”, border: “border-gray-700”,
desc: “Agresivo, pero con 4+ del mismo palo consecutivas va por chinchón”,
canCut: (m7, _s, hand) => has4RunSameSuit(hand) ? m7.minFree === 0 : (m7.minFree <= 1 && m7.resto <= 5), pickDiscard: defaultDiscard },
{ id: “angrydai”, name: “Angry DaiBot”, emoji: “😈”, color: “#a78bfa”, text: “text-violet-400”, bg: “bg-violet-950”, border: “border-violet-800”,
desc: “Descarte óptimo · Corte dinámico · Va por chinchón si está cerca”,
canCut: (m7, score, hand) => {
// If near chinchón, hold out for it
if (nearChinchon(hand)) return m7.minFree === 0;
// Score-aware dynamic thresholds
if (score >= 75) return m7.minFree <= 1 && m7.resto <= 1; // desperate: only cut almost clean
if (score >= 50) return m7.minFree <= 1 && m7.resto <= 3; // cautious
if (score >= 25) return m7.minFree <= 1 && m7.resto <= 2; // patient
return m7.minFree <= 1 && m7.resto <= 2; // early game: patient, wait for good cuts
},
pickDiscard: angryDiscard },
];

/* ══════════════════════════════════════════════════════════════
GAME ENGINE
══════════════════════════════════════════════════════════════ */
const deepH = (h) => h.map(c => ({ …c }));
const deepD = (d) => d.map(c => ({ …c }));

// Scoring: chinchón = instant game win. minFree===0 = -10. else = resto.
function cutScore(hand) {
if (checkChinchon(hand)) return { score: 0, chinchon: true };
const m = findBestMelds(hand);
if (m.minFree === 0) return { score: -10, chinchon: false };
return { score: m.resto, chinchon: false };
}

function playRoundScored(h0, h1, deckIn, strat0, strat1, scores) {
const h = [h0, h1], deck = deckIn, st = [strat0, strat1], dr = [0, 0];
for (let p = 0; p < 2; p++) {
const m7 = findBestMelds(h[p]);
if (st[p].canCut(m7, scores[p], h[p])) {
const cs = cutScore(h[p]); const other = findBestMelds(h[1 - p]);
return { winner: p, cards: 0, addScores: p === 0 ? [cs.score, other.resto] : [other.resto, cs.score], chinchon: cs.chinchon };
}
}
for (let t = 0; t < 80; t++) {
const p = t % 2; if (!deck.length) break;
const card = deck.pop(); h[p].push(card);
const wi = st[p].pickDiscard(h[p]);
const disc = h[p][wi]; const kept = !sameCard(disc, card); h[p].splice(wi, 1);
if (kept) dr[p]++;
const m7 = findBestMelds(h[p]);
if (st[p].canCut(m7, scores[p], h[p])) {
const cs = cutScore(h[p]); const other = findBestMelds(h[1 - p]);
return { winner: p, cards: dr[p], addScores: p === 0 ? [cs.score, other.resto] : [other.resto, cs.score], chinchon: cs.chinchon };
}
}
const m0 = findBestMelds(h[0]), m1 = findBestMelds(h[1]);
const w = m0.minFree <= m1.minFree ? 0 : 1;
return { winner: w, cards: dr[w], addScores: [m0.resto, m1.resto], chinchon: false };
}

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

```
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
```

}
return [
{ gameLoser: scA[0] >= 100 ? 0 : 1, scores: scA, roundStats: statsA },
{ gameLoser: scB[0] >= 100 ? 0 : 1, scores: scB, roundStats: statsB },
];
}

/* ── Replay ── */
function playReplay(h0, h1, deckIn, strat0, strat1, scores) {
const h = [h0, h1], deck = deckIn, st = [strat0, strat1], dr = [0, 0], steps = [];
const sn = () => [h[0].map(c => ({ …c })), h[1].map(c => ({ …c }))];
const ms = () => [findBestMelds(h[0]), findBestMelds(h[1])];
steps.push({ type: “deal”, hands: sn(), melds: ms(), drawn: [0, 0] });
for (let p = 0; p < 2; p++) { const m7 = findBestMelds(h[p]); if (st[p].canCut(m7, scores[p], h[p])) {
const cs = cutScore(h[p]);
steps.push({ type: “cut”, player: p, card: null, kept: false, discarded: null, hands: sn(), melds: ms(), freeCards: m7.minFree, drawn: […dr], chinchon: cs.chinchon, score: cs.score }); return steps; } }
for (let t = 0; t < 80; t++) {
const p = t % 2; if (!deck.length) break;
const card = deck.pop(); h[p].push(card);
const wi = st[p].pickDiscard(h[p]);
const disc = h[p][wi]; const kept = !sameCard(disc, card); h[p].splice(wi, 1);
if (kept) dr[p]++;
const m7 = findBestMelds(h[p]);
if (st[p].canCut(m7, scores[p], h[p])) {
const cs = cutScore(h[p]);
steps.push({ type: “cut”, player: p, card: { …card }, kept, discarded: { …disc }, hands: sn(), melds: ms(), freeCards: m7.minFree, resto: m7.resto, drawn: […dr], chinchon: cs.chinchon, score: cs.score }); return steps; }
steps.push({ type: “turn”, player: p, card: { …card }, kept, discarded: { …disc }, hands: sn(), melds: ms(), freeCards: m7.minFree, resto: m7.resto, drawn: […dr] });
}
const d0 = findBestMelds(h[0]), d1 = findBestMelds(h[1]);
steps.push({ type: “timeout”, winner: d0.minFree <= d1.minFree ? 0 : 1, hands: sn(), melds: ms(), restos: [d0.resto, d1.resto], frees: [d0.minFree, d1.minFree], drawn: […dr] });
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

/* ── Play mode helpers ── */
function initRound(scores, dealer) {
const deck = shuffle(createDeck());
const pHand = deck.splice(0, 7), bHand = deck.splice(0, 7), firstCard = deck.pop();
return { phase: “playerDraw”, deck, discardPile: [firstCard], pHand, bHand, scores: […scores], dealer, turn: dealer === 0 ? 1 : 0, selectedIdx: null, roundResult: null, message: null, drawnCard: null };
}
function botTakeTurn(g, botObj) {
const hand = […g.bHand.map(c => ({ …c }))], deck = […g.deck], dp = […g.discardPile];
const top = dp.length ? dp[dp.length - 1] : null;
let drawDisc = false;
if (top && deck.length) { const t2 = […hand, { …top }]; const b7 = findBestMelds(hand); const a8 = findBestMelds(t2); if (a8.minFree < b7.minFree || a8.resto < b7.resto - 3) drawDisc = true; }
let drawn;
if (drawDisc && dp.length) drawn = dp.pop(); else if (deck.length) drawn = deck.pop();
else return { …g, phase: “roundEnd”, roundResult: { reason: “empty” } };
hand.push(drawn);
const wi = botObj.pickDiscard(hand); const disc = hand.splice(wi, 1)[0]; dp.push(disc);
const m7 = findBestMelds(hand);
if (botObj.canCut(m7, g.scores[1], hand)) {
const cs = cutScore(hand); const pM = findBestMelds(g.pHand);
return { …g, bHand: hand, deck, discardPile: dp, phase: “roundEnd”, drawnCard: drawn, botDiscard: disc,
roundResult: { cutter: “bot”, bScore: cs.score, pScore: pM.resto, bMelds: m7, pMelds: pM, chinchon: cs.chinchon } };
}
return { …g, bHand: hand, deck, discardPile: dp, phase: “playerDraw”, turn: 0, drawnCard: drawn, botDiscard: disc, message: null };
}

/* ══════════════════════════════════════════════════════════════
UI COMPONENTS
══════════════════════════════════════════════════════════════ */
function CardC({ card, inMeld, highlight, small, onClick, selected, faceDown }) {
const sz = small ? “w-8 h-12 text-xs” : “w-11 h-16 text-sm”;
if (faceDown) return (
<div className={`${sz} bg-indigo-900 border border-indigo-700 rounded flex items-center justify-center shrink-0`}><span className="text-indigo-500 text-lg">?</span></div>
);
const j = isJoker(card);
const bg = selected ? “bg-blue-800 border-blue-400 ring-2 ring-blue-400”
: highlight === “drawn” ? “bg-yellow-900/80 border-yellow-500 ring-1 ring-yellow-500/40”
: highlight === “discarded” ? “bg-red-900/60 border-red-500 opacity-50”
: j ? (inMeld ? “bg-purple-900 border-purple-400” : “bg-purple-950 border-purple-700”)
: inMeld ? “bg-gray-800 border-gray-500” : “bg-gray-900 border-gray-700”;
const color = j ? “#e879f9” : SUIT_COLOR[card.suit];
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
{!faceDown && <span className="text-xs text-gray-500">Sueltas: {meldsData?.minFree ?? “?”} · Resto: {meldsData?.resto ?? “?”}</span>}
</div>
<div className="flex flex-wrap gap-1">
{hand.map((c, i) => {
const isDraw = drawnCard && sameCard(c, drawnCard);
return (
<CardC key={`${c.rank}-${c.suit}-${i}`} card={c} inMeld={!faceDown && meldIdx.has(i)}
highlight={isDraw ? “drawn” : null} onClick={onClick ? () => onClick(i) : null} selected={selectedIdx === i} faceDown={faceDown} />
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
className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${value === i ? "border-2 scale-105" : `border-gray-700 ${dis ? “opacity-20” : “hover:border-gray-500”}`}`}
style={value === i ? { borderColor: b.color, color: b.color, background: `${b.color}15` } : { color: dis ? “#333” : b.color }}>
{b.emoji} {b.name}
</button>
);
})}
</div>
</div>
);
}

function buildChartData(f, d, n0, n1) {
const keys = new Set([…Object.keys(f), …Object.keys(d)].map(Number));
return […keys].sort((a, b) => a - b).map(k => ({ cartas: k, [n0]: f[k] || 0, [n1]: d[k] || 0 }));
}
function ChartTip({ active, payload, label }) {
if (!active || !payload?.length) return null;
return (
<div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm shadow-lg">
<p className="text-gray-300 mb-1 font-medium">{label} carta{label !== 1 ? “s” : “”}</p>
{payload.map(e => <p key={e.dataKey} style={{ color: e.fill }}>{e.dataKey}: {e.value}</p>)}
</div>
);
}

/* ── Sort helpers for play mode ── */
function sortBySuit(hand) {
return […hand].sort((a, b) => {
if (isJoker(a) && isJoker(b)) return 0;
if (isJoker(a)) return 1; if (isJoker(b)) return -1;
if (a.suit !== b.suit) return a.suit - b.suit;
return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
});
}
function sortByRank(hand) {
return […hand].sort((a, b) => {
if (isJoker(a) && isJoker(b)) return 0;
if (isJoker(a)) return 1; if (isJoker(b)) return -1;
if (a.rank !== b.rank) return a.rank - b.rank;
return a.suit - b.suit;
});
}

/* ── Play sub-component ── */
function PlayGame({ g, bot, history, showBot, bML, pML, topD, canPlayerCut, setShowBot, playerDraw, playerDiscard, playerCut, selectCard, nextRound, resetGame, sortHand }) {
const [spyModal, setSpyModal] = useState(false);

const handleSpy = () => {
if (showBot) { setShowBot(false); return; }
setSpyModal(true);
};

return (
<div className="w-full">
{/* Spy modal */}
{spyModal && (
<div className=“fixed inset-0 z-50 flex items-center justify-center bg-black/70” onClick={() => setSpyModal(false)}>
<div className=“bg-gray-900 border border-gray-700 rounded-xl p-6 mx-4 max-w-xs text-center shadow-2xl” onClick={(e) => e.stopPropagation()}>
<div className="text-3xl mb-3">🤨</div>
<div className="text-lg font-bold text-gray-100 mb-1">Epaaaa, ¿qué hacemos?</div>
<div className="text-sm text-gray-400 mb-5">Querés espiar las cartas de {bot.name}…</div>
<div className="flex flex-col gap-2">
<button onClick={() => { setSpyModal(false); setShowBot(true); }}
className=“bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors”>
🔧 Es para debuggear
</button>
<button onClick={() => setSpyModal(false)}
className=“bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors”>
😅 Bueno perdón
</button>
</div>
</div>
</div>
)}

```
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
      {g.phase === "playerDiscard" && <div className="text-center text-sm text-sky-400 mb-2">{g.selectedIdx !== null ? "Descartá o cortá" : "Tocá una carta para descartar"}</div>}
      {g.phase === "botTurn" && <div className="text-center text-sm text-gray-500 mb-2">{bot.name} está jugando...</div>}
      {g.message && <div className="text-center text-xs text-red-400 mb-2">{g.message}</div>}

      <HandRow hand={g.pHand} meldsData={pML} label="Tu mano" color="text-sky-400" bgClass="bg-sky-950" borderClass="border-sky-800"
        onClick={g.phase === "playerDiscard" ? selectCard : null} selectedIdx={g.selectedIdx} />

      {/* Sort + action buttons */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          <button onClick={() => sortHand("suit")} className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-2 py-1 rounded">Por palo</button>
          <button onClick={() => sortHand("rank")} className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-2 py-1 rounded">Por número</button>
        </div>
        {g.phase === "playerDiscard" && g.selectedIdx !== null && (
          <div className="flex gap-2">
            <button onClick={playerDiscard} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm font-medium">Descartar</button>
            {canPlayerCut && <button onClick={playerCut} className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded-md text-sm font-bold animate-pulse">¡Cortar!</button>}
          </div>
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
```

);
}

/* ══════════════════════════════════════════════════════════════
MAIN
══════════════════════════════════════════════════════════════ */
export default function ChinchonArena() {
const [tab, setTab] = useState(“sim”);

// Sim
const [simB0, setSimB0] = useState(0);
const [simB1, setSimB1] = useState(1);
const [numGames, setNumGames] = useState(50);
const [chartData, setChartData] = useState(null);
const [roundWins, setRoundWins] = useState([0, 0]);
const [gameWins, setGameWins] = useState([0, 0]);
const [sweepWins, setSweepWins] = useState([0, 0, 0]); // [bot0 sweeps, bot1 sweeps, splits]
const [totalRounds, setTotalRounds] = useState(0);
const [simRun, setSimRun] = useState(false);
const [prog, setProg] = useState(0);
const stopRef = useRef(false);

// Match viewer
const [mvB0, setMvB0] = useState(0);
const [mvB1, setMvB1] = useState(1);
const [replayPair, setReplayPair] = useState(null);
const [matchRound, setMatchRound] = useState(“A”);
const [si, setSi] = useState(0);
const [autoP, setAutoP] = useState(false);
const autoRef = useRef(false);

// Play
const [botChoice, setBotChoice] = useState(null);
const [g, setG] = useState(null);
const [history, setHistory] = useState([]);
const [showBot, setShowBot] = useState(false);

// ── Sim ──
const runSim = useCallback(() => {
stopRef.current = false; setSimRun(true); setProg(0); setChartData(null);
setRoundWins([0, 0]); setGameWins([0, 0]); setSweepWins([0, 0, 0]); setTotalRounds(0);
const fd = {}, dd = {}; let rw0 = 0, rw1 = 0, gw0 = 0, gw1 = 0, sw0 = 0, sw1 = 0, splits = 0, tr = 0, done = 0;
const n0 = BOT[simB0].name, n1 = BOT[simB1].name;
const tick = () => {
if (stopRef.current) { setSimRun(false); return; }
const batch = numGames <= 100 ? 1 : numGames <= 1000 ? 5 : numGames <= 10000 ? 50 : 200;
const end = Math.min(done + batch, numGames);
for (let i = done; i < end; i++) {
const [gA, gB] = simulateGamePair(simB0, simB1);
// Track game wins
const winnerA = gA.gameLoser === 0 ? 1 : 0;
const winnerB = gB.gameLoser === 0 ? 1 : 0;
if (winnerA === 0) gw0++; else gw1++;
if (winnerB === 0) gw0++; else gw1++;
// Track sweeps (same bot wins both mirror games)
if (winnerA === 0 && winnerB === 0) sw0++;
else if (winnerA === 1 && winnerB === 1) sw1++;
else splits++;
// Track rounds
for (const game of [gA, gB]) {
for (const rs of game.roundStats) {
tr++;
if (rs.winner === 0) { rw0++; fd[rs.cards] = (fd[rs.cards] || 0) + 1; }
else { rw1++; dd[rs.cards] = (dd[rs.cards] || 0) + 1; }
}
}
}
done = end; setProg(Math.round(done / numGames * 100));
setChartData(buildChartData(fd, dd, n0, n1));
setRoundWins([rw0, rw1]); setGameWins([gw0, gw1]); setSweepWins([sw0, sw1, splits]); setTotalRounds(tr);
if (done < numGames) setTimeout(tick, 0); else setSimRun(false);
};
setTimeout(tick, 0);
}, [numGames, simB0, simB1]);

// ── Match viewer ──
const replay = replayPair ? (matchRound === “A” ? replayPair.replayA : replayPair.replayB) : null;
const matchSwapped = matchRound === “B”;
const newReplay = () => { autoRef.current = false; setAutoP(false); setReplayPair(generateReplayPair(mvB0, mvB1)); setMatchRound(“A”); setSi(0); };
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

// ── Play ──
const startGame = (bi) => { setBotChoice(bi); const gs = initRound([0, 0], 0); if (gs.turn === 1) gs.phase = “botTurn”; setG(gs); setHistory([]); setShowBot(false); };
const playerDraw = (src) => {
if (!g || g.phase !== “playerDraw” || g.turn !== 0) return;
const ng = { …g, pHand: […g.pHand], deck: […g.deck], discardPile: […g.discardPile] };
let card;
if (src === “discard” && ng.discardPile.length) card = ng.discardPile.pop(); else if (ng.deck.length) card = ng.deck.pop(); else return;
ng.pHand.push(card); ng.drawnCard = card; ng.phase = “playerDiscard”; ng.selectedIdx = null; ng.message = null; setG(ng);
};
const selectCard = (i) => { if (!g || g.phase !== “playerDiscard”) return; setG({ …g, selectedIdx: g.selectedIdx === i ? null : i }); };
const playerDiscard = () => {
if (!g || g.phase !== “playerDiscard” || g.selectedIdx === null) return;
const ng = { …g, pHand: […g.pHand], discardPile: […g.discardPile] };
const disc = ng.pHand.splice(ng.selectedIdx, 1)[0]; ng.discardPile.push(disc);
ng.selectedIdx = null; ng.drawnCard = null; ng.phase = “botTurn”; ng.turn = 1; ng.message = null; setG(ng);
};
const playerCut = () => {
if (!g || g.phase !== “playerDiscard” || g.selectedIdx === null) return;
const testHand = g.pHand.filter((_, i) => i !== g.selectedIdx);
const f7 = findBestMelds(testHand);
if (f7.minFree > 1) { setG({ …g, message: “No podés cortar — más de 1 carta suelta” }); return; }
const ng = { …g, pHand: […g.pHand], discardPile: […g.discardPile] };
const disc = ng.pHand.splice(ng.selectedIdx, 1)[0]; ng.discardPile.push(disc);
const cs = cutScore(ng.pHand); const bM = findBestMelds(ng.bHand);
ng.phase = “roundEnd”; ng.drawnCard = null; ng.selectedIdx = null;
ng.roundResult = { cutter: “player”, pScore: cs.score, bScore: bM.resto, chinchon: cs.chinchon };
setG(ng);
};
const sortHand = (mode) => {
if (!g) return;
const sorted = mode === “suit” ? sortBySuit(g.pHand) : sortByRank(g.pHand);
setG({ …g, pHand: sorted, selectedIdx: null });
};
useEffect(() => {
if (!g || g.phase !== “botTurn” || botChoice === null) return;
const t = setTimeout(() => setG(botTakeTurn(g, BOT[botChoice])), 800);
return () => clearTimeout(t);
}, [g?.phase, botChoice]);
const nextRound = () => {
if (!g || !g.roundResult) return;
const r = g.roundResult;
if (r.chinchon) {
// Chinchón = instant game win
const winner = r.cutter === “player” ? 0 : 1;
const ns = […g.scores]; ns[1 - winner] = 999;
setHistory(h => […h, { pScore: r.pScore, bScore: r.bScore, cutter: r.cutter, chinchon: true }]);
setG({ …g, phase: “gameOver”, scores: ns }); return;
}
const ns = [g.scores[0] + r.pScore, g.scores[1] + r.bScore];
setHistory(h => […h, { pScore: r.pScore, bScore: r.bScore, cutter: r.cutter, chinchon: false }]);
if (ns[0] >= 100 || ns[1] >= 100) { setG({ …g, phase: “gameOver”, scores: ns }); return; }
const ng = initRound(ns, g.dealer === 0 ? 1 : 0); if (ng.turn === 1) ng.phase = “botTurn”; setG(ng);
};
const resetGame = () => { setG(null); setBotChoice(null); setHistory([]); };

// Derived
const step = replay?.[si];
const isLast = replay && si >= replay.length - 1;
const total = gameWins[0] + gameWins[1];
const totalR = totalRounds;
let canPlayerCut = false;
if (g?.phase === “playerDiscard” && g.selectedIdx !== null) {
const test = g.pHand.filter((_, i) => i !== g.selectedIdx);
canPlayerCut = findBestMelds(test).minFree <= 1;
}
const pML = g?.pHand ? findBestMelds(g.pHand) : null;
const bML = g?.bHand ? findBestMelds(g.bHand) : null;
const topD = g?.discardPile?.length ? g.discardPile[g.discardPile.length - 1] : null;
const mvBots = [BOT[mvB0], BOT[mvB1]];
const bn = (slot) => matchSwapped ? mvBots[slot === 0 ? 1 : 0] : mvBots[slot];

return (
<div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center px-3 py-5 font-sans">
<h1 className="text-xl font-extrabold tracking-tight mb-0.5">Arena de Chinchón</h1>
<p className="text-gray-600 text-xs mb-3">Baraja española + 2 comodines · 6 bots</p>

```
  <div className="flex gap-0.5 bg-gray-900 rounded-lg p-1 mb-4">
    {[["sim", "Simulación"], ["match", "Ver Partida"], ["play", "Jugar"]].map(([k, l]) => (
      <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === k ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>{l}</button>
    ))}
  </div>

  {/* ─── SIM ─── */}
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
        {!simRun ? <button onClick={runSim} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-1.5 rounded-md text-sm font-semibold active:scale-95 mt-1">Simular {numGames >= 1000 ? `${numGames / 1000}k` : numGames} partidas</button>
          : <button onClick={() => { stopRef.current = true; }} className="bg-red-600 hover:bg-red-500 text-white px-5 py-1.5 rounded-md text-sm font-semibold mt-1">Parar ({prog}%)</button>}
      </div>
      <div className="text-xs text-gray-600 mb-3 text-center">Cada sim = 2 partidas simultáneas con rondas espejo · Chinchón = gana partida</div>
      {simRun && <div className="w-full h-1 bg-gray-800 rounded-full mb-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 transition-all" style={{ width: `${prog}%` }} /></div>}

      {total > 0 && (
        <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <h2 className="text-xs text-gray-500 text-center mb-3 uppercase tracking-wider">Partidas ganadas</h2>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1"><div className="text-3xl font-bold" style={{ color: BOT[simB0].color }}>{gameWins[0]}</div><div className="text-xs text-gray-500">{((gameWins[0] / total) * 100).toFixed(1)}%</div><div className="text-xs mt-0.5" style={{ color: BOT[simB0].color }}>{BOT[simB0].name}</div></div>
            <div className="text-center px-3"><div className="text-xs text-gray-600">{total} partidas</div><div className="text-gray-700 text-xl">—</div></div>
            <div className="text-center flex-1"><div className="text-3xl font-bold" style={{ color: BOT[simB1].color }}>{gameWins[1]}</div><div className="text-xs text-gray-500">{((gameWins[1] / total) * 100).toFixed(1)}%</div><div className="text-xs mt-0.5" style={{ color: BOT[simB1].color }}>{BOT[simB1].name}</div></div>
          </div>
        </div>
      )}

      {totalR > 0 && (
        <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
          <h2 className="text-xs text-gray-500 text-center mb-2 uppercase tracking-wider">Rondas ganadas</h2>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1"><div className="text-lg font-bold" style={{ color: BOT[simB0].color }}>{roundWins[0]}</div><div className="text-xs text-gray-500">{((roundWins[0] / totalR) * 100).toFixed(1)}%</div></div>
            <div className="text-center px-3"><div className="text-xs text-gray-600">{totalR} rondas</div></div>
            <div className="text-center flex-1"><div className="text-lg font-bold" style={{ color: BOT[simB1].color }}>{roundWins[1]}</div><div className="text-xs text-gray-500">{((roundWins[1] / totalR) * 100).toFixed(1)}%</div></div>
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
              <div className="text-xs text-gray-500">{(sweepWins[0] + sweepWins[1] + sweepWins[2]) > 0 ? ((sweepWins[0] / (sweepWins[0] + sweepWins[1] + sweepWins[2])) * 100).toFixed(1) : 0}%</div>
            </div>
            <div className="text-center px-3">
              <div className="text-xs text-gray-500">{sweepWins[2]} empates</div>
              <div className="text-xs text-gray-600">{sweepWins[0] + sweepWins[1] + sweepWins[2]} pares</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-lg font-bold" style={{ color: BOT[simB1].color }}>{sweepWins[1]}</div>
              <div className="text-xs text-gray-500">{(sweepWins[0] + sweepWins[1] + sweepWins[2]) > 0 ? ((sweepWins[1] / (sweepWins[0] + sweepWins[1] + sweepWins[2])) * 100).toFixed(1) : 0}%</div>
            </div>
          </div>
        </div>
      )}

      {chartData?.length > 0 && (
        <div className="w-full bg-gray-900 rounded-xl border border-gray-800 p-3">
          <h2 className="text-xs text-gray-400 text-center mb-2">Cartas agarradas por ronda</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="cartas" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} label={{ value: "Cartas", position: "insideBottom", offset: -3, fill: "#6b7280", fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} formatter={(v) => <span style={{ color: v === BOT[simB0].name ? BOT[simB0].color : BOT[simB1].color }}>{v}</span>} />
              <Bar dataKey={BOT[simB0].name} fill={BOT[simB0].color} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey={BOT[simB1].name} fill={BOT[simB1].color} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!chartData && !simRun && <div className="text-gray-600 mt-6 text-sm">Elegí los bots y dale a <span className="text-emerald-500">Simular</span></div>}
    </div>
  )}

  {/* ─── MATCH ─── */}
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
                style={matchRound === "A" ? { background: mvBots[0].color + "30" } : {}}>Ronda A — {mvBots[0].name} empieza</button>
              <button onClick={() => switchMR("B")} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${matchRound === "B" ? "text-white" : "text-gray-500"}`}
                style={matchRound === "B" ? { background: mvBots[1].color + "30" } : {}}>Ronda B — {mvBots[1].name} empieza</button>
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
            {step.type === "deal" && <span className="text-gray-300">Se reparten <span className="text-white font-bold">7 cartas</span></span>}
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
              <div><span className="text-gray-400">Mazo vacío — </span><span className="font-bold" style={{ color: bn(step.winner).color }}>{bn(step.winner).name}</span><span className="text-gray-400"> gana</span></div>
            )}
          </div>

          {/* Hands */}
          {(matchSwapped ? [1, 0] : [0, 1]).map(slot => {
            const bot = bn(slot); const isAct = (step.type === "turn" || step.type === "cut") && step.player === slot;
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

  {/* ─── PLAY ─── */}
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
          canPlayerCut={canPlayerCut} setShowBot={setShowBot} playerDraw={playerDraw} playerDiscard={playerDiscard}
          playerCut={playerCut} selectCard={selectCard} nextRound={nextRound} resetGame={resetGame} sortHand={sortHand} />
      )}
    </div>
  )}
</div>
```

);
}