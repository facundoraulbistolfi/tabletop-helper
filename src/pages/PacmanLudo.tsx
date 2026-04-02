import { useState, useEffect, useMemo, useRef, useCallback } from "react";

interface Token {
  id: string;
  state: "base" | "path" | "home" | "finished";
  pathIdx: number;
  homeIdx: number;
  baseSlot: number;
}

type TokenMap = Record<number, Token[]>;

interface PlayerConfig {
  id: number;
  name: string;
  color: string;
  glow: string;
  home: string;
}

interface PcfgEntry {
  startIdx: number;
  homeStretch: number[][];
  basePos: number[][];
  safeIdx: number;
}

type GameMode = "normal" | "divertido" | "hardcore";

interface RouletteSection {
  value: number;
  label: string;
  weight: number;
  color: string;
}

// Weights for values [6, 5, 4, 3, 2, 1]
const DIVERTIDO_WEIGHTS = [1, 2, 3, 4, 5, 6];
const HARDCORE_WEIGHTS = [1, 2, 4, 8, 16, 32];
const GHOST_CHANCE: Record<string, number> = { divertido: 20, hardcore: 10 };

const SECTION_COLORS = ["#2121DE", "#FF0000", "#00FFFF", "#FFB8FF", "#FF7722", "#FFE000"];

const GRID = 15;
const PLAYERS: PlayerConfig[] = [
{ id: 0, name: "BLINKY", color: "#FF0000", glow: "#ff000088", home: "#330000" },
{ id: 1, name: "INKY",   color: "#00FFFF", glow: "#00ffff88", home: "#003333" },
{ id: 2, name: "CLYDE",  color: "#FFB852", glow: "#ffb85288", home: "#332200" },
{ id: 3, name: "PINKY",  color: "#FFB8FF", glow: "#ffb8ff88", home: "#330033" },
];

const PATH = [
[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],
[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],
];

const PCFG: PcfgEntry[] = [
{ startIdx:1,  homeStretch:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],   basePos:[[2,2],[2,3],[3,2],[3,3]],     safeIdx:1  },
{ startIdx:14, homeStretch:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],   basePos:[[2,11],[2,12],[3,11],[3,12]], safeIdx:14 },
{ startIdx:27, homeStretch:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],basePos:[[11,11],[11,12],[12,11],[12,12]],safeIdx:27},
{ startIdx:40, homeStretch:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],basePos:[[11,2],[11,3],[12,2],[12,3]], safeIdx:40 },
];

const SAFE = new Set([1, 14, 27, 40, 9, 22, 35, 48]);

// ── Pure helpers ──
function stepsFromStart(pid: number, pathIdx: number): number {
return ((pathIdx - PCFG[pid].startIdx + 52) % 52) + 1;
}

function canTokenMove(tok: Token, pid: number, dice: number): boolean {
if (tok.state === "finished") return false;
if (tok.state === "base") return dice === 6;
if (tok.state === "path") return stepsFromStart(pid, tok.pathIdx) + dice <= 57;
if (tok.state === "home") return tok.homeIdx + dice <= 5;
return false;
}

function getTokenPos(tok: Token, pid: number): number[] {
if (tok.state === "base") return PCFG[pid].basePos[tok.baseSlot];
if (tok.state === "path") return PATH[tok.pathIdx];
if (tok.state === "home") return PCFG[pid].homeStretch[tok.homeIdx];
return [7, 7];
}

function cloneTokens(t: TokenMap): TokenMap {
const c: TokenMap = {};
for (const k in t) c[k] = t[k].map((tk: Token) => ({ ...tk }));
return c;
}

function allInBase(playerTokens: Token[]): boolean {
return playerTokens.every(t => t.state === "base");
}

// Check if a token on the path has an enemy 1 step behind it
function isSweating(tok: Token, pid: number, allTokens: TokenMap, numPlayers: number): boolean {
if (tok.state !== "path") return false;
const behindIdx = ((tok.pathIdx - 1) + 52) % 52;
for (let p = 0; p < numPlayers; p++) {
  if (p === pid) continue;
  if ((allTokens[p] || []).some(ot => ot.state === "path" && ot.pathIdx === behindIdx)) return true;
}
return false;
}

