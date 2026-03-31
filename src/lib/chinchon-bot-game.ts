/* ==============================================================
   Pure game logic for Chinchón (Argentine variant)
   Shared between ChinchonArena.tsx and tests
   ============================================================== */

export type Card = { suit: number; rank: number };

export type MeldResult = {
  melds: number[][];
  resto: number;
  minFree: number;
  meldsCut: number[][];
};

export type RoundResult = {
  winner: 0 | 1;
  cards: number;
  addScores: [number, number];
  chinchon: boolean;
};

export type Strategy = {
  pickDiscard: (hand: Card[]) => number;
  canCut: (m7: MeldResult, score: number, hand: Card[]) => boolean;
  drawConfig?: { mode: string; restoThreshold?: number };
};

// Constants
export const SUITS = [0, 1, 2, 3];
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const RANK_ORDER: Record<number, number> = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11,
};
export const JOKER_REST = 50;

// Card helpers
export const isJoker = (c: Card): boolean => c.rank === 0;
export const cardRest = (c: Card): number => isJoker(c) ? JOKER_REST : c.rank;
export const sameCard = (a: Card | null | undefined, b: Card | null | undefined): boolean =>
  !!(a && b && a.rank === b.rank && a.suit === b.suit);

export function createDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ suit: s, rank: r });
  d.push({ suit: -1, rank: 0 }, { suit: -1, rank: 0 }); // 2 jokers
  return d;
}

export function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function combos(arr: number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const res: number[][] = [];
  const go = (s: number, cur: number[]) => {
    if (cur.length === k) { res.push([...cur]); return; }
    for (let i = s; i <= arr.length - (k - cur.length); i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); }
  };
  go(0, []);
  return res;
}

export function findAllMelds(hand: Card[]): number[][] {
  const melds: number[][] = [], jIds: number[] = [];
  hand.forEach((c, i) => { if (isJoker(c)) jIds.push(i); });
  const nJ = jIds.length;
  const byRank: Record<number, number[]> = {};
  hand.forEach((c, i) => { if (!isJoker(c)) (byRank[c.rank] ??= []).push(i); });
  for (const indices of Object.values(byRank)) {
    for (let sz = Math.min(indices.length, 4); sz >= 2; sz--)
      for (const sub of combos(indices, sz))
        for (let j = 0; j <= nJ; j++) { if (sz + j < 3 || sz + j > 4) continue; for (const jc of combos(jIds, j)) melds.push([...sub, ...jc]); }
    if (nJ >= 2) for (const idx of indices) for (const jc of combos(jIds, 2)) melds.push([idx, ...jc]);
  }
  const bySuit: Record<number, number[]> = {};
  hand.forEach((c, i) => { if (!isJoker(c)) (bySuit[c.suit] ??= []).push(i); });
  for (const indices of Object.values(bySuit)) {
    const om: Record<number, number> = {};
    for (const i of indices) om[RANK_ORDER[hand[i].rank]] = i;
    for (let s = 0; s <= 11; s++) for (let e = s + 2; e <= 11; e++) {
      if (e - s + 1 > 7) break;
      const present: number[] = []; let gaps = 0;
      for (let p = s; p <= e; p++) { if (om[p] !== undefined) present.push(om[p]); else gaps++; }
      if (present.length < 2 || gaps > nJ) continue;
      if (gaps === 0) melds.push([...present]);
      else for (const jc of combos(jIds, gaps)) melds.push([...present, ...jc]);
    }
  }
  if (nJ >= 2) for (const indices of Object.values(bySuit)) {
    const om: Record<number, number> = {};
    for (const i of indices) om[RANK_ORDER[hand[i].rank]] = i;
    for (const [ps, idx] of Object.entries(om)) {
      const pos = +ps;
      for (let s = pos - 2; s <= pos; s++) {
        const e2 = s + 2; if (s < 0 || e2 > 11) continue;
        let rc = 0; for (let p = s; p <= e2; p++) if (om[p] !== undefined) rc++;
        if (rc === 1) for (const jc of combos(jIds, 2)) melds.push([idx, ...jc]);
      }
    }
  }
  return melds;
}

