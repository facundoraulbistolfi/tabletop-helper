import { useState, useEffect, useMemo, useRef } from “react”;

const GRID = 15;
const PLAYERS = [
{ id: 0, name: “BLINKY”, color: “#FF0000”, glow: “#ff000088”, home: “#330000” },
{ id: 1, name: “INKY”,   color: “#00FFFF”, glow: “#00ffff88”, home: “#003333” },
{ id: 2, name: “CLYDE”,  color: “#FFB852”, glow: “#ffb85288”, home: “#332200” },
{ id: 3, name: “PINKY”,  color: “#FFB8FF”, glow: “#ffb8ff88”, home: “#330033” },
];

const PATH = [
[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],
[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],
];

const PCFG = [
{ startIdx:1,  homeStretch:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],   basePos:[[2,2],[2,3],[3,2],[3,3]],     safeIdx:1  },
{ startIdx:14, homeStretch:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],   basePos:[[2,11],[2,12],[3,11],[3,12]], safeIdx:14 },
{ startIdx:27, homeStretch:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],basePos:[[11,11],[11,12],[12,11],[12,12]],safeIdx:27},
{ startIdx:40, homeStretch:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],basePos:[[11,2],[11,3],[12,2],[12,3]], safeIdx:40 },
];

const SAFE = new Set([1, 14, 27, 40, 9, 22, 35, 48]);

// ── Pure helpers ──
function stepsFromStart(pid, pathIdx) {
return ((pathIdx - PCFG[pid].startIdx + 52) % 52) + 1;
}

function canTokenMove(tok, pid, dice) {
if (tok.state === “finished”) return false;
if (tok.state === “base”) return dice === 6;
if (tok.state === “path”) return stepsFromStart(pid, tok.pathIdx) + dice <= 57;
if (tok.state === “home”) return tok.homeIdx + dice <= 5;
return false;
}

function getTokenPos(tok, pid) {
if (tok.state === “base”) return PCFG[pid].basePos[tok.baseSlot];
if (tok.state === “path”) return PATH[tok.pathIdx];
if (tok.state === “home”) return PCFG[pid].homeStretch[tok.homeIdx];
return [7, 7];
}

function cloneTokens(t) {
const c = {};
for (const k in t) c[k] = t[k].map(tk => ({ …tk }));
return c;
}