function getRouletteConfig(mode: GameMode, isAllBase: boolean): RouletteSection[] {
if (isAllBase) {
  const ghostW = GHOST_CHANCE[mode] || 20;
  return [
    { value: 6, label: "👻", weight: ghostW, color: "#00FF88" },
    { value: 0, label: "✕", weight: 100 - ghostW, color: "#330011" },
  ];
}
const weights = mode === "divertido" ? DIVERTIDO_WEIGHTS : HARDCORE_WEIGHTS;
// values [6,5,4,3,2,1] with corresponding weights
return [6, 5, 4, 3, 2, 1].map((val, i) => ({
  value: val,
  label: String(val),
  weight: weights[i],
  color: SECTION_COLORS[i],
}));
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
const rad = (angleDeg - 90) * Math.PI / 180;
return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
const start = polarToCartesian(cx, cy, r, endAngle);
const end = polarToCartesian(cx, cy, r, startAngle);
const largeArc = endAngle - startAngle > 180 ? 1 : 0;
return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

// Returns { tokens, captured, finished }
function executeMove(allTokens: TokenMap, pid: number, tokId: string, dice: number, numPlayers: number): { tokens: TokenMap, captured: boolean, finished: boolean } {
const nt = cloneTokens(allTokens);
const cfg = PCFG[pid];
const ti = nt[pid].findIndex(t => t.id === tokId);
const t = nt[pid][ti];
let captured = false;

if (t.state === "base" && dice === 6) {
t.state = "path";
t.pathIdx = cfg.startIdx;
// Check capture at start pos
if (!SAFE.has(t.pathIdx)) {
for (let p = 0; p < numPlayers; p++) {
if (p === pid) continue;
nt[p].forEach(ot => {
if (ot.state === "path" && ot.pathIdx === t.pathIdx) {
ot.state = "base";
ot.pathIdx = -1;
ot.homeIdx = -1;
captured = true;
}
});
}
}
} else if (t.state === "path") {
const totalSteps = stepsFromStart(pid, t.pathIdx) + dice;
if (totalSteps <= 51) {
// Stay on main path
t.pathIdx = (cfg.startIdx + totalSteps - 1) % 52;
// Capture check
if (!SAFE.has(t.pathIdx)) {
for (let p = 0; p < numPlayers; p++) {
if (p === pid) continue;
nt[p].forEach(ot => {
if (ot.state === "path" && ot.pathIdx === t.pathIdx) {
ot.state = "base";
ot.pathIdx = -1;
ot.homeIdx = -1;
captured = true;
}
});
}
}
} else {
// Enter home stretch
const homeIdx = totalSteps - 52;
t.pathIdx = -1;
if (homeIdx >= 5) {
t.state = "finished";
t.homeIdx = 5;
} else {
t.state = "home";
t.homeIdx = homeIdx;
}
}
} else if (t.state === "home") {
t.homeIdx += dice;
if (t.homeIdx >= 5) {
t.homeIdx = 5;
t.state = "finished";
}
}

const allFinished = nt[pid].every(tk => tk.state === "finished");
return { tokens: nt, captured, finished: allFinished };
}

// ── Components ──
function useWindowSize(): { w: number, h: number } {
const [s, set] = useState({ w: window.innerWidth, h: window.innerHeight });
useEffect(() => {
const f = () => set({ w: window.innerWidth, h: window.innerHeight });
window.addEventListener("resize", f);
return () => window.removeEventListener("resize", f);
}, []);
return s;
}

function Ghost({ color, size, glow, sweating }: { color: string, size: number, glow?: string, sweating?: boolean }) {
return (
<svg width={size} height={size} viewBox="0 0 16 16" style={{ filter: glow ? `drop-shadow(0 0 4px ${glow})` : undefined, display: "block" }}>
<path d="M3 14 L3 6 Q3 2 8 2 Q13 2 13 6 L13 14 L11 12 L9.5 14 L8 12 L6.5 14 L5 12 Z" fill={color} />
<rect x="5" y="5" width="2.5" height="3" rx="1" fill="white" />
<rect x="8.5" y="5" width="2.5" height="3" rx="1" fill="white" />
<rect x="6" y="6" width="1.5" height="1.5" rx=".5" fill="#222" />
<rect x="9.5" y="6" width="1.5" height="1.5" rx=".5" fill="#222" />
{sweating && <>
  <circle cx="14" cy="4" r="0.8" fill="#44BBFF" opacity="0.9">
    <animate attributeName="cy" values="4;8;4" dur="0.8s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.8s" repeatCount="indefinite" />
  </circle>
  <circle cx="14.8" cy="6" r="0.6" fill="#44BBFF" opacity="0.7">
    <animate attributeName="cy" values="6;10;6" dur="1s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1s" repeatCount="indefinite" />
  </circle>
</>}
</svg>
);
}

function PacMan({ size }: { size: number }) {
// Classic pac-man as a proper arc with clean wedge mouth
return (
<svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
<defs>
<radialGradient id="pg" cx="40%" cy="38%">
<stop offset="0%" stopColor="#FFf040" />
<stop offset="100%" stopColor="#F5C400" />
</radialGradient>
</defs>
<path d="M50 50 L95 35 A48 48 0 1 0 95 65 Z" fill="url(#pg)" />
<circle cx="46" cy="28" r="5" fill="#111" />
<circle cx="47.5" cy="27" r="1.8" fill="#fff" opacity=".7" />
</svg>
);
}

function DiceWidget({ value, rolling, onClick, disabled, color, sz }: { value: number, rolling: boolean, onClick: () => void, disabled: boolean, color: string, sz: number }) {
const dots: Record<number, number[][]> = { 1: [[1,1]], 2: [[0,2],[2,0]], 3: [[0,2],[1,1],[2,0]], 4: [[0,0],[0,2],[2,0],[2,2]], 5: [[0,0],[0,2],[1,1],[2,0],[2,2]], 6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]] };
return (
<button onClick={onClick} disabled={disabled} style={{
width: sz, height: sz, background: disabled ? "#222" : "#111",
border: `2px solid ${disabled ? "#333" : color}`, borderRadius: sz * 0.16,
cursor: disabled ? "default" : "pointer", display: "grid",
gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(3,1fr)",
gap: 1, padding: sz * 0.12,
boxShadow: disabled ? "none" : `0 0 10px ${color}44`,
transition: "all .3s", transform: rolling ? "rotate(720deg) scale(.8)" : "none",
}}>
{Array.from({ length: 9 }).map((_, i) => {
const r = Math.floor(i / 3), c = i % 3;
const on = (dots[value] || []).some(([dr, dc]: number[]) => dr === r && dc === c);
return <div key={i} style={{ width: "100%", height: "100%", borderRadius: "50%", background: on ? color : "transparent", boxShadow: on ? `0 0 4px ${color}` : "none", transition: "all .3s" }} />;
})}
</button>
);
}