export function findBestMelds(hand: Card[]): MeldResult {
  const all = findAllMelds(hand);
  const totalR = hand.reduce((s, c) => s + cardRest(c), 0);
  let bestR = totalR, bestSet: number[][] = [], minFree = hand.length, minFreeSet: number[][] = [], minFreeR = totalR;
  const bt = (idx: number, used: Set<number>, cur: number[][]) => {
    const free = hand.filter((_, i) => !used.has(i));
    const r = free.reduce((s, c) => s + cardRest(c), 0);
    const cnt = free.length;
    if (r < bestR) { bestR = r; bestSet = [...cur]; }
    if (cnt < minFree || (cnt === minFree && r < minFreeR)) { minFree = cnt; minFreeSet = [...cur]; minFreeR = r; }
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

export function checkChinchon(hand: Card[]): boolean {
  if (hand.length !== 7) return false;
  if (hand.some(isJoker)) return false;
  const normals = hand.filter(c => !isJoker(c));
  if (normals.length > 0) {
    const suit = normals[0].suit;
    if (!normals.every(c => c.suit === suit)) return false;
  }
  const orders = normals.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  for (let start = 0; start <= 5; start++) {
    const end = start + 6;
    let gaps = 0;
    for (let p = start; p <= end; p++) {
      if (!orders.includes(p)) gaps++;
    }
    if (gaps === 0) return true;
  }
  return false;
}

export const legalDiscardIndex = (hand: Card[], idx: number): number => {
  if (idx >= 0 && idx < hand.length && !isJoker(hand[idx])) return idx;
  for (let i = hand.length - 1; i >= 0; i--) if (!isJoker(hand[i])) return i;
  return idx;
};

export function cutScore(hand: Card[]): { score: number; chinchon: boolean } {
  if (checkChinchon(hand)) return { score: 0, chinchon: true };
  const m = findBestMelds(hand);
  if (m.minFree === 0) return { score: -10, chinchon: false };
  return { score: m.resto, chinchon: false };
}

export function shouldDrawDiscard(hand: Card[], top: Card, botObj: Strategy): boolean {
  if (!top) return false;
  const dc = botObj.drawConfig;
  if (!dc) return false;
  if (dc.mode === "always_deck") return false;
  const b7 = findBestMelds(hand);
  const t2 = [...hand, { ...top }];
  const a8 = findBestMelds(t2);
  if (a8.minFree < b7.minFree) return true;
  if (dc.mode === "aggressive") return a8.resto < b7.resto;
  return a8.resto < b7.resto - (dc.restoThreshold ?? 3);
}

export function playRoundScored(
  h0: Card[],
  h1: Card[],
  deckIn: Card[],
  strat0: Strategy,
  strat1: Strategy,
  scores: [number, number],
): RoundResult {
  const h: [Card[], Card[]] = [h0, h1];
  const deck = deckIn;
  const st: [Strategy, Strategy] = [strat0, strat1];
  const dr: [number, number] = [0, 0];
  const dp: Card[] = [];

  // Starter (h0) gets 8 cards — deal one extra from the deck, then discard one
  if (deck.length) h[0].push(deck.pop()!);
  {
    const wi = legalDiscardIndex(h[0], st[0].pickDiscard(h[0]));
    const disc = h[0].splice(wi, 1)[0]; dp.push(disc);
    const m7 = findBestMelds(h[0]);
    if (st[0].canCut(m7, scores[0], h[0])) {
      const cs = cutScore(h[0]); const other = findBestMelds(h[1]);
      return { winner: 0, cards: 0, addScores: [cs.score, other.resto], chinchon: cs.chinchon };
    }
  }
  // Player 1 can cut with their initial 7 cards before their first turn
  {
    const m7 = findBestMelds(h[1]);
    if (st[1].canCut(m7, scores[1], h[1])) {
      const cs = cutScore(h[1]); const other = findBestMelds(h[0]);
      return { winner: 1, cards: 0, addScores: [other.resto, cs.score], chinchon: cs.chinchon };
    }
  }
  // Main loop: player 1 goes first
  for (let t = 0; t < 80; t++) {
    const p = (1 - (t % 2)) as 0 | 1; if (!deck.length) break;
    const top = dp.length ? dp[dp.length - 1] : null;
    let card: Card;
    if (top && st[p].drawConfig && shouldDrawDiscard(h[p], top, st[p])) { card = dp.pop()!; }
    else { card = deck.pop()!; }
    h[p].push(card);
    const wi = legalDiscardIndex(h[p], st[p].pickDiscard(h[p]));
    const disc = h[p][wi]; const kept = !sameCard(disc, card); h[p].splice(wi, 1);
    dp.push(disc);
    if (kept) dr[p]++;
    const m7 = findBestMelds(h[p]);
    if (st[p].canCut(m7, scores[p], h[p])) {
      const cs = cutScore(h[p]); const other = findBestMelds(h[1 - p as 0 | 1]);
      return {
        winner: p,
        cards: dr[p],
        addScores: p === 0 ? [cs.score, other.resto] : [other.resto, cs.score],
        chinchon: cs.chinchon,
      };
    }
  }
  const m0 = findBestMelds(h[0]), m1 = findBestMelds(h[1]);
  const w: 0 | 1 = m0.minFree <= m1.minFree ? 0 : 1;
  return { winner: w, cards: dr[w], addScores: [m0.resto, m1.resto], chinchon: false };
}