// Returns { tokens, captured, finished }
function executeMove(allTokens, pid, tokId, dice, numPlayers) {
const nt = cloneTokens(allTokens);
const cfg = PCFG[pid];
const ti = nt[pid].findIndex(t => t.id === tokId);
const t = nt[pid][ti];
let captured = false;

if (t.state === “base” && dice === 6) {
t.state = “path”;
t.pathIdx = cfg.startIdx;
// Check capture at start pos
if (!SAFE.has(t.pathIdx)) {
for (let p = 0; p < numPlayers; p++) {
if (p === pid) continue;
nt[p].forEach(ot => {
if (ot.state === “path” && ot.pathIdx === t.pathIdx) {
ot.state = “base”;
ot.pathIdx = -1;
ot.homeIdx = -1;
captured = true;
}
});
}
}
} else if (t.state === “path”) {
const totalSteps = stepsFromStart(pid, t.pathIdx) + dice;
if (totalSteps <= 51) {
// Stay on main path
t.pathIdx = (cfg.startIdx + totalSteps - 1) % 52;
// Capture check
if (!SAFE.has(t.pathIdx)) {
for (let p = 0; p < numPlayers; p++) {
if (p === pid) continue;
nt[p].forEach(ot => {
if (ot.state === “path” && ot.pathIdx === t.pathIdx) {
ot.state = “base”;
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
t.state = “finished”;
t.homeIdx = 5;
} else {
t.state = “home”;
t.homeIdx = homeIdx;
}
}
} else if (t.state === “home”) {
t.homeIdx += dice;
if (t.homeIdx >= 5) {
t.homeIdx = 5;
t.state = “finished”;
}
}

const allFinished = nt[pid].every(tk => tk.state === “finished”);
return { tokens: nt, captured, finished: allFinished };
}

// ── Components ──
function useWindowSize() {
const [s, set] = useState({ w: window.innerWidth, h: window.innerHeight });
useEffect(() => {
const f = () => set({ w: window.innerWidth, h: window.innerHeight });
window.addEventListener(“resize”, f);
return () => window.removeEventListener(“resize”, f);
}, []);
return s;
}

function Ghost({ color, size, glow }) {
return (
<svg width={size} height={size} viewBox=“0 0 16 16” style={{ filter: glow ? `drop-shadow(0 0 4px ${glow})` : undefined, display: “block” }}>
<path d="M3 14 L3 6 Q3 2 8 2 Q13 2 13 6 L13 14 L11 12 L9.5 14 L8 12 L6.5 14 L5 12 Z" fill={color} />
<rect x="5" y="5" width="2.5" height="3" rx="1" fill="white" />
<rect x="8.5" y="5" width="2.5" height="3" rx="1" fill="white" />
<rect x="6" y="6" width="1.5" height="1.5" rx=".5" fill="#222" />
<rect x="9.5" y="6" width="1.5" height="1.5" rx=".5" fill="#222" />
</svg>
);
}

function PacMan({ size }) {
// Classic pac-man as a proper arc with clean wedge mouth
return (
<svg width={size} height={size} viewBox=“0 0 100 100” style={{ display: “block” }}>
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

function DiceWidget({ value, rolling, onClick, disabled, color, sz }) {
const dots = { 1: [[1,1]], 2: [[0,2],[2,0]], 3: [[0,2],[1,1],[2,0]], 4: [[0,0],[0,2],[2,0],[2,2]], 5: [[0,0],[0,2],[1,1],[2,0],[2,2]], 6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]] };
return (
<button onClick={onClick} disabled={disabled} style={{
width: sz, height: sz, background: disabled ? “#222” : “#111”,
border: `2px solid ${disabled ? "#333" : color}`, borderRadius: sz * 0.16,
cursor: disabled ? “default” : “pointer”, display: “grid”,
gridTemplateColumns: “repeat(3,1fr)”, gridTemplateRows: “repeat(3,1fr)”,
gap: 1, padding: sz * 0.12,
boxShadow: disabled ? “none” : `0 0 10px ${color}44`,
transition: “all .3s”, transform: rolling ? “rotate(720deg) scale(.8)” : “none”,
}}>
{Array.from({ length: 9 }).map((_, i) => {
const r = Math.floor(i / 3), c = i % 3;
const on = (dots[value] || []).some(([dr, dc]) => dr === r && dc === c);
return <div key={i} style={{ width: “100%”, height: “100%”, borderRadius: “50%”, background: on ? color : “transparent”, boxShadow: on ? `0 0 4px ${color}` : “none”, transition: “all .3s” }} />;
})}
</button>
);
}

function getCellType(r, c) {
if (r <= 5 && c <= 5) return { type: “base”, player: 0 };
if (r <= 5 && c >= 9) return { type: “base”, player: 1 };
if (r >= 9 && c >= 9) return { type: “base”, player: 2 };
if (r >= 9 && c <= 5) return { type: “base”, player: 3 };
if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return { type: “center” };
const pi = PATH.findIndex(([pr, pc]) => pr === r && pc === c);
if (pi !== -1) return { type: “path”, idx: pi };
for (let p = 0; p < 4; p++) {
const hi = PCFG[p].homeStretch.findIndex(([hr, hc]) => hr === r && hc === c);
if (hi !== -1) return { type: “home”, player: p, idx: hi };
}
return { type: “empty” };
}

function createTokens(n) {
const t = {};
for (let p = 0; p < n; p++) t[p] = [0, 1, 2, 3].map(i => ({ id: `${p}-${i}`, state: “base”, pathIdx: -1, homeIdx: -1, baseSlot: i }));
return t;
}

// ── Main App ──
export default function PacManLudo() {
const { w: winW, h: winH } = useWindowSize();
const [screen, setScreen] = useState(“menu”);
const [playerCount, setPlayerCount] = useState(2);
const [tokens, setTokens] = useState({});
const [cur, setCur] = useState(0);
const [dice, setDice] = useState(1);
const [rolling, setRolling] = useState(false);
const [phase, setPhase] = useState(“roll”); // “roll” | “pick” | “moving” | “wait”
const [msg, setMsg] = useState(””);
const [winner, setWinner] = useState(null);
const [menuDots, setMenuDots] = useState([]);
const [pac, setPac] = useState({ r: 7, c: 7, a: 0 });
const timeoutRef = useRef(null);

const CELL = useMemo(() => {
if (screen === “game”) {
const maxH = winH - (winW < 500 ? 100 : 110);
return Math.max(14, Math.min(44, Math.floor(Math.min(winW - 12, maxH) / GRID)));
}
return Math.max(16, Math.min(40, Math.floor(Math.min(winW - 40, winH * 0.45) / GRID)));
}, [winW, winH, screen]);
const BOARD = CELL * GRID;
const gs = Math.max(10, Math.round(CELL * 0.72));
const sm = winW < 500;

// Cleanup timeouts
useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

// Menu animation
useEffect(() => {
if (screen !== “menu”) return;
const d = [];
for (let i = 0; i < PATH.length; i += 2) d.push({ r: PATH[i][0], c: PATH[i][1], e: false });
setMenuDots(d);
let f = 0;
const iv = setInterval(() => {
f = (f + 1) % PATH.length;
const [r, c] = PATH[f];
const pr = f > 0 ? PATH[f - 1] : PATH[PATH.length - 1];
setPac({ r, c, a: Math.atan2(r - pr[0], c - pr[1]) * 180 / Math.PI });
setMenuDots(p => p.map(d => (d.r === r && d.c === c) ? { …d, e: true } : d));
}, 150);
const rs = setInterval(() => setMenuDots(p => p.map(d => ({ …d, e: false }))), 5000);
return () => { clearInterval(iv); clearInterval(rs); };
}, [screen]);

function startGame() {
setTokens(createTokens(playerCount));
setCur(0); setDice(1); setPhase(“roll”);
setMsg(`¡Turno de ${PLAYERS[0].name}! Tirá el dado`);
setWinner(null); setScreen(“game”);
}

function doNextTurn(fromPlayer) {
const next = (fromPlayer + 1) % playerCount;
setCur(next);
setPhase(“roll”);
setMsg(`¡Turno de ${PLAYERS[next].name}! Tirá el dado`);
}

function applyMove(tokId, playerId, diceVal, currentTokens) {
setPhase(“moving”);
const result = executeMove(currentTokens, playerId, tokId, diceVal, playerCount);
setTokens(result.tokens);

```
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
```

}

function handleRoll() {
if (phase !== “roll” || rolling) return;
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

```
    // Figure out movable tokens
    const movable = tokens[cur].filter(t => canTokenMove(t, cur, final));

    if (movable.length === 0) {
      if (final === 6) {
        setMsg(`${PLAYERS[cur].name} no puede mover, ¡pero sacó 6! Tira de nuevo`);
        setPhase("roll");
      } else {
        setMsg(`${PLAYERS[cur].name} no puede mover`);
        setPhase("wait");
        timeoutRef.current = setTimeout(() => doNextTurn(cur), 1000);
      }
    } else if (movable.length === 1) {
      setMsg(`Sacó ${final}, moviendo...`);
      timeoutRef.current = setTimeout(() => applyMove(movable[0].id, cur, final, tokens), 300);
    } else {
      setMsg(`Sacó ${final}. Tocá una ficha para mover`);
      setPhase("pick");
    }
  }
}, 80);
```

}

function handleTokenClick(tok, pid) {
if (pid !== cur || phase !== “pick”) return;
if (!canTokenMove(tok, pid, dice)) return;
applyMove(tok.id, pid, dice, tokens);
}

// ── Board rendering ──
function renderBoard() {
const cells = [];
const tEls = [];

```
for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
  const ct = getCellType(r, c);
  let bg = "transparent", border = "none", content = null, shadow = null;

  if (ct.type === "path") {
    bg = "#1a1a2e"; border = "1px solid #2a2a4a";
    if (SAFE.has(ct.idx)) {
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
  } else if (ct.type === "home" && ct.player < playerCount) {
    bg = PLAYERS[ct.player].home; border = `1px solid ${PLAYERS[ct.player].color}44`;
    content = <div style={{ width: Math.max(2, CELL * .1), height: Math.max(2, CELL * .1), borderRadius: "50%", background: PLAYERS[ct.player].color, opacity: .4 }} />;
  } else if (ct.type === "base" && ct.player < playerCount) {
    const bp = PCFG[ct.player].basePos;
    const isSlot = bp.some(([br, bc]) => br === r && bc === c);
    const cMin = ct.player === 0 || ct.player === 3 ? 1 : 10, cMax = cMin + 3;
    const rMin = ct.player < 2 ? 1 : 10, rMax = rMin + 3;
    const inner = r >= rMin && r <= rMax && c >= cMin && c <= cMax;
    bg = inner ? PLAYERS[ct.player].home : `${PLAYERS[ct.player].color}11`;
    border = inner ? `1px solid ${PLAYERS[ct.player].color}33` : "none";
    if (isSlot) { bg = "#0a0a15"; border = `2px solid ${PLAYERS[ct.player].color}55`; shadow = `inset 0 0 6px ${PLAYERS[ct.player].color}22`; }
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
const posMap = {};
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
      transform: isClickable ? "scale(1.3)" : "scale(1)",
      animation: isClickable ? "gp .8s infinite alternate" : "none",
      filter: isClickable ? `drop-shadow(0 0 6px ${PLAYERS[pid].color})` : undefined,
    }}><Ghost color={PLAYERS[pid].color} size={gs} glow={isClickable ? PLAYERS[pid].glow : undefined} /></div>);
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
```

}

const CSS = `@keyframes gp{from{filter:brightness(1)}to{filter:brightness(1.5)}} @keyframes fl{from{transform:translateY(0)}to{transform:translateY(-6px)}} *{box-sizing:border-box;margin:0;padding:0} html,body,#root{height:100%;overflow:hidden} ::-webkit-scrollbar{display:none}`;

// ═══ MENU ═══
if (screen === “menu”) {
return (
<div style={{ height: “100dvh”, background: “#000119”, display: “flex”, flexDirection: “column”, alignItems: “center”, justifyContent: “center”, fontFamily: “‘Courier New’,monospace”, color: “#FFE000”, padding: 16, overflow: “hidden”, position: “relative” }}>
<style>{CSS}</style>
<div style={{ position: “absolute”, inset: 0, overflow: “hidden”, opacity: .1 }}>
{menuDots.map((d, i) => !d.e && <div key={i} style={{ position: “absolute”, left: `${d.c / 15 * 100}%`, top: `${d.r / 15 * 100}%`, width: 4, height: 4, borderRadius: “50%”, background: “#FFE000” }} />)}
<div style={{ position: “absolute”, left: `${pac.c / 15 * 100}%`, top: `${pac.r / 15 * 100}%`, transform: `rotate(${pac.a}deg)`, transition: “all .15s linear” }}><PacMan size={18} /></div>
</div>
<div style={{ position: “relative”, zIndex: 1, textAlign: “center”, width: “100%”, maxWidth: 380 }}>
<div style={{ fontSize: sm ? 9 : 11, letterSpacing: 4, opacity: .6, marginBottom: 4 }}>── PRESENTA ──</div>
<h1 style={{ fontSize: sm ? 30 : 44, fontWeight: 900, margin: “0 0 4px”, textShadow: “0 0 20px #FFE000, 0 0 40px #FFE00066”, letterSpacing: 4 }}>PAC-LUDO</h1>
<div style={{ display: “flex”, gap: 6, justifyContent: “center”, marginBottom: sm ? 16 : 24 }}>
{PLAYERS.map(p => <Ghost key={p.id} color={p.color} size={sm ? 20 : 26} glow={p.glow} />)}
</div>
<div style={{ background: “#0a0a2a”, border: “2px solid #1a1a6a”, borderRadius: 12, padding: sm ? “14px” : “18px 24px”, marginBottom: 16 }}>
<div style={{ fontSize: sm ? 10 : 12, marginBottom: 10, letterSpacing: 2, color: “#aaa” }}>JUGADORES</div>
<div style={{ display: “flex”, gap: 8, justifyContent: “center” }}>
{[2, 3, 4].map(n => (
<button key={n} onClick={() => setPlayerCount(n)} style={{
width: sm ? 44 : 52, height: sm ? 44 : 52, fontSize: sm ? 17 : 21, fontWeight: 900,
fontFamily: “‘Courier New’,monospace”,
background: playerCount === n ? “#FFE000” : “#111133”, color: playerCount === n ? “#000” : “#666”,
border: `2px solid ${playerCount === n ? "#FFE000" : "#333366"}`, borderRadius: 10, cursor: “pointer”,
boxShadow: playerCount === n ? “0 0 14px #FFE00066” : “none”, transition: “all .2s”,
}}>{n}</button>
))}
</div>
<div style={{ display: “flex”, gap: 6, justifyContent: “center”, marginTop: 12, flexWrap: “wrap” }}>
{PLAYERS.slice(0, playerCount).map(p => (
<div key={p.id} style={{ display: “flex”, alignItems: “center”, gap: 4, padding: “3px 8px”, background: `${p.color}15`, border: `1px solid ${p.color}44`, borderRadius: 8 }}>
<Ghost color={p.color} size={12} /><span style={{ color: p.color, fontSize: sm ? 8 : 9, letterSpacing: 1, fontWeight: 700 }}>{p.name}</span>
</div>
))}
</div>
</div>
<button onClick={startGame} style={{
padding: sm ? “10px 32px” : “12px 40px”, fontSize: sm ? 14 : 16, fontWeight: 900,
fontFamily: “‘Courier New’,monospace”, background: “#FFE000”, color: “#000”, border: “none”,
borderRadius: 12, cursor: “pointer”, letterSpacing: 4, boxShadow: “0 0 20px #FFE00044”,
}}>▶ JUGAR</button>
<div style={{ marginTop: 12, fontSize: sm ? 8 : 9, color: “#555”, letterSpacing: 1, lineHeight: 1.6 }}>
SACÁ 6 PARA SACAR FICHAS · CAPTURÁ RIVALES · LLEGÁ AL CENTRO
</div>
</div>
</div>
);
}

// ═══ WIN ═══
if (screen === “win” && winner !== null) {
const w = PLAYERS[winner];
return (
<div style={{ height: “100dvh”, background: “#000119”, display: “flex”, flexDirection: “column”, alignItems: “center”, justifyContent: “center”, fontFamily: “‘Courier New’,monospace”, color: “#FFE000” }}>
<style>{CSS}</style>
<div style={{ animation: “fl 1s infinite alternate” }}><Ghost color={w.color} size={sm ? 56 : 80} glow={w.glow} /></div>
<h1 style={{ fontSize: sm ? 24 : 36, color: w.color, textShadow: `0 0 30px ${w.color}`, margin: “14px 0 6px”, letterSpacing: 4 }}>¡{w.name} GANA!</h1>
<div style={{ fontSize: 13, color: “#888”, marginBottom: 20 }}>GAME OVER</div>
<button onClick={() => setScreen(“menu”)} style={{ padding: “8px 28px”, fontSize: 13, fontFamily: “‘Courier New’,monospace”, background: “transparent”, color: “#FFE000”, border: “2px solid #FFE000”, borderRadius: 10, cursor: “pointer”, letterSpacing: 3 }}>MENÚ</button>
</div>
);
}

// ═══ GAME ═══
const cp = PLAYERS[cur];
const finCount = (tokens[cur] || []).filter(t => t.state === “finished”).length;
const dsz = sm ? 44 : 54;

return (
<div style={{ height: “100dvh”, background: “#000119”, fontFamily: “‘Courier New’,monospace”, color: “#fff”, display: “flex”, flexDirection: “column”, alignItems: “center”, padding: sm ? “4px 2px” : “8px 4px”, overflow: “hidden” }}>
<style>{CSS}</style>

```
  {/* Top bar */}
  <div style={{ display: "flex", alignItems: "center", gap: sm ? 6 : 12, marginBottom: sm ? 2 : 6, width: "100%", maxWidth: BOARD, justifyContent: "center" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: sm ? "3px 8px" : "4px 12px", background: `${cp.color}15`, border: `2px solid ${cp.color}44`, borderRadius: 8 }}>
      <Ghost color={cp.color} size={sm ? 14 : 18} glow={cp.glow} />
      <span style={{ color: cp.color, fontWeight: 900, fontSize: sm ? 10 : 12, letterSpacing: 2, textShadow: `0 0 8px ${cp.color}66` }}>{cp.name}</span>
    </div>
    <DiceWidget value={dice} rolling={rolling} onClick={handleRoll} disabled={phase !== "roll" || rolling} color={cp.color} sz={dsz} />
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
    <button onClick={() => setScreen("menu")} style={{ padding: sm ? "2px 6px" : "2px 8px", fontSize: sm ? 7 : 8, fontFamily: "'Courier New',monospace", background: "transparent", color: "#444", border: "1px solid #333", borderRadius: 5, cursor: "pointer", letterSpacing: 1 }}>✕</button>
  </div>
</div>
```

);
}