function RouletteWheel({ sections, angle, size, spinning, result }: { sections: RouletteSection[], angle: number, size: number, spinning: boolean, result: number | null }) {
const cx = size / 2, cy = size / 2, r = size / 2 - 4;
const totalWeight = sections.reduce((s, sec) => s + sec.weight, 0);
let cumAngle = 0;
const slices = sections.map((sec, i) => {
  const sliceAngle = (sec.weight / totalWeight) * 360;
  const startA = cumAngle;
  const endA = cumAngle + sliceAngle;
  cumAngle = endA;
  const midA = (startA + endA) / 2;
  const labelPos = polarToCartesian(cx, cy, r * 0.62, midA);
  const isGhost = sec.label === "👻";
  const fontSize = isGhost ? Math.max(14, size * 0.09) : Math.max(12, size * 0.08);
  return (
    <g key={i}>
      <path d={describeArc(cx, cy, r, startA, endA)} fill={sec.color} stroke="#000119" strokeWidth={2} />
      <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="central"
        fill={sec.label === "✕" ? "#ff4444" : "#fff"} fontWeight="900" fontSize={fontSize}
        fontFamily="'Courier New',monospace"
        style={{ textShadow: "0 0 4px #000", pointerEvents: "none" }}>
        {sec.label}
      </text>
    </g>
  );
});

return (
  <svg width={size} height={size + 20} viewBox={`0 0 ${size} ${size + 20}`} style={{ display: "block" }}>
    {/* Pointer at top */}
    <polygon points={`${cx - 10},2 ${cx + 10},2 ${cx},18`} fill="#FFE000" stroke="#000" strokeWidth={1} />
    <g transform={`rotate(${angle}, ${cx}, ${cy + 20})`} style={{ transition: spinning ? "none" : "transform 0.1s" }}>
      <g transform={`translate(0, 20)`}>
        <circle cx={cx} cy={cy} r={r} fill="#0a0a2a" stroke="#FFE00066" strokeWidth={3} />
        {slices}
        <circle cx={cx} cy={cy} r={Math.max(8, r * 0.12)} fill="#111" stroke="#FFE000" strokeWidth={2} />
      </g>
    </g>
    {result !== null && (
      <text x={cx} y={cy + 20} textAnchor="middle" dominantBaseline="central"
        fill="#FFE000" fontSize={Math.max(20, size * 0.15)} fontWeight="900"
        fontFamily="'Courier New',monospace"
        style={{ textShadow: "0 0 12px #FFE000, 0 0 24px #FFE00088", pointerEvents: "none" }}>
        {result === 0 ? "✕" : result}
      </text>
    )}
  </svg>
);
}

function getCellType(r: number, c: number): { type: string, player?: number, idx?: number } {
if (r <= 5 && c <= 5) return { type: "base", player: 0 };
if (r <= 5 && c >= 9) return { type: "base", player: 1 };
if (r >= 9 && c >= 9) return { type: "base", player: 2 };
if (r >= 9 && c <= 5) return { type: "base", player: 3 };
if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return { type: "center" };
const pi = PATH.findIndex(([pr, pc]) => pr === r && pc === c);
if (pi !== -1) return { type: "path", idx: pi };
for (let p = 0; p < 4; p++) {
const hi = PCFG[p].homeStretch.findIndex(([hr, hc]) => hr === r && hc === c);
if (hi !== -1) return { type: "home", player: p, idx: hi };
}
return { type: "empty" };
}

function createTokens(n: number): TokenMap {
const t: TokenMap = {};
for (let p = 0; p < n; p++) t[p] = [0, 1, 2, 3].map(i => ({ id: `${p}-${i}`, state: "base" as const, pathIdx: -1, homeIdx: -1, baseSlot: i }));
return t;
}

// ── Main App ──
export default function PacManLudo() {
const { w: winW, h: winH } = useWindowSize();
const [screen, setScreen] = useState<string>("menu");
const [playerCount, setPlayerCount] = useState(2);
const [gameMode, setGameMode] = useState<GameMode>("normal");
const [tokens, setTokens] = useState<TokenMap>({});
const [cur, setCur] = useState(0);
const [dice, setDice] = useState(1);
const [rolling, setRolling] = useState(false);
const [phase, setPhase] = useState("roll"); // "roll" | "pick" | "moving" | "wait"
const [msg, setMsg] = useState("");
const [winner, setWinner] = useState<number | null>(null);
const [menuDots, setMenuDots] = useState<{r:number,c:number,e:boolean}[]>([]);
const [pac, setPac] = useState<{r:number,c:number,a:number}>({ r: 7, c: 7, a: 0 });
const [consecutiveSixes, setConsecutiveSixes] = useState<Record<number, number>>({});
// Roulette state
const [rouletteOpen, setRouletteOpen] = useState(false);
const [rouletteAngle, setRouletteAngle] = useState(0);
const [rouletteSpinning, setRouletteSpinning] = useState(false);
const [rouletteResult, setRouletteResult] = useState<number | null>(null);
const rouletteSpeedRef = useRef(0);
const rouletteRAF = useRef<number | null>(null);
const rouletteStartRef = useRef(0);
const timeoutRef = useRef<ReturnType<typeof setTimeout>|null>(null);
const [autoPlay, setAutoPlay] = useState(false);
// Track movable tokens for keyboard pick
const movableTokensRef = useRef<Token[]>([]);

const CELL = useMemo(() => {
if (screen === "game") {
const maxH = winH - (winW < 500 ? 100 : 110);
return Math.max(14, Math.min(44, Math.floor(Math.min(winW - 12, maxH) / GRID)));
}
return Math.max(16, Math.min(40, Math.floor(Math.min(winW - 40, winH * 0.45) / GRID)));
}, [winW, winH, screen]);
const BOARD = CELL * GRID;
const gs = Math.max(10, Math.round(CELL * 0.72));
const sm = winW < 500;

// Cleanup timeouts and RAF
useEffect(() => () => {
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  if (rouletteRAF.current) cancelAnimationFrame(rouletteRAF.current);
}, []);

// Keyboard handler (desktop only: space + number keys)
useEffect(() => {
if (screen !== "game") return;
const handler = (e: KeyboardEvent) => {
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    if (rouletteOpen && rouletteSpinning) {
      handleRouletteStop();
    } else if (phase === "roll" && !rolling && !rouletteOpen) {
      if (gameMode === "normal") handleRoll();
      else handleRouletteOpen();
    }
  }
  // Number keys 1-4 for picking tokens
  const num = parseInt(e.key);
  if (phase === "pick" && num >= 1 && num <= movableTokensRef.current.length) {
    const tok = movableTokensRef.current[num - 1];
    if (tok && canTokenMove(tok, cur, dice)) {
      applyMove(tok.id, cur, dice, tokens);
    }
  }
};
window.addEventListener("keydown", handler);
return () => window.removeEventListener("keydown", handler);
});

// Auto-play: auto-roll dice or auto-open roulette when phase becomes "roll"
useEffect(() => {
if (!autoPlay || screen !== "game" || phase !== "roll" || rolling || rouletteOpen) return;
const t = setTimeout(() => {
  if (gameMode === "normal") handleRoll();
  else handleRouletteOpen();
}, 600);
return () => clearTimeout(t);
});

