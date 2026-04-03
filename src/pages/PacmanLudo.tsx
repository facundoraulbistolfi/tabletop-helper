import { useEffect, useMemo, useRef, useState } from "react";

import { getFacingBetween, getTokenFacing, getTokenPos, GRID, PATH } from "../lib/pac-ludo/board";
import { CENTER_PAC_CHARACTER_ID, CHARACTER_SETS, CHARACTERS_BY_ID } from "../lib/pac-ludo/characters";
import {
  allInBase,
  canTokenMove,
  createTokens,
  executeMove,
  getCombatRouletteConfig,
  getRouletteConfig,
  isSweating,
  resolveCombat,
  resolveRouletteSelection,
} from "../lib/pac-ludo/game";
import {
  buildRuntimePlayers,
  createPreviewDirections,
  createDefaultSetupSlots,
  isCharacterTaken,
  normalizeActiveSetupSlots,
  resetPreviewDirection,
  shouldShowCenterCharacter,
  updateSetupCharacter,
  updatePreviewDirection,
  updateSetupName,
} from "../lib/pac-ludo/setup";
import type { FacingDirection, GameMode, RouletteSection, Token, TokenMap } from "../lib/pac-ludo/types";
import { BoardGrid, getBoardSize } from "./pacman-ludo/BoardGrid";
import { PixelSprite } from "./pacman-ludo/PixelSprite";

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function getTextColorForHex(hex: string) {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((chunk) => `${chunk}${chunk}`).join("")
    : normalized;

  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance > 0.58 ? "#090d17" : "#f8f5ea";
}

function blendHex(hex: string, targetHex: string, amount: number) {
  const normalize = (value: string) => {
    const raw = value.replace("#", "");
    return raw.length === 3 ? raw.split("").map((chunk) => `${chunk}${chunk}`).join("") : raw;
  };

  const source = normalize(hex);
  const target = normalize(targetHex);
  const mix = (start: number, end: number) => Math.round(start + (end - start) * amount);

  const red = mix(Number.parseInt(source.slice(0, 2), 16), Number.parseInt(target.slice(0, 2), 16));
  const green = mix(Number.parseInt(source.slice(2, 4), 16), Number.parseInt(target.slice(2, 4), 16));
  const blue = mix(Number.parseInt(source.slice(4, 6), 16), Number.parseInt(target.slice(4, 6), 16));

  return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
}

function createPlayerRoulettePalette(color: string) {
  const palette: Record<number, string> = {
    1: blendHex(color, "#ffffff", 0.54),
    2: blendHex(color, "#ffffff", 0.34),
    3: blendHex(color, "#ffffff", 0.14),
    4: blendHex(color, "#000000", 0.08),
    5: blendHex(color, "#000000", 0.22),
    6: blendHex(color, "#000000", 0.38),
  };

  return palette;
}

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

function DiceWidget({
  value,
  rolling,
  onClick,
  disabled,
  color,
  size,
}: {
  value: number;
  rolling: boolean;
  onClick: () => void;
  disabled: boolean;
  color: string;
  size: number;
}) {
  const dots: Record<number, number[][]> = {
    1: [[1, 1]],
    2: [[0, 2], [2, 0]],
    3: [[0, 2], [1, 1], [2, 0]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        background: disabled ? "#222" : "#111",
        border: `2px solid ${disabled ? "#333" : color}`,
        borderRadius: size * 0.16,
        cursor: disabled ? "default" : "pointer",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 1,
        padding: size * 0.12,
        boxShadow: disabled ? "none" : `0 0 10px ${color}44`,
        transition: "all .3s",
        transform: rolling ? "rotate(720deg) scale(.84)" : "none",
      }}
    >
      {Array.from({ length: 9 }).map((_, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const isOn = (dots[value] || []).some(([dr, dc]) => dr === row && dc === col);
        return (
          <div
            key={index}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: isOn ? color : "transparent",
              boxShadow: isOn ? `0 0 4px ${color}` : "none",
              transition: "all .3s",
            }}
          />
        );
      })}
    </button>
  );
}