// Auto-play: auto-stop roulette after a random delay
useEffect(() => {
if (!autoPlay || !rouletteOpen || !rouletteSpinning) return;
const delay = 1500 + Math.random() * 2500; // 1.5-4s random stop
const t = setTimeout(() => {
  handleRouletteStop();
}, delay);
return () => clearTimeout(t);
});

// Menu animation
useEffect(() => {
if (screen !== "menu") return;
const d = [];
for (let i = 0; i < PATH.length; i += 2) d.push({ r: PATH[i][0], c: PATH[i][1], e: false });
setMenuDots(d);
let f = 0;
const iv = setInterval(() => {
f = (f + 1) % PATH.length;
const [r, c] = PATH[f];
const pr = f > 0 ? PATH[f - 1] : PATH[PATH.length - 1];
setPac({ r, c, a: Math.atan2(r - pr[0], c - pr[1]) * 180 / Math.PI });
setMenuDots(p => p.map(d => (d.r === r && d.c === c) ? { ...d, e: true } : d));
}, 150);
const rs = setInterval(() => setMenuDots(p => p.map(d => ({ ...d, e: false }))), 5000);
return () => { clearInterval(iv); clearInterval(rs); };
}, [screen]);

function startGame() {
setTokens(createTokens(playerCount));
setCur(0); setDice(1); setPhase("roll");
const actionText = gameMode === "normal" ? "Tirá el dado" : "Girá la ruleta";
setMsg(`¡Turno de ${PLAYERS[0].name}! ${actionText}`);
setWinner(null); setScreen("game");
const sixes: Record<number, number> = {};
for (let i = 0; i < playerCount; i++) sixes[i] = 0;
setConsecutiveSixes(sixes);
setRouletteOpen(false); setRouletteSpinning(false); setRouletteResult(null);
}

function doNextTurn(fromPlayer: number) {
const next = (fromPlayer + 1) % playerCount;
setCur(next);
setPhase("roll");
const actionText = gameMode === "normal" ? "Tirá el dado" : "Girá la ruleta";
setMsg(`¡Turno de ${PLAYERS[next].name}! ${actionText}`);
setConsecutiveSixes(prev => ({ ...prev, [fromPlayer]: 0 }));
}

function applyMove(tokId: string, playerId: number, diceVal: number, currentTokens: TokenMap) {
setPhase("moving");
const result = executeMove(currentTokens, playerId, tokId, diceVal, playerCount);
setTokens(result.tokens);

if (result.finished) {
  setWinner(playerId);
  setScreen("win");
  return;
}

const gotSix = diceVal === 6;
if (result.captured) {
  setMsg(`¡${PLAYERS[playerId].name} comió un fantasma! 👻 Tira de nuevo!`);
  timeoutRef.current = setTimeout(() => setPhase("roll"), 600);
} else if (gotSix) {
  setMsg(`¡${PLAYERS[playerId].name} sacó 6, tira de nuevo!`);
  timeoutRef.current = setTimeout(() => setPhase("roll"), 400);
} else {
  timeoutRef.current = setTimeout(() => doNextTurn(playerId), 600);
}

}

function processRollResult(finalValue: number) {
if (finalValue === 0) {
  // Special roulette: missed ghost entry
  setMsg(`${PLAYERS[cur].name} no sacó fantasma... pierde turno`);
  setPhase("wait");
  timeoutRef.current = setTimeout(() => doNextTurn(cur), 1000);
  return;
}

// Triple-6 penalty (roulette modes only)
if (gameMode !== "normal" && finalValue === 6) {
  const newCount = (consecutiveSixes[cur] || 0) + 1;
  setConsecutiveSixes(prev => ({ ...prev, [cur]: newCount }));
  if (newCount >= 3) {
    setConsecutiveSixes(prev => ({ ...prev, [cur]: 0 }));
    setMsg(`¡${PLAYERS[cur].name} sacó triple 6! Pierde el turno 🚫`);
    setPhase("wait");
    timeoutRef.current = setTimeout(() => doNextTurn(cur), 1500);
    return;
  }
} else if (gameMode !== "normal") {
  setConsecutiveSixes(prev => ({ ...prev, [cur]: 0 }));
}

const movable = tokens[cur].filter(t => canTokenMove(t, cur, finalValue));

if (movable.length === 0) {
  if (finalValue === 6) {
    setMsg(`${PLAYERS[cur].name} no puede mover, ¡pero sacó 6! Tira de nuevo`);
    setPhase("roll");
  } else {
    setMsg(`${PLAYERS[cur].name} no puede mover`);
    setPhase("wait");
    timeoutRef.current = setTimeout(() => doNextTurn(cur), 1000);
  }
} else if (movable.length === 1) {
  setMsg(`Sacó ${finalValue}, moviendo...`);
  timeoutRef.current = setTimeout(() => applyMove(movable[0].id, cur, finalValue, tokens), 300);
} else {
  movableTokensRef.current = movable;
  const hint = !sm ? ` (${movable.map((_,i) => i+1).join(",")})` : "";
  setMsg(`Sacó ${finalValue}. Tocá una ficha para mover${hint}`);
  setPhase("pick");
}
}

function handleRoll() {
if (phase !== "roll" || rolling) return;
setRolling(true);
let count = 0;
const iv = setInterval(() => {
setDice(Math.floor(Math.random() * 6) + 1);
count++;
if (count > 8) {
  clearInterval(iv);
  const final = Math.floor(Math.random() * 6) + 1;
  setDice(final);
  setRolling(false);
  processRollResult(final);
}
}, 80);
}

// ── Roulette mechanics ──

function resolveRouletteAngle(angle: number, sections: RouletteSection[]): number {
const totalWeight = sections.reduce((s, sec) => s + sec.weight, 0);
// Pointer is at top (0°). Wheel rotates clockwise.
// Normalize: which section is under the pointer?
const normalized = ((360 - (angle % 360)) % 360 + 360) % 360;
let cumulative = 0;
for (const sec of sections) {
  cumulative += (sec.weight / totalWeight) * 360;
  if (normalized < cumulative) return sec.value;
}
return sections[sections.length - 1].value;
}

const handleRouletteOpen = useCallback(() => {
if (phase !== "roll" || rouletteSpinning) return;
setRouletteOpen(true);
setRouletteSpinning(true);
setRouletteResult(null);
const initialSpeed = (8 + Math.random() * 6) * 0.8; // deg per frame (~11-16 deg/frame at 60fps, 20% slower)
rouletteSpeedRef.current = initialSpeed;
rouletteStartRef.current = performance.now();
const startAngle = rouletteAngle;
let currentAngle = startAngle;

const spin = (now: number) => {
  const elapsed = now - rouletteStartRef.current;
  if (elapsed > 20000) {
    // Auto-stop after 20 seconds
    rouletteSpeedRef.current = 0;
    stopRoulette(currentAngle);
    return;
  }
  currentAngle += rouletteSpeedRef.current;
  setRouletteAngle(currentAngle);
  rouletteRAF.current = requestAnimationFrame(spin);
};
rouletteRAF.current = requestAnimationFrame(spin);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase, rouletteSpinning, rouletteAngle, tokens, cur, gameMode]);

function stopRoulette(currentAngle: number) {
if (rouletteRAF.current) cancelAnimationFrame(rouletteRAF.current);
let speed = rouletteSpeedRef.current;
let angle = currentAngle;

const decelerate = () => {
  speed *= 0.94;
  angle += speed;
  setRouletteAngle(angle);
  if (speed > 0.2) {
    rouletteRAF.current = requestAnimationFrame(decelerate);
  } else {
    // Fully stopped — resolve
    setRouletteAngle(angle);
    const isBase = allInBase(tokens[cur] || []);
    const sections = getRouletteConfig(gameMode, isBase);
    const result = resolveRouletteAngle(angle, sections);
    setRouletteResult(result);
    setDice(result || 1);
    setRouletteSpinning(false);
    timeoutRef.current = setTimeout(() => {
      setRouletteOpen(false);
      setRouletteResult(null);
      processRollResult(result);
    }, 1200);
  }
};
rouletteRAF.current = requestAnimationFrame(decelerate);
}

function handleRouletteStop() {
if (!rouletteSpinning) return;
if (rouletteRAF.current) cancelAnimationFrame(rouletteRAF.current);
rouletteRAF.current = null;
const angle = rouletteAngle;
const isBase = allInBase(tokens[cur] || []);
const sections = getRouletteConfig(gameMode, isBase);
const result = resolveRouletteAngle(angle, sections);
setRouletteResult(result);
setDice(result || 1);
setRouletteSpinning(false);
timeoutRef.current = setTimeout(() => {
  setRouletteOpen(false);
  setRouletteResult(null);
  processRollResult(result);
}, 1200);
}

function handleTokenClick(tok: Token, pid: number) {
if (pid !== cur || phase !== "pick") return;
if (!canTokenMove(tok, pid, dice)) return;
applyMove(tok.id, pid, dice, tokens);
}

// ── Board rendering ──
function renderBoard() {
const cells = [];
const tEls = [];

for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
  const ct = getCellType(r, c);
  let bg = "transparent", border = "none", content = null, shadow = null;

  if (ct.type === "path") {
    bg = "#1a1a2e"; border = "1px solid #2a2a4a";
    if (SAFE.has(ct.idx!)) {
      const sp = [0, 1, 2, 3].find(p => PCFG[p].safeIdx === ct.idx);
      if (sp !== undefined && sp < playerCount) {
        content = <div style={{ width: Math.max(3, CELL * .18), height: Math.max(3, CELL * .18), borderRadius: "50%", background: PLAYERS[sp].color, opacity: .6 }} />;
        shadow = `inset 0 0 6px ${PLAYERS[sp].color}33`;
      } else {
        content = <div style={{ width: Math.max(2, CELL * .1), height: Math.max(2, CELL * .1), borderRadius: "50%", background: "#FFE00055" }} />;
      }
    } else {
      content = <div style={{ width: Math.max(2, CELL * .1), height: Math.max(2, CELL * .1), borderRadius: "50%", background: "#FFE00055" }} />;
    }
  } else if (ct.type === "home" && ct.player! < playerCount) {
    const p0 = ct.player!;
    bg = PLAYERS[p0].home; border = `1px solid ${PLAYERS[p0].color}44`;
    content = <div style={{ width: Math.max(2, CELL * .1), height: Math.max(2, CELL * .1), borderRadius: "50%", background: PLAYERS[p0].color, opacity: .4 }} />;
  } else if (ct.type === "base" && ct.player! < playerCount) {
    const p0 = ct.player!;
    const bp = PCFG[p0].basePos;
    const isSlot = bp.some(([br, bc]: number[]) => br === r && bc === c);
    const cMin = p0 === 0 || p0 === 3 ? 1 : 10, cMax = cMin + 3;
    const rMin = p0 < 2 ? 1 : 10, rMax = rMin + 3;
    const inner = r >= rMin && r <= rMax && c >= cMin && c <= cMax;
    bg = inner ? PLAYERS[p0].home : `${PLAYERS[p0].color}11`;
    border = inner ? `1px solid ${PLAYERS[p0].color}33` : "none";
    if (isSlot) { bg = "#0a0a15"; border = `2px solid ${PLAYERS[p0].color}55`; shadow = `inset 0 0 6px ${PLAYERS[p0].color}22`; }
  } else if (ct.type === "center") {
    bg = r === 7 && c === 7 ? "#FFE00022" : "#111122"; border = "1px solid #FFE00033";
    if (r === 7 && c === 7) content = <PacMan size={Math.round(CELL * .55)} />;
  }

  cells.push(<div key={`${r}-${c}`} style={{
    position: "absolute", left: c * CELL, top: r * CELL, width: CELL, height: CELL,
    background: bg, border, boxShadow: shadow || undefined,
    display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2,
  }}>{content}</div>);
}