function RouletteWheel({
  sections,
  angle,
  size,
  spinning,
  result,
}: {
  sections: RouletteSection[];
  angle: number;
  size: number;
  spinning: boolean;
  result: number | null;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const pointerOffset = Math.max(24, size * 0.1);
  const radius = size / 2 - 8;
  const totalWeight = sections.reduce((sum, section) => sum + section.weight, 0);
  const resultLabel = result !== null
    ? sections.find((section) => section.value === result)?.label ?? (result === 0 ? "✕" : String(result))
    : null;
  let cumulativeAngle = 0;

  return (
    <svg width={size} height={size + pointerOffset} viewBox={`0 0 ${size} ${size + pointerOffset}`} style={{ display: "block" }}>
      <polygon
        points={`${cx - size * 0.052},6 ${cx + size * 0.052},6 ${cx},${pointerOffset - 4}`}
        fill="#FFE27A"
        stroke="#0c101b"
        strokeWidth={2}
      />
      <g transform={`rotate(${angle}, ${cx}, ${cy + pointerOffset})`} style={{ transition: spinning ? "none" : "transform 0.1s" }}>
        <g transform={`translate(0, ${pointerOffset})`}>
          <circle cx={cx} cy={cy} r={radius + 5} fill="#070b18" stroke="#FFE27A33" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={radius} fill="#0c1328" stroke="#10192d" strokeWidth={3} />
          {sections.map((section, index) => {
            const sliceAngle = (section.weight / totalWeight) * 360;
            const startAngle = cumulativeAngle;
            const endAngle = cumulativeAngle + sliceAngle;
            cumulativeAngle = endAngle;
            const middle = (startAngle + endAngle) / 2;
            const labelPos = polarToCartesian(cx, cy, radius * 0.67, middle);
            const isIconLabel = /[^\d]/.test(section.label);
            const fontSize = isIconLabel ? Math.max(14, size * 0.085) : Math.max(12, size * 0.068);
            const labelColor = section.label === "✕" ? "#f6e9df" : getTextColorForHex(section.color);
            const shadow = labelColor === "#090d17" ? "0 1px 0 rgba(255,255,255,0.18)" : "0 2px 0 rgba(0,0,0,0.35)";

            return (
              <g key={index}>
                <path d={describeArc(cx, cy, radius, startAngle, endAngle)} fill={section.color} stroke="#0a0f1d" strokeWidth={2.5} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={labelColor}
                  fontWeight="900"
                  fontSize={fontSize}
                  fontFamily={PIXEL_FONT}
                  style={{ textShadow: shadow, pointerEvents: "none" }}
                >
                  {section.label}
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={Math.max(12, radius * 0.13)} fill="#0a0f1d" stroke="#FFE27A" strokeWidth={3} />
        </g>
      </g>
      {resultLabel !== null && (
        <text
          x={cx}
          y={cy + pointerOffset}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#FFE27A"
          fontSize={/[^\d]/.test(resultLabel) ? Math.max(18, size * 0.09) : Math.max(16, size * 0.075)}
          fontWeight="900"
          fontFamily={PIXEL_FONT}
          style={{ textShadow: "0 0 14px rgba(255, 226, 122, 0.25)", pointerEvents: "none" }}
        >
          {resultLabel}
        </text>
      )}
    </svg>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @keyframes pacLudoPick { from { filter: brightness(1); } to { filter: brightness(1.45); } }
  @keyframes pacLudoFloat { from { transform: translateY(0); } to { transform: translateY(-6px); } }
  @keyframes pacLudoDrop { 0% { transform: translateY(0); opacity: .85; } 50% { transform: translateY(5px); opacity: .35; } 100% { transform: translateY(0); opacity: .85; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  ::-webkit-scrollbar { width: 0; height: 0; }
`;

const ROULETTE_DURATION_MS = 5000;
const ROULETTE_DEGREES_PER_MS = 0.42;
const ROULETTE_STOP_GUARD_MS = 250;
const PIXEL_FONT = "'Press Start 2P', monospace";
const ROULETTE_DURATION_SECONDS_LABEL = String(ROULETTE_DURATION_MS / 1000);
type RollKind = "number" | "entry";
type RoulettePurpose = RollKind | "battle";

export default function PacmanLudo() {
  const { width: winWidth, height: winHeight } = useWindowSize();
  const isMobile = winWidth < 560;

  const [screen, setScreen] = useState<"menu" | "game" | "win">("menu");
  const [playerCount, setPlayerCount] = useState(2);
  const [gameMode, setGameMode] = useState<GameMode>("normal");
  const [setupSlots, setSetupSlots] = useState(createDefaultSetupSlots);
  const [previewDirections, setPreviewDirections] = useState(() => createPreviewDirections(4));
  const [tokens, setTokens] = useState<TokenMap>({});
  const [cur, setCur] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [phase, setPhase] = useState<"roll" | "pick" | "moving" | "wait" | "battle">("roll");
  const [msg, setMsg] = useState("");
  const [winner, setWinner] = useState<number | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [consecutiveSixes, setConsecutiveSixes] = useState<Record<number, number>>({});
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [roulettePurpose, setRoulettePurpose] = useState<RoulettePurpose | null>(null);
  const [rouletteAngle, setRouletteAngle] = useState(0);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<number | null>(null);
  const [rouletteElapsedMs, setRouletteElapsedMs] = useState(0);
  const [selectedRollKind, setSelectedRollKind] = useState<RollKind | null>(null);
  const [pendingBattle, setPendingBattle] = useState<{
    playerId: number;
    diceValue: number;
    rollKind: RollKind;
    tokens: TokenMap;
    contestedTokenIds: string[];
    finished: boolean;
  } | null>(null);
  const [movingToken, setMovingToken] = useState<{ id: string; row: number; col: number; facing: FacingDirection } | null>(null);
  const [menuDots, setMenuDots] = useState<{ row: number; col: number; eaten: boolean }[]>([]);
  const [menuPac, setMenuPac] = useState<{ row: number; col: number; facing: FacingDirection }>({ row: 7, col: 7, facing: "right" });

  const rouletteRafRef = useRef<number | null>(null);
  const rouletteAngleRef = useRef(0);
  const rouletteOpenedAtRef = useRef(0);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const players = useMemo(() => buildRuntimePlayers(setupSlots, playerCount), [setupSlots, playerCount]);
  const menuPacCharacter = CHARACTERS_BY_ID[CENTER_PAC_CHARACTER_ID];
  const stackRosterCards = winWidth < 860;
  const stackRosterCardContent = winWidth < 430;
  const compactGameHud = isMobile || winWidth < 420;

  const cellSize = useMemo(() => {
    if (screen === "game") {
      const reserved = isMobile ? 150 : 170;
      const maxHeight = winHeight - reserved;
      return Math.max(14, Math.min(44, Math.floor(Math.min(winWidth - 12, maxHeight) / GRID)));
    }
    return Math.max(16, Math.min(36, Math.floor(Math.min(winWidth - 48, winHeight * 0.32) / GRID)));
  }, [screen, isMobile, winHeight, winWidth]);

  const boardSize = getBoardSize(cellSize);
  const tokenSize = Math.max(14, Math.round(cellSize * 0.82));
  const diceSize = isMobile ? 48 : 56;
  const rouletteChromeReserve = isMobile ? 280 : 250;
  const rouletteWheelSize = Math.max(
    isMobile ? 210 : 320,
    Math.min(winWidth - (isMobile ? 28 : 80), winHeight - rouletteChromeReserve, isMobile ? 380 : 540),
  );
  const currentPlayer = players[cur] ?? players[0];
  const currentPlayerTokens = tokens[cur] || [];
  const currentAllInBase = allInBase(currentPlayerTokens);
  const rouletteSections = useMemo(() => {
    if (gameMode === "normal" || !roulettePurpose) return [];
    if (roulettePurpose === "battle") return getCombatRouletteConfig(gameMode);
    const baseSections = getRouletteConfig(gameMode, roulettePurpose === "entry");
    if (roulettePurpose !== "number" || !currentPlayer) return baseSections;

    const playerPalette = createPlayerRoulettePalette(currentPlayer.color);
    return baseSections.map((section) => ({
      ...section,
      color: playerPalette[section.value] ?? section.color,
    }));
  }, [currentPlayer, gameMode, roulettePurpose]);
  const rouletteRemainingSeconds = Math.max(0, (ROULETTE_DURATION_MS - rouletteElapsedMs) / 1000);
  const rouletteCountdownLabel = rouletteSpinning ? rouletteRemainingSeconds.toFixed(1) : "0.0";
  const rouletteProgress = Math.max(0, Math.min(1, rouletteElapsedMs / ROULETTE_DURATION_MS));
  const currentFinishedCount = currentPlayer ? (tokens[cur] || []).filter((token) => token.state === "finished").length : 0;
  const showCenterCharacter = useMemo(
    () => shouldShowCenterCharacter(players.map((player) => player.id)),
    [players],
  );

  const movableTokens = useMemo(
    () => (tokens[cur] || []).filter((token) => canTokenMove(token, cur, dice)),
    [tokens, cur, dice],
  );

  function clearTransitionTimeout() {
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = null;
  }

  function clearMoveTimeout() {
    if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
    moveTimeoutRef.current = null;
  }

  function clearRollInterval() {
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    rollIntervalRef.current = null;
  }

  function clearRouletteAnimation() {
    if (rouletteRafRef.current !== null) {
      cancelAnimationFrame(rouletteRafRef.current);
      rouletteRafRef.current = null;
    }
  }

  function clearTransientState() {
    clearTransitionTimeout();
    clearMoveTimeout();
    clearRollInterval();
    clearRouletteAnimation();
    setMovingToken(null);
  }

  function applyRouletteAngle(nextAngle: number) {
    rouletteAngleRef.current = nextAngle;
    setRouletteAngle(nextAngle);
  }

  useEffect(() => () => clearTransientState(), []);

  useEffect(() => {
    setSetupSlots((prev) => normalizeActiveSetupSlots(prev, playerCount));
  }, [playerCount]);

  useEffect(() => {
    if (screen !== "menu") return;

    const dots = [];
    for (let index = 0; index < PATH.length; index += 2) {
      dots.push({ row: PATH[index].row, col: PATH[index].col, eaten: false });
    }
    setMenuDots(dots);

    let frame = 0;
    const moveInterval = setInterval(() => {
      frame = (frame + 1) % PATH.length;
      const current = PATH[frame];
      const previous = PATH[(frame - 1 + PATH.length) % PATH.length];
      setMenuPac({ row: current.row, col: current.col, facing: getFacingBetween(previous, current) });
      setMenuDots((prev) => prev.map((dot) => (dot.row === current.row && dot.col === current.col ? { ...dot, eaten: true } : dot)));
    }, 150);
    const resetDots = setInterval(() => setMenuDots((prev) => prev.map((dot) => ({ ...dot, eaten: false }))), 5000);

    return () => {
      clearInterval(moveInterval);
      clearInterval(resetDots);
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "game") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (rouletteOpen && rouletteSpinning) {
          handleRouletteStop();
          return;
        }
        if (phase === "roll" && !rolling && !rouletteOpen) {
          if (gameMode === "normal") handleRoll();
          else handleRouletteOpen();
        }
      }

      const picked = Number.parseInt(event.key, 10);
      if (phase === "pick" && picked >= 1 && picked <= movableTokens.length) {
        const token = movableTokens[picked - 1];
        if (token && canTokenMove(token, cur, dice)) {
          animateMove(token.id, cur, dice, selectedRollKind ?? "number", tokens);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, rouletteOpen, rouletteSpinning, phase, rolling, gameMode, movableTokens, cur, dice, tokens]);

  useEffect(() => {
    if (!autoPlay || screen !== "game" || phase !== "roll" || rolling || rouletteOpen) return;
    const timeout = setTimeout(() => {
      if (gameMode === "normal") handleRoll();
      else handleRouletteOpen();
    }, 600);
    return () => clearTimeout(timeout);
  }, [autoPlay, screen, phase, rolling, rouletteOpen, gameMode]);

  useEffect(() => {
    if (!autoPlay || !rouletteOpen || !rouletteSpinning) return;
    const timeout = setTimeout(handleRouletteStop, 1500 + Math.random() * 2500);
    return () => clearTimeout(timeout);
  }, [autoPlay, rouletteOpen, rouletteSpinning]);

  function queueTransition(callback: () => void, delay: number) {
    clearTransitionTimeout();
    transitionTimeoutRef.current = setTimeout(callback, delay);
  }

  function goToMenu() {
    clearTransientState();
    setRouletteOpen(false);
    setRoulettePurpose(null);
    setRouletteSpinning(false);
    setRouletteResult(null);
    setRouletteElapsedMs(0);
    setSelectedRollKind(null);
    setPendingBattle(null);
    setRolling(false);
    setScreen("menu");
  }

  function startGame() {
    clearTransientState();
    const freshTokens = createTokens(playerCount);
    setTokens(freshTokens);
    setCur(0);
    setDice(1);
    setRolling(false);
    setPhase("roll");
    setWinner(null);
    setScreen("game");
    setRouletteOpen(false);
    setRoulettePurpose(null);
    setRouletteSpinning(false);
    setRouletteResult(null);
    setRouletteElapsedMs(0);
    setSelectedRollKind(null);
    setPendingBattle(null);
    setMsg(`¡Turno de ${players[0].displayName}! ${gameMode === "normal" ? "Tirá el dado" : "Girá la ruleta"}`);
    setConsecutiveSixes(Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [index, 0])));
  }

  function doNextTurn(fromPlayer: number) {
    const nextPlayer = (fromPlayer + 1) % playerCount;
    setCur(nextPlayer);
    setPhase("roll");
    setSelectedRollKind(null);
    setPendingBattle(null);
    setMsg(`¡Turno de ${players[nextPlayer].displayName}! ${gameMode === "normal" ? "Tirá el dado" : "Girá la ruleta"}`);
    setConsecutiveSixes((prev) => ({ ...prev, [fromPlayer]: 0 }));
  }

  function finishMove(playerId: number, diceValue: number, rollKind: RollKind, nextTokens: TokenMap, captured: boolean, finished: boolean) {
    setMovingToken(null);
    setSelectedRollKind(null);
    setTokens(nextTokens);

    if (finished) {
      setWinner(playerId);
      setScreen("win");
      return;
    }

    const actor = players[playerId];
    if (captured) {
      setMsg(`¡${actor.displayName} mandó a base a un rival! 👾 Tirás de nuevo`);
      queueTransition(() => setPhase("roll"), 420);
      return;
    }

    if (rollKind === "number" && diceValue === 6) {
      setMsg(`¡${actor.displayName} sacó 6, vuelve a tirar!`);
      queueTransition(() => setPhase("roll"), 360);
      return;
    }

    queueTransition(() => doNextTurn(playerId), 520);
  }

  function openRoulette(purpose: RoulettePurpose) {
    setRoulettePurpose(purpose);
    setRouletteOpen(true);
    setRouletteSpinning(true);
    setRouletteResult(null);
    setRouletteElapsedMs(0);
    const startedAt = performance.now();
    rouletteOpenedAtRef.current = startedAt;
    const startAngle = rouletteAngleRef.current;

    const spin = (now: number) => {
      const elapsed = now - startedAt;
      setRouletteElapsedMs(Math.min(elapsed, ROULETTE_DURATION_MS));
      const angle = startAngle + elapsed * ROULETTE_DEGREES_PER_MS;
      applyRouletteAngle(angle);

      if (elapsed >= ROULETTE_DURATION_MS) {
        finishRoulette(angle);
        return;
      }

      rouletteRafRef.current = requestAnimationFrame(spin);
    };

    rouletteRafRef.current = requestAnimationFrame(spin);
  }

  function animateMove(tokenId: string, playerId: number, diceValue: number, rollKind: RollKind, currentTokens: TokenMap) {
    clearTransitionTimeout();
    clearMoveTimeout();
    setPhase("moving");
    const result = executeMove(currentTokens, playerId, tokenId, diceValue, playerCount, { autoCapture: gameMode === "normal" });
    const segments = result.segments;

    if (segments.length === 0) {
      finishMove(playerId, diceValue, rollKind, result.tokens, result.captured, result.finished);
      return;
    }

    let stepIndex = 0;
    const stepDuration = Math.max(110, 170 - Math.min(diceValue, 6) * 8);

    const advance = () => {
      const segment = segments[stepIndex];
      setMovingToken({ id: tokenId, row: segment.row, col: segment.col, facing: segment.facing });
      stepIndex += 1;

      if (stepIndex < segments.length) {
        moveTimeoutRef.current = setTimeout(advance, stepDuration);
      } else {
        moveTimeoutRef.current = setTimeout(
          () => {
            if (result.contestedTokenIds.length > 0) {
              setMovingToken(null);
              setTokens(result.tokens);
              setPendingBattle({
                playerId,
                diceValue,
                rollKind,
                tokens: result.tokens,
                contestedTokenIds: result.contestedTokenIds,
                finished: result.finished,
              });
              setPhase("battle");
              setMsg(`¡${players[playerId].displayName} cayó sobre un rival! Girá la ruleta de ataque`);
              openRoulette("battle");
              return;
            }

            finishMove(playerId, diceValue, rollKind, result.tokens, result.captured, result.finished);
          },
          stepDuration,
        );
      }
    };

    advance();
  }

  function processRollResult(finalValue: number, rollKind: RollKind) {
    setSelectedRollKind(null);
    const moveValue = rollKind === "entry" && finalValue > 0 ? 6 : finalValue;

    if (finalValue === 0) {
      if (gameMode !== "normal") {
        setConsecutiveSixes((prev) => ({ ...prev, [cur]: 0 }));
      }
      setMsg(`${currentPlayer.displayName} no sacó personaje... pierde turno`);
      setPhase("wait");
      queueTransition(() => doNextTurn(cur), 1000);
      return;
    }

    if (gameMode !== "normal" && rollKind === "number" && finalValue === 6) {
      const nextCount = (consecutiveSixes[cur] || 0) + 1;
      setConsecutiveSixes((prev) => ({ ...prev, [cur]: nextCount }));
      if (nextCount >= 3) {
        setConsecutiveSixes((prev) => ({ ...prev, [cur]: 0 }));
        setMsg(`¡${currentPlayer.displayName} clavó triple 6! Pierde el turno`);
        setPhase("wait");
        queueTransition(() => doNextTurn(cur), 1400);
        return;
      }
    } else if (gameMode !== "normal") {
      setConsecutiveSixes((prev) => ({ ...prev, [cur]: 0 }));
    }

    const candidates = (tokens[cur] || []).filter((token) => canTokenMove(token, cur, moveValue));
    if (candidates.length === 0) {
      if (rollKind === "number" && finalValue === 6) {
        setMsg(`${currentPlayer.displayName} no puede mover, pero sacó 6. Va de nuevo`);
        setPhase("roll");
      } else {
        setMsg(`${currentPlayer.displayName} no puede mover`);
        setPhase("wait");
        queueTransition(() => doNextTurn(cur), 1000);
      }
      return;
    }

    if (candidates.length === 1) {
      const rollLabel = rollKind === "entry" ? "Salió fantasma" : `Sacó ${finalValue}`;
      setMsg(`${rollLabel}, moviendo...`);
      queueTransition(() => animateMove(candidates[0].id, cur, moveValue, rollKind, tokens), 280);
      return;
    }

    setSelectedRollKind(rollKind);
    const rollLabel = rollKind === "entry" ? "Salió fantasma" : `Sacó ${finalValue}`;
    setMsg(`${rollLabel}. Elegí cuál ficha mover${!isMobile ? ` (${candidates.map((_, index) => index + 1).join(", ")})` : ""}`);
    setPhase("pick");
  }

  function handleRoll() {
    if (phase !== "roll" || rolling) return;
    clearRollInterval();
    setRolling(true);
    let count = 0;
    rollIntervalRef.current = setInterval(() => {
      setDice(Math.floor(Math.random() * 6) + 1);
      count += 1;
      if (count > 8) {
        clearRollInterval();
        const finalValue = Math.floor(Math.random() * 6) + 1;
        setDice(finalValue);
        setRolling(false);
        processRollResult(finalValue, "number");
      }
    }, 80);
  }

  function finishRoulette(currentAngle: number) {
    clearRouletteAnimation();
    const purpose = roulettePurpose;
    const selection = resolveRouletteSelection(currentAngle, rouletteSections);
    setRouletteResult(selection.value);
    if (purpose !== "battle") {
      setDice(purpose === "entry" ? (selection.value > 0 ? 6 : 0) : selection.value || 1);
    }
    setRouletteSpinning(false);
    setRouletteElapsedMs(ROULETTE_DURATION_MS);
    queueTransition(() => {
      setRouletteOpen(false);
      setRouletteResult(null);
      setRoulettePurpose(null);
      setRouletteElapsedMs(0);

      if (purpose === "battle") {
        const battle = pendingBattle;
        setPendingBattle(null);
        if (!battle) return;

        const battleWon = selection.value > 0;
        const resolvedTokens = battleWon ? resolveCombat(battle.tokens, battle.contestedTokenIds) : battle.tokens;
        finishMove(battle.playerId, battle.diceValue, battle.rollKind, resolvedTokens, battleWon, battle.finished);
        return;
      }

      if (purpose === "entry" || purpose === "number") {
        processRollResult(selection.value, purpose);
      }
    }, 1200);
  }

  function handleRouletteOpen(event?: { stopPropagation?: () => void }) {
    event?.stopPropagation?.();
    if (phase !== "roll" || rouletteSpinning || rouletteOpen) return;
    openRoulette(currentAllInBase ? "entry" : "number");
  }

  function handleRouletteStop() {
    if (!rouletteSpinning) return;
    if (performance.now() - rouletteOpenedAtRef.current < ROULETTE_STOP_GUARD_MS) return;
    finishRoulette(rouletteAngleRef.current);
  }

  function handleTokenClick(token: Token, playerId: number) {
    if (playerId !== cur || phase !== "pick") return;
    if (!canTokenMove(token, playerId, dice)) return;
    const rollKind = selectedRollKind ?? "number";
    setSelectedRollKind(null);
    animateMove(token.id, playerId, dice, rollKind, tokens);
  }

  const renderedTokenGroups = useMemo(() => {
    const positionMap: Record<string, { token: Token; playerId: number; row: number; col: number; facing: FacingDirection }[]> = {};

    for (let playerId = 0; playerId < playerCount; playerId += 1) {
      (tokens[playerId] || []).forEach((token) => {
        if (token.state === "finished") return;

        const moving = movingToken?.id === token.id;
        const pos = moving ? { row: movingToken.row, col: movingToken.col } : getTokenPos(token, playerId);
        const facing = moving ? movingToken.facing : getTokenFacing(token, playerId);
        const key = `${pos.row}-${pos.col}`;
        if (!positionMap[key]) positionMap[key] = [];
        positionMap[key].push({ token, playerId, row: pos.row, col: pos.col, facing });
      });
    }

    return positionMap;
  }, [tokens, playerCount, movingToken]);

  const activeSeatIds = new Set(players.map((player) => player.seatId));

  if (screen === "menu") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#000119",
          fontFamily: PIXEL_FONT,
          color: "#FFE000",
          padding: isMobile ? 14 : 18,
          overflowY: "auto",
          position: "relative",
        }}
      >
        <style>{CSS}</style>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.12, pointerEvents: "none" }}>
          {menuDots.map((dot, index) => (
            !dot.eaten && (
              <div
                key={index}
                style={{
                  position: "absolute",
                  left: `${(dot.col / GRID) * 100}%`,
                  top: `${(dot.row / GRID) * 100}%`,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#FFE000",
                }}
              />
            )
          ))}
          <div
            style={{
              position: "absolute",
              left: `${(menuPac.col / GRID) * 100}%`,
              top: `${(menuPac.row / GRID) * 100}%`,
              transform: "translate(-50%, -50%)",
              transition: "all .15s linear",
            }}
          >
            <PixelSprite character={menuPacCharacter} direction={menuPac.facing} size={20} />
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 920, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: isMobile ? 9 : 11, letterSpacing: 4, opacity: 0.6, marginBottom: 6 }}>── PRESENTA ──</div>
            <h1
              style={{
                fontSize: isMobile ? 30 : 44,
                fontWeight: 900,
                textShadow: "0 0 20px #FFE000, 0 0 40px #FFE00066",
                letterSpacing: 4,
                marginBottom: 10,
              }}
            >
              PAC-LUDO
            </h1>
            <div style={{ color: "#8d95c6", fontSize: isMobile ? 10 : 12, lineHeight: 1.6, maxWidth: 620, margin: "0 auto" }}>
              Elegí la cantidad de jugadores, definí el roster por asiento y salí al tablero con sprites retro que miran hacia su próximo paso.
            </div>
          </div>

          <div
            style={{
              background: "#0a0a2a",
              border: "2px solid #1a1a6a",
              borderRadius: 16,
              padding: isMobile ? 14 : 20,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: isMobile ? 10 : 12, marginBottom: 10, letterSpacing: 2, color: "#aaa" }}>JUGADORES</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
              {[2, 3, 4].map((count) => (
                <button
                  key={count}
                  onClick={() => setPlayerCount(count)}
                  style={{
                    width: isMobile ? 46 : 54,
                    height: isMobile ? 46 : 54,
                    fontSize: isMobile ? 18 : 22,
                    fontWeight: 900,
                    fontFamily: PIXEL_FONT,
                    background: playerCount === count ? "#FFE000" : "#111133",
                    color: playerCount === count ? "#000" : "#666",
                    border: `2px solid ${playerCount === count ? "#FFE000" : "#333366"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    boxShadow: playerCount === count ? "0 0 14px #FFE00066" : "none",
                    transition: "all .2s",
                  }}
                >
                  {count}
                </button>
              ))}
            </div>

            <div style={{ fontSize: isMobile ? 10 : 12, marginBottom: 10, letterSpacing: 2, color: "#aaa" }}>MODO DE JUEGO</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {([
                { mode: "normal" as GameMode, label: "NORMAL", sub: "Dado clásico" },
                { mode: "divertido" as GameMode, label: "RULETA 🎡", sub: "Caos amable" },
                { mode: "hardcore" as GameMode, label: "RULETA 💀", sub: "Tenso pero justo" },
              ]).map(({ mode, label, sub }) => (
                <button
                  key={mode}
                  onClick={() => setGameMode(mode)}
                  style={{
                    padding: isMobile ? "7px 10px" : "9px 16px",
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: 900,
                    fontFamily: PIXEL_FONT,
                    background: gameMode === mode ? "#FFE000" : "#111133",
                    color: gameMode === mode ? "#000" : "#666",
                    border: `2px solid ${gameMode === mode ? "#FFE000" : "#333366"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    boxShadow: gameMode === mode ? "0 0 14px #FFE00066" : "none",
                    transition: "all .2s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    minWidth: isMobile ? 90 : 118,
                  }}
                >
                  <span>{label}</span>
                  <span style={{ fontSize: isMobile ? 7 : 8, fontWeight: 400, opacity: 0.7 }}>{sub}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12, fontSize: isMobile ? 8 : 10, color: "#666", letterSpacing: 1, textAlign: "center", lineHeight: 1.6 }}>
              {gameMode === "normal" && "SACÁ 6 PARA SALIR · CAPTURÁ RIVALES · LLEGÁ AL CENTRO"}
              {gameMode === "divertido" && "GIRÁ LA RULETA · FRENALA VOS · TRIPLE 6 = PIERDE TURNO"}
              {gameMode === "hardcore" && "SIGUE PICANTE · EL 6 ES RARO PERO YA NO IMPOSIBLE · TRIPLE 6 = PIERDE TURNO"}
            </div>
          </div>

          <div
            style={{
              background: "#0a0a2a",
              border: "2px solid #1a1a6a",
              borderRadius: 16,
              padding: isMobile ? 14 : 20,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: isMobile ? 10 : 12, marginBottom: 12, letterSpacing: 2, color: "#aaa" }}>ROSTER POR JUGADOR</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${stackRosterCards ? 1 : 2}, minmax(0, 1fr))`,
                gap: 12,
              }}
            >
              {setupSlots.slice(0, playerCount).map((slot, index) => {
                const character = CHARACTERS_BY_ID[slot.characterId];
                const previewDirection = previewDirections[index] ?? "right";
                return (
                  <div
                    key={`setup-${index}`}
                    style={{
                      background: `linear-gradient(160deg, ${character.color}18, rgba(8, 8, 27, 0.94))`,
                      border: `1px solid ${character.color}66`,
                      borderRadius: 16,
                      padding: 14,
                      display: "grid",
                      gridTemplateColumns: stackRosterCardContent ? "1fr" : "auto 1fr",
                      gap: 12,
                      alignItems: "center",
                      boxShadow: `inset 0 1px 0 ${character.color}22, 0 10px 26px rgba(2, 4, 22, 0.24)`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewDirections((prev) => updatePreviewDirection(prev, index))}
                      title={`Rotar preview de ${character.name}`}
                      style={{
                        width: isMobile ? 74 : 92,
                        minHeight: isMobile ? 84 : 104,
                        borderRadius: 16,
                        background: `
                          radial-gradient(circle at 35% 28%, ${character.color}22, transparent 58%),
                          linear-gradient(180deg, #11152f, #05060f)
                        `,
                        border: `1px solid ${character.color}5f`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        boxShadow: `inset 0 0 18px ${character.color}20, 0 6px 16px rgba(0, 0, 0, 0.26)`,
                        cursor: "pointer",
                        padding: "10px 8px",
                        transition: "transform .16s ease, box-shadow .16s ease, border-color .16s ease",
                        justifySelf: stackRosterCardContent ? "center" : "stretch",
                      }}
                    >
                      <PixelSprite character={character} direction={previewDirection} size={isMobile ? 44 : 56} glow={character.glow} />
                      <div style={{ fontSize: 9, color: "#c6d1ff", letterSpacing: 1.2 }}>
                        {previewDirection.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 8, color: "#7f8bc0", letterSpacing: 1 }}>
                        TOCÁ PARA GIRAR
                      </div>
                    </button>

                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: stackRosterCardContent ? "flex-start" : "center",
                          justifyContent: "space-between",
                          flexDirection: stackRosterCardContent ? "column" : "row",
                          gap: stackRosterCardContent ? 4 : 8,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ color: character.color, fontWeight: 900, letterSpacing: 1 }}>Jugador {index + 1}</span>
                        <span style={{ fontSize: 10, color: "#7d86b3" }}>{character.name}</span>
                      </div>
                      <select
                        value={slot.characterId}
                        onChange={(event) => {
                          setSetupSlots((prev) => updateSetupCharacter(prev, index, event.target.value, playerCount));
                          setPreviewDirections((prev) => resetPreviewDirection(prev, index));
                        }}
                        style={{
                          width: "100%",
                          background: "#08081b",
                          color: "#f7f1d4",
                          border: `1px solid ${character.color}55`,
                          borderRadius: 10,
                          padding: "9px 10px",
                          marginBottom: 8,
                          fontFamily: PIXEL_FONT,
                        }}
                      >
                        {CHARACTER_SETS.map((set) => (
                          <optgroup key={set.id} label={set.name}>
                            {set.characters.map((option) => (
                              <option
                                key={option.id}
                                value={option.id}
                                disabled={isCharacterTaken(setupSlots, option.id, index, playerCount)}
                              >
                                {option.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <input
                        value={slot.displayName}
                        onChange={(event) => setSetupSlots((prev) => updateSetupName(prev, index, event.target.value))}
                        placeholder={character.name}
                        style={{
                          width: "100%",
                          background: "#08081b",
                          color: "#ffffff",
                          border: "1px solid #334",
                          borderRadius: 10,
                          padding: "9px 10px",
                          fontFamily: PIXEL_FONT,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={startGame}
              style={{
                padding: isMobile ? "11px 34px" : "13px 44px",
                fontSize: isMobile ? 14 : 16,
                fontWeight: 900,
                fontFamily: PIXEL_FONT,
                background: "#FFE000",
                color: "#000",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
                letterSpacing: 4,
                boxShadow: "0 0 20px #FFE00044",
              }}
            >
              ▶ JUGAR
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "win" && winner !== null) {
    const winnerPlayer = players[winner];
    return (
      <div
        style={{
          height: "100dvh",
          background: "#000119",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: PIXEL_FONT,
          color: "#FFE000",
          padding: 16,
          textAlign: "center",
        }}
      >
        <style>{CSS}</style>
        <div style={{ animation: "pacLudoFloat 1s infinite alternate" }}>
          <PixelSprite character={winnerPlayer} direction="right" size={isMobile ? 72 : 96} glow={winnerPlayer.glow} />
        </div>
        <h1
          style={{
            fontSize: isMobile ? 24 : 38,
            color: winnerPlayer.color,
            textShadow: `0 0 30px ${winnerPlayer.color}`,
            margin: "18px 0 8px",
            letterSpacing: 4,
          }}
        >
          ¡{winnerPlayer.displayName} GANA!
        </h1>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>GAME OVER</div>
        <button
          onClick={goToMenu}
          style={{
            padding: "8px 28px",
            fontSize: 13,
            fontFamily: PIXEL_FONT,
            background: "transparent",
            color: "#FFE000",
            border: "2px solid #FFE000",
            borderRadius: 10,
            cursor: "pointer",
            letterSpacing: 3,
          }}
        >
          MENÚ
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        background: "#000119",
        fontFamily: PIXEL_FONT,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: isMobile ? "6px 4px" : "10px 8px",
        overflow: "hidden",
      }}
    >
      <style>{CSS}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 6 : 12,
          marginBottom: isMobile ? 4 : 8,
          width: "100%",
          maxWidth: boardSize,
          justifyContent: "center",
          flexWrap: compactGameHud ? "wrap" : "nowrap",
          rowGap: compactGameHud ? 6 : 0,
        }}
      >
        {currentPlayer && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: isMobile ? "4px 8px" : "5px 12px",
              background: `${currentPlayer.color}15`,
              border: `2px solid ${currentPlayer.color}44`,
              borderRadius: 10,
              minWidth: 0,
              maxWidth: compactGameHud ? "100%" : Math.max(110, boardSize * 0.45),
            }}
          >
            <PixelSprite character={currentPlayer} direction="right" size={isMobile ? 16 : 20} glow={currentPlayer.glow} />
            <span
              style={{
                color: currentPlayer.color,
                fontWeight: 900,
                fontSize: isMobile ? 10 : 12,
                letterSpacing: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentPlayer.displayName}
            </span>
          </div>
        )}
        {gameMode === "normal" ? (
          <DiceWidget value={dice} rolling={rolling} onClick={handleRoll} disabled={phase !== "roll" || rolling} color={currentPlayer.color} size={diceSize} />
        ) : (
          <button
            onClick={handleRouletteOpen}
            disabled={phase !== "roll" || rouletteOpen}
            style={{
              width: diceSize,
              height: diceSize,
              borderRadius: "50%",
              background: phase === "roll" && !rouletteOpen ? "#111" : "#222",
              border: `2px solid ${phase === "roll" && !rouletteOpen ? currentPlayer.color : "#333"}`,
              cursor: phase === "roll" && !rouletteOpen ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: phase === "roll" && !rouletteOpen ? `0 0 10px ${currentPlayer.color}44` : "none",
              transition: "all .3s",
              fontSize: isMobile ? 18 : 22,
            }}
          >
            🎡
          </button>
        )}
        <div style={{ textAlign: "center", minWidth: 42 }}>
          <div style={{ fontSize: isMobile ? 7 : 8, color: "#666", letterSpacing: 1 }}>META</div>
          <div style={{ fontSize: isMobile ? 15 : 19, fontWeight: 900, color: currentPlayer.color }}>{currentFinishedCount}/4</div>
        </div>
      </div>

      <div
        style={{
          fontSize: isMobile ? 9 : 10,
          color: phase === "pick" ? "#fff" : "#FFE000",
          marginBottom: isMobile ? 4 : 6,
          textAlign: "center",
          minHeight: 16,
          letterSpacing: 1,
          textShadow: phase === "pick" ? "0 0 8px #ffffff66" : "0 0 6px #FFE00044",
          maxWidth: boardSize,
          overflow: "hidden",
          textOverflow: isMobile ? undefined : "ellipsis",
          whiteSpace: isMobile ? "normal" : "nowrap",
          padding: "0 4px",
          fontWeight: phase === "pick" ? 900 : 400,
          lineHeight: 1.4,
        }}
      >
        {msg}
      </div>

      <div style={{ position: "relative", width: boardSize, height: boardSize }}>
        <BoardGrid
          boardSize={boardSize}
          cellSize={cellSize}
          playerCount={playerCount}
          players={players}
          showCenterCharacter={showCenterCharacter}
        />

        {Object.values(renderedTokenGroups).flatMap((group) => {
          const count = group.length;
          return group.map(({ token, playerId, row, col, facing }, index) => {
            const player = players[playerId];
            const clickable = playerId === cur && phase === "pick" && canTokenMove(token, playerId, dice);
            const pickIndex = clickable ? movableTokens.findIndex((candidate) => candidate.id === token.id) : -1;
            const sweating = isSweating(token, playerId, tokens, playerCount);
            const offsetX = count > 1 ? (index - (count - 1) / 2) * Math.max(4, cellSize * 0.2) : 0;
            const offsetY = count > 1 ? (index - (count - 1) / 2) * Math.max(-3, -cellSize * 0.12) : 0;

            return (
              <div
                key={token.id}
                onClick={() => handleTokenClick(token, playerId)}
                style={{
                  position: "absolute",
                  left: col * cellSize + (cellSize - tokenSize) / 2 + offsetX,
                  top: row * cellSize + (cellSize - tokenSize) / 2 + offsetY,
                  width: tokenSize,
                  height: tokenSize,
                  cursor: clickable ? "pointer" : "default",
                  zIndex: clickable ? 30 : 10 + index,
                  transition: "all .12s linear",
                  transform: clickable ? "scale(1.24)" : "scale(1)",
                  animation: clickable ? "pacLudoPick .8s infinite alternate" : "none",
                  filter: clickable ? `drop-shadow(0 0 6px ${player.color})` : undefined,
                }}
              >
                <PixelSprite
                  character={player}
                  direction={facing}
                  size={tokenSize}
                  glow={clickable ? player.glow : undefined}
                  sweating={sweating}
                />
                {clickable && pickIndex >= 0 && !isMobile && (
                  <div
                    style={{
                      position: "absolute",
                      top: -Math.max(6, tokenSize * 0.25),
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: player.color,
                      color: "#000",
                      fontWeight: 900,
                      fontSize: Math.max(8, tokenSize * 0.35),
                      width: Math.max(14, tokenSize * 0.42),
                      height: Math.max(14, tokenSize * 0.42),
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 0 6px ${player.color}`,
                    }}
                  >
                    {pickIndex + 1}
                  </div>
                )}
              </div>
            );
          });
        })}

        {players.map((player) => {
          const finishedCount = (tokens[player.seatId] || []).filter((token) => token.state === "finished").length;
          if (finishedCount === 0) return null;
          const angles = [0, 90, 180, 270];
          const centerOffset = Math.max(3, cellSize * 0.2);
          return (
            <div
              key={`finished-${player.seatId}`}
              style={{
                position: "absolute",
                left: 7 * cellSize + (cellSize - tokenSize) / 2 + Math.cos((angles[player.seatId] * Math.PI) / 180) * centerOffset,
                top: 7 * cellSize + (cellSize - tokenSize) / 2 + Math.sin((angles[player.seatId] * Math.PI) / 180) * centerOffset,
                width: tokenSize,
                height: tokenSize,
                zIndex: 6,
                opacity: 0.78,
              }}
            >
              <PixelSprite character={player} direction="down" size={tokenSize} />
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  fontSize: Math.max(8, tokenSize * 0.35),
                  color: player.color,
                  fontWeight: 900,
                  textShadow: "0 0 4px #000",
                }}
              >
                {finishedCount}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: isMobile ? 4 : 8,
          marginTop: isMobile ? 5 : 8,
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          maxWidth: boardSize,
        }}
      >
        {players.map((player) => {
          if (!activeSeatIds.has(player.seatId)) return null;
          const finishedCount = (tokens[player.seatId] || []).filter((token) => token.state === "finished").length;
          return (
            <div
              key={player.seatId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: isMobile ? "2px 6px" : "3px 8px",
                background: cur === player.seatId ? `${player.color}22` : "#0a0a1a",
                border: `1px solid ${cur === player.seatId ? player.color : "#222"}`,
                borderRadius: 6,
                opacity: cur === player.seatId ? 1 : 0.5,
                transition: "all .3s",
              }}
            >
              <PixelSprite character={player} direction="right" size={isMobile ? 10 : 12} />
              <span style={{ fontSize: isMobile ? 7 : 8, color: player.color, fontWeight: 700 }}>{finishedCount}/4</span>
            </div>
          );
        })}
        <button
          onClick={() => setAutoPlay((prev) => !prev)}
          style={{
            padding: isMobile ? "2px 6px" : "3px 8px",
            fontSize: isMobile ? 7 : 8,
            fontFamily: PIXEL_FONT,
            background: autoPlay ? "#FFE00022" : "transparent",
            color: autoPlay ? "#FFE000" : "#444",
            border: `1px solid ${autoPlay ? "#FFE000" : "#333"}`,
            borderRadius: 6,
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          {autoPlay ? "AUTO" : "MANUAL"}
        </button>
        <button
          onClick={goToMenu}
          style={{
            padding: isMobile ? "2px 7px" : "3px 9px",
            fontSize: isMobile ? 7 : 8,
            fontFamily: PIXEL_FONT,
            background: "transparent",
            color: "#444",
            border: "1px solid #333",
            borderRadius: 6,
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          ✕
        </button>
      </div>

      {rouletteOpen && (
        <div
          onClick={rouletteSpinning ? handleRouletteStop : undefined}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "linear-gradient(180deg, rgba(4, 7, 24, 0.94) 0%, rgba(1, 3, 15, 0.98) 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: isMobile ? "flex-start" : "center",
            cursor: rouletteSpinning ? "pointer" : "default",
            padding: isMobile ? "18px 14px 24px" : 22,
            overflowY: "auto",
            overscrollBehavior: "contain",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: isMobile ? 8 : 10,
              width: "100%",
              maxWidth: rouletteWheelSize + (isMobile ? 24 : 40),
              margin: "0 auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: isMobile ? 6 : 8,
                minWidth: 0,
                width: "100%",
              }}
            >
              <PixelSprite character={currentPlayer} direction="right" size={isMobile ? 24 : 30} glow={currentPlayer.glow} />
              <span
                style={{
                  color: currentPlayer.color,
                  fontWeight: 900,
                  fontSize: isMobile ? 11 : 18,
                  letterSpacing: isMobile ? 1.4 : 3,
                  minWidth: 0,
                  maxWidth: isMobile ? "min(100%, 220px)" : "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
              >
                {currentPlayer.displayName}
              </span>
            </div>
            <div
              style={{
                fontSize: isMobile ? 8 : 11,
                color: rouletteSpinning ? "#FFE27A" : "#c8cfdf",
                letterSpacing: isMobile ? 1 : 1.5,
                textAlign: "center",
                maxWidth: rouletteWheelSize + 30,
                lineHeight: 1.35,
              }}
            >
              {roulettePurpose === "battle"
                ? rouletteSpinning
                  ? isMobile
                    ? `ATAQUE · ${ROULETTE_DURATION_SECONDS_LABEL}S MÁX`
                    : `RULETA DE ATAQUE · MÁXIMO ${ROULETTE_DURATION_SECONDS_LABEL} SEGUNDOS`
                  : rouletteResult !== null
                    ? "ATAQUE RESUELTO"
                    : "RULETA DE ATAQUE"
                : roulettePurpose === "entry"
                  ? rouletteSpinning
                    ? isMobile
                      ? `SALIDA · ${ROULETTE_DURATION_SECONDS_LABEL}S MÁX`
                      : `SALIDA DE BASE · MÁXIMO ${ROULETTE_DURATION_SECONDS_LABEL} SEGUNDOS`
                    : rouletteResult !== null
                      ? "SALIDA RESUELTA"
                      : "GIRÁ LA RULETA"
                  : rouletteSpinning
                    ? isMobile
                      ? `GIRO FIJO · ${ROULETTE_DURATION_SECONDS_LABEL}S MÁX`
                      : `GIRO FIJO · MÁXIMO ${ROULETTE_DURATION_SECONDS_LABEL} SEGUNDOS`
                    : rouletteResult !== null
                      ? "RESULTADO DEFINIDO"
                      : "GIRÁ LA RULETA"}
            </div>
            <div
              style={{
                width: Math.min(rouletteWheelSize, isMobile ? 280 : 340),
                display: "flex",
                flexDirection: "column",
                gap: 5,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(255, 226, 122, 0.12)",
                  border: "1px solid rgba(255, 226, 122, 0.22)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${rouletteProgress * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #ffe27a 0%, #f5b54c 100%)",
                    boxShadow: "0 0 10px rgba(255, 226, 122, 0.45)",
                    transition: rouletteSpinning ? "none" : "width .18s ease-out",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: isMobile ? 8 : 9,
                  color: rouletteSpinning ? "#ffe8a3" : "#98a1bf",
                  letterSpacing: 1,
                }}
              >
                <span>TIEMPO</span>
                <span>{rouletteCountdownLabel}s</span>
              </div>
            </div>
            {roulettePurpose === "entry" && (
              <div
                style={{
                  padding: "4px 9px",
                  borderRadius: 999,
                  background: "#2B6B591C",
                  border: "1px solid #2B6B5960",
                  color: "#9ed4c1",
                  fontSize: isMobile ? 8 : 9,
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                SOLO ENTRA SI SALE 👻
              </div>
            )}
            <RouletteWheel
              sections={rouletteSections}
              angle={rouletteAngle}
              size={rouletteWheelSize}
              spinning={rouletteSpinning}
              result={rouletteResult}
            />
            <div
              style={{
                minHeight: isMobile ? 24 : 28,
                textAlign: "center",
                fontSize: isMobile ? 9 : 13,
                fontWeight: 900,
                letterSpacing: isMobile ? 1.2 : 2,
                color: rouletteSpinning ? "#FFE27A" : rouletteResult === 0 ? "#f0d8d4" : "#dbe4f8",
                lineHeight: 1.25,
                maxWidth: rouletteWheelSize + 24,
              }}
            >
              {rouletteSpinning
                ? isMobile
                  ? "TOCÁ PARA FRENAR"
                  : "TOCÁ O APRETÁ ESPACIO PARA FRENAR"
                : rouletteResult !== null
                  ? roulettePurpose === "battle"
                    ? rouletteResult === 0
                      ? "NO LO MATÓ"
                      : "ATAQUE EXITOSO"
                    : rouletteResult === 0
                      ? "NADA"
                      : `SACASTE ${rouletteResult}`
                  : ""}
            </div>
            {roulettePurpose === "number" && (consecutiveSixes[cur] || 0) > 0 && (
              <div style={{ fontSize: isMobile ? 8 : 9, color: "#d8a96a", letterSpacing: 1.2 }}>
                RACHA DE 6: {consecutiveSixes[cur]}/3
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