// Collect all tokens with positions for stacking
const posMap: Record<string, {tok: Token, pid: number}[]> = {};
for (let p = 0; p < playerCount; p++) {
  (tokens[p] || []).forEach(tok => {
    if (tok.state === "finished") return;
    const [r, c] = getTokenPos(tok, p);
    const key = `${r}-${c}`;
    if (!posMap[key]) posMap[key] = [];
    posMap[key].push({ tok, pid: p });
  });
}

// Render tokens with stacking offsets
for (const key in posMap) {
  const group = posMap[key];
  const count = group.length;
  group.forEach(({ tok, pid }, gi) => {
    const [r, c] = getTokenPos(tok, pid);
    const isClickable = pid === cur && phase === "pick" && canTokenMove(tok, pid, dice);
    const sweating = isSweating(tok, pid, tokens, playerCount);
    // Pick number for keyboard (desktop only)
    const pickIdx = isClickable ? movableTokensRef.current.findIndex(mt => mt.id === tok.id) : -1;
    // Stack offset: shift tokens slightly so they're all visible
    const offsetX = count > 1 ? (gi - (count - 1) / 2) * Math.max(4, CELL * 0.18) : 0;
    const offsetY = count > 1 ? (gi - (count - 1) / 2) * Math.max(-3, -CELL * 0.12) : 0;

    tEls.push(<div key={tok.id} onClick={() => handleTokenClick(tok, pid)} style={{
      position: "absolute",
      left: c * CELL + (CELL - gs) / 2 + offsetX,
      top: r * CELL + (CELL - gs) / 2 + offsetY,
      width: gs, height: gs,
      cursor: isClickable ? "pointer" : "default",
      zIndex: isClickable ? 30 : 10 + gi,
      transition: "all .4s cubic-bezier(.34,1.56,.64,1)",
      transform: isClickable ? "scale(1.3)" : (sweating ? "scale(1) translateX(1px)" : "scale(1)"),
      animation: isClickable ? "gp .8s infinite alternate" : (sweating ? "sweat .3s infinite alternate" : "none"),
      filter: isClickable ? `drop-shadow(0 0 6px ${PLAYERS[pid].color})` : undefined,
    }}>
      <Ghost color={PLAYERS[pid].color} size={gs} glow={isClickable ? PLAYERS[pid].glow : undefined} sweating={sweating} />
      {isClickable && pickIdx >= 0 && !sm && (
        <div style={{
          position: "absolute", top: -Math.max(6, gs * 0.25), left: "50%", transform: "translateX(-50%)",
          background: PLAYERS[pid].color, color: "#000", fontWeight: 900,
          fontSize: Math.max(8, gs * 0.35), fontFamily: "'Courier New',monospace",
          width: Math.max(12, gs * 0.4), height: Math.max(12, gs * 0.4),
          borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 6px ${PLAYERS[pid].color}`,
        }}>{pickIdx + 1}</div>
      )}
    </div>);
  });
}

// Also render finished tokens in center
for (let p = 0; p < playerCount; p++) {
  const fin = (tokens[p] || []).filter(t => t.state === "finished");
  if (fin.length > 0) {
    const angles = [0, 90, 180, 270];
    const centerOff = Math.max(3, CELL * 0.2);
    tEls.push(<div key={`fin-${p}`} style={{
      position: "absolute",
      left: 7 * CELL + (CELL - gs) / 2 + Math.cos(angles[p] * Math.PI / 180) * centerOff,
      top: 7 * CELL + (CELL - gs) / 2 + Math.sin(angles[p] * Math.PI / 180) * centerOff,
      width: gs, height: gs, zIndex: 5, opacity: 0.7,
    }}>
      <Ghost color={PLAYERS[p].color} size={gs} />
      <div style={{ position: "absolute", bottom: -2, right: -2, fontSize: Math.max(7, gs * 0.35), color: PLAYERS[p].color, fontWeight: 900, fontFamily: "'Courier New',monospace", textShadow: `0 0 4px #000` }}>{fin.length}</div>
    </div>);
  }
}

return (
  <div style={{
    position: "relative", width: BOARD, height: BOARD, background: "#000119",
    borderRadius: Math.max(4, CELL * .25), border: "2px solid #1a1a4a",
    boxShadow: "0 0 24px #00008833, inset 0 0 30px #00001a",
    overflow: "hidden", flexShrink: 0,
  }}>
    <div style={{ position: "absolute", inset: 2, border: "1px solid #1a1a6a", borderRadius: Math.max(3, CELL * .18), pointerEvents: "none" }} />
    {cells}{tEls}
  </div>
);

}

const CSS = `@keyframes gp{from{filter:brightness(1)}to{filter:brightness(1.5)}} @keyframes fl{from{transform:translateY(0)}to{transform:translateY(-6px)}} @keyframes sweat{0%{transform:scale(1) translateX(-1px)}100%{transform:scale(1) translateX(1px)}} *{box-sizing:border-box;margin:0;padding:0} html,body,#root{height:100%;overflow:hidden} ::-webkit-scrollbar{display:none}`;

// ═══ MENU ═══
if (screen === "menu") {
return (
<div style={{ height: "100dvh", background: "#000119", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New',monospace", color: "#FFE000", padding: 16, overflow: "hidden", position: "relative" }}>
<style>{CSS}</style>
<div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: .1 }}>
{menuDots.map((d, i) => !d.e && <div key={i} style={{ position: "absolute", left: `${d.c / 15 * 100}%`, top: `${d.r / 15 * 100}%`, width: 4, height: 4, borderRadius: "50%", background: "#FFE000" }} />)}
<div style={{ position: "absolute", left: `${pac.c / 15 * 100}%`, top: `${pac.r / 15 * 100}%`, transform: `rotate(${pac.a}deg)`, transition: "all .15s linear" }}><PacMan size={18} /></div>
</div>
<div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%", maxWidth: 380 }}>
<div style={{ fontSize: sm ? 9 : 11, letterSpacing: 4, opacity: .6, marginBottom: 4 }}>── PRESENTA ──</div>
<h1 style={{ fontSize: sm ? 30 : 44, fontWeight: 900, margin: "0 0 4px", textShadow: "0 0 20px #FFE000, 0 0 40px #FFE00066", letterSpacing: 4 }}>PAC-LUDO</h1>
<div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: sm ? 16 : 24 }}>
{PLAYERS.map(p => <Ghost key={p.id} color={p.color} size={sm ? 20 : 26} glow={p.glow} />)}
</div>
<div style={{ background: "#0a0a2a", border: "2px solid #1a1a6a", borderRadius: 12, padding: sm ? "14px" : "18px 24px", marginBottom: 16 }}>
<div style={{ fontSize: sm ? 10 : 12, marginBottom: 10, letterSpacing: 2, color: "#aaa" }}>JUGADORES</div>
<div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
{[2, 3, 4].map(n => (
<button key={n} onClick={() => setPlayerCount(n)} style={{
width: sm ? 44 : 52, height: sm ? 44 : 52, fontSize: sm ? 17 : 21, fontWeight: 900,
fontFamily: "'Courier New',monospace",
background: playerCount === n ? "#FFE000" : "#111133", color: playerCount === n ? "#000" : "#666",
border: `2px solid ${playerCount === n ? "#FFE000" : "#333366"}`, borderRadius: 10, cursor: "pointer",
boxShadow: playerCount === n ? "0 0 14px #FFE00066" : "none", transition: "all .2s",
}}>{n}</button>
))}
</div>
<div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
{PLAYERS.slice(0, playerCount).map(p => (
<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: `${p.color}15`, border: `1px solid ${p.color}44`, borderRadius: 8 }}>
<Ghost color={p.color} size={12} /><span style={{ color: p.color, fontSize: sm ? 8 : 9, letterSpacing: 1, fontWeight: 700 }}>{p.name}</span>
</div>
))}
</div>
</div>
<div style={{ background: "#0a0a2a", border: "2px solid #1a1a6a", borderRadius: 12, padding: sm ? "14px" : "18px 24px", marginBottom: 16 }}>
<div style={{ fontSize: sm ? 10 : 12, marginBottom: 10, letterSpacing: 2, color: "#aaa" }}>MODO DE JUEGO</div>
<div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
{([
  { mode: "normal" as GameMode, label: "NORMAL", sub: "Aburrido" },
  { mode: "divertido" as GameMode, label: "RULETA 🎡", sub: "Divertido" },
  { mode: "hardcore" as GameMode, label: "RULETA 💀", sub: "Hardcore" },
]).map(({ mode, label, sub }) => (
  <button key={mode} onClick={() => setGameMode(mode)} style={{
    padding: sm ? "6px 10px" : "8px 14px", fontSize: sm ? 10 : 12, fontWeight: 900,
    fontFamily: "'Courier New',monospace",
    background: gameMode === mode ? "#FFE000" : "#111133", color: gameMode === mode ? "#000" : "#666",
    border: `2px solid ${gameMode === mode ? "#FFE000" : "#333366"}`, borderRadius: 10, cursor: "pointer",
    boxShadow: gameMode === mode ? "0 0 14px #FFE00066" : "none", transition: "all .2s",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: sm ? 80 : 96,
  }}>
    <span>{label}</span>
    <span style={{ fontSize: sm ? 7 : 8, fontWeight: 400, opacity: 0.7 }}>{sub}</span>
  </button>
))}
</div>
</div>
<button onClick={startGame} style={{
padding: sm ? "10px 32px" : "12px 40px", fontSize: sm ? 14 : 16, fontWeight: 900,
fontFamily: "'Courier New',monospace", background: "#FFE000", color: "#000", border: "none",
borderRadius: 12, cursor: "pointer", letterSpacing: 4, boxShadow: "0 0 20px #FFE00044",
}}>▶ JUGAR</button>
<div style={{ marginTop: 12, fontSize: sm ? 8 : 9, color: "#555", letterSpacing: 1, lineHeight: 1.6 }}>
{gameMode === "normal" && "SACÁ 6 PARA SACAR FICHAS · CAPTURÁ RIVALES · LLEGÁ AL CENTRO"}
{gameMode === "divertido" && "GIRÁ LA RULETA · FRENALA VOS · TRIPLE 6 = PIERDE TURNO"}
{gameMode === "hardcore" && "PROBABILIDADES EXTREMAS · FRENALA VOS · TRIPLE 6 = PIERDE TURNO"}
</div>
</div>
</div>
);
}

// ═══ WIN ═══
if (screen === "win" && winner !== null) {
const w = PLAYERS[winner];
return (
<div style={{ height: "100dvh", background: "#000119", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New',monospace", color: "#FFE000" }}>
<style>{CSS}</style>
<div style={{ animation: "fl 1s infinite alternate" }}><Ghost color={w.color} size={sm ? 56 : 80} glow={w.glow} /></div>
<h1 style={{ fontSize: sm ? 24 : 36, color: w.color, textShadow: `0 0 30px ${w.color}`, margin: "14px 0 6px", letterSpacing: 4 }}>¡{w.name} GANA!</h1>
<div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>GAME OVER</div>
<button onClick={() => setScreen("menu")} style={{ padding: "8px 28px", fontSize: 13, fontFamily: "'Courier New',monospace", background: "transparent", color: "#FFE000", border: "2px solid #FFE000", borderRadius: 10, cursor: "pointer", letterSpacing: 3 }}>MENÚ</button>
</div>
);
}

// ═══ GAME ═══
const cp = PLAYERS[cur];
const finCount = (tokens[cur] || []).filter(t => t.state === "finished").length;
const dsz = sm ? 44 : 54;

return (
<div style={{ height: "100dvh", background: "#000119", fontFamily: "'Courier New',monospace", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", padding: sm ? "4px 2px" : "8px 4px", overflow: "hidden" }}>
<style>{CSS}</style>

  {/* Top bar */}
  <div style={{ display: "flex", alignItems: "center", gap: sm ? 6 : 12, marginBottom: sm ? 2 : 6, width: "100%", maxWidth: BOARD, justifyContent: "center" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: sm ? "3px 8px" : "4px 12px", background: `${cp.color}15`, border: `2px solid ${cp.color}44`, borderRadius: 8 }}>
      <Ghost color={cp.color} size={sm ? 14 : 18} glow={cp.glow} />
      <span style={{ color: cp.color, fontWeight: 900, fontSize: sm ? 10 : 12, letterSpacing: 2, textShadow: `0 0 8px ${cp.color}66` }}>{cp.name}</span>
    </div>
    {gameMode === "normal" ? (
      <DiceWidget value={dice} rolling={rolling} onClick={handleRoll} disabled={phase !== "roll" || rolling} color={cp.color} sz={dsz} />
    ) : (
      <button onClick={handleRouletteOpen} disabled={phase !== "roll" || rouletteOpen} style={{
        width: dsz, height: dsz, borderRadius: "50%", background: phase === "roll" && !rouletteOpen ? "#111" : "#222",
        border: `2px solid ${phase === "roll" && !rouletteOpen ? cp.color : "#333"}`,
        cursor: phase === "roll" && !rouletteOpen ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: phase === "roll" && !rouletteOpen ? `0 0 10px ${cp.color}44` : "none",
        transition: "all .3s", fontSize: sm ? 18 : 22,
      }}>🎡</button>
    )}
    <div style={{ textAlign: "center", minWidth: 36 }}>
      <div style={{ fontSize: sm ? 7 : 8, color: "#666", letterSpacing: 1 }}>META</div>
      <div style={{ fontSize: sm ? 14 : 18, fontWeight: 900, color: cp.color, textShadow: `0 0 8px ${cp.color}66` }}>{finCount}/4</div>
    </div>
  </div>

  {/* Message */}
  <div style={{
    fontSize: sm ? 9 : 10, color: phase === "pick" ? "#fff" : "#FFE000", marginBottom: sm ? 2 : 4,
    textAlign: "center", minHeight: 14, letterSpacing: 1,
    textShadow: phase === "pick" ? "0 0 8px #ffffff66" : "0 0 6px #FFE00044",
    maxWidth: BOARD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px",
    fontWeight: phase === "pick" ? 900 : 400,
  }}>{msg}</div>

  {renderBoard()}

  {/* Bottom bar */}
  <div style={{ display: "flex", gap: sm ? 4 : 8, marginTop: sm ? 3 : 6, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
    {PLAYERS.slice(0, playerCount).map(p => {
      const f = (tokens[p.id] || []).filter(t => t.state === "finished").length;
      return (
        <div key={p.id} style={{
          display: "flex", alignItems: "center", gap: 3, padding: sm ? "2px 5px" : "2px 7px",
          background: cur === p.id ? `${p.color}22` : "#0a0a1a",
          border: `1px solid ${cur === p.id ? p.color : "#222"}`, borderRadius: 5,
          opacity: cur === p.id ? 1 : .45, transition: "all .3s",
        }}>
          <Ghost color={p.color} size={sm ? 8 : 10} /><span style={{ fontSize: sm ? 7 : 8, color: p.color, fontWeight: 700 }}>{f}/4</span>
        </div>
      );
    })}
    <button onClick={() => setAutoPlay(a => !a)} style={{
      padding: sm ? "2px 5px" : "2px 7px", fontSize: sm ? 7 : 8, fontFamily: "'Courier New',monospace",
      background: autoPlay ? "#FFE00022" : "transparent", color: autoPlay ? "#FFE000" : "#444",
      border: `1px solid ${autoPlay ? "#FFE000" : "#333"}`, borderRadius: 5, cursor: "pointer", letterSpacing: 1,
      transition: "all .2s",
    }}>{autoPlay ? "AUTO" : "MANUAL"}</button>
    <button onClick={() => setScreen("menu")} style={{ padding: sm ? "2px 6px" : "2px 8px", fontSize: sm ? 7 : 8, fontFamily: "'Courier New',monospace", background: "transparent", color: "#444", border: "1px solid #333", borderRadius: 5, cursor: "pointer", letterSpacing: 1 }}>✕</button>
  </div>

  {/* Roulette modal */}
  {rouletteOpen && (() => {
    const isBase = allInBase(tokens[cur] || []);
    const sections = getRouletteConfig(gameMode, isBase);
    const wheelSize = Math.min(winW * 0.7, 320);
    return (
      <div onClick={rouletteSpinning ? handleRouletteStop : undefined}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0, 1, 25, 0.94)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "'Courier New',monospace",
          cursor: rouletteSpinning ? "pointer" : "default",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Ghost color={cp.color} size={sm ? 20 : 28} glow={cp.glow} />
          <span style={{ color: cp.color, fontWeight: 900, fontSize: sm ? 14 : 18, letterSpacing: 3, textShadow: `0 0 10px ${cp.color}66` }}>{cp.name}</span>
        </div>
        {isBase && (
          <div style={{ fontSize: sm ? 9 : 11, color: "#aaa", marginBottom: 8, letterSpacing: 1 }}>
            SIN FANTASMAS EN JUEGO — ¡SACÁ UNO!
          </div>
        )}
        <RouletteWheel sections={sections} angle={rouletteAngle} size={wheelSize} spinning={rouletteSpinning} result={rouletteResult} />
        <div style={{
          marginTop: 16, fontSize: sm ? 12 : 15, fontWeight: 900, letterSpacing: 2,
          color: rouletteSpinning ? "#FFE000" : (rouletteResult === 0 ? "#ff4444" : "#00FF88"),
          textShadow: rouletteSpinning ? "0 0 10px #FFE00066" : "0 0 10px #00FF8866",
          animation: rouletteSpinning ? "gp .6s infinite alternate" : "none",
        }}>
          {rouletteSpinning ? "TOCÁ PARA FRENAR" : rouletteResult !== null ? (rouletteResult === 0 ? "¡NADA!" : `¡SACASTE ${rouletteResult}!`) : ""}
        </div>
        {gameMode !== "normal" && (consecutiveSixes[cur] || 0) > 0 && rouletteSpinning && (
          <div style={{ marginTop: 8, fontSize: sm ? 8 : 10, color: "#ff8800", letterSpacing: 1 }}>
            ⚠ RACHA DE 6: {consecutiveSixes[cur]}/3
          </div>
        )}
      </div>
    );
  })()}
</div>

);
}
