import type { BoardCoord, CellMeta, FacingDirection, MoveSegment, PcfgEntry, Token } from "./types";

export const GRID = 15;
export const IDLE_TOKEN_FACING: FacingDirection = "down";

export const CENTER_COORD: BoardCoord = { row: 7, col: 7 };

export const PATH: BoardCoord[] = [
  { row: 6, col: 0 }, { row: 6, col: 1 }, { row: 6, col: 2 }, { row: 6, col: 3 }, { row: 6, col: 4 }, { row: 6, col: 5 }, { row: 5, col: 6 }, { row: 4, col: 6 }, { row: 3, col: 6 }, { row: 2, col: 6 }, { row: 1, col: 6 }, { row: 0, col: 6 }, { row: 0, col: 7 },
  { row: 0, col: 8 }, { row: 1, col: 8 }, { row: 2, col: 8 }, { row: 3, col: 8 }, { row: 4, col: 8 }, { row: 5, col: 8 }, { row: 6, col: 9 }, { row: 6, col: 10 }, { row: 6, col: 11 }, { row: 6, col: 12 }, { row: 6, col: 13 }, { row: 6, col: 14 }, { row: 7, col: 14 },
  { row: 8, col: 14 }, { row: 8, col: 13 }, { row: 8, col: 12 }, { row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }, { row: 9, col: 8 }, { row: 10, col: 8 }, { row: 11, col: 8 }, { row: 12, col: 8 }, { row: 13, col: 8 }, { row: 14, col: 8 }, { row: 14, col: 7 },
  { row: 14, col: 6 }, { row: 13, col: 6 }, { row: 12, col: 6 }, { row: 11, col: 6 }, { row: 10, col: 6 }, { row: 9, col: 6 }, { row: 8, col: 5 }, { row: 8, col: 4 }, { row: 8, col: 3 }, { row: 8, col: 2 }, { row: 8, col: 1 }, { row: 8, col: 0 }, { row: 7, col: 0 },
];

export const PCFG: PcfgEntry[] = [
  {
    startIdx: 1,
    homeStretch: [{ row: 7, col: 1 }, { row: 7, col: 2 }, { row: 7, col: 3 }, { row: 7, col: 4 }, { row: 7, col: 5 }, { row: 7, col: 6 }],
    basePos: [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 3, col: 2 }, { row: 3, col: 3 }],
    safeIdx: 1,
  },
  {
    startIdx: 14,
    homeStretch: [{ row: 1, col: 7 }, { row: 2, col: 7 }, { row: 3, col: 7 }, { row: 4, col: 7 }, { row: 5, col: 7 }, { row: 6, col: 7 }],
    basePos: [{ row: 2, col: 11 }, { row: 2, col: 12 }, { row: 3, col: 11 }, { row: 3, col: 12 }],
    safeIdx: 14,
  },
  {
    startIdx: 27,
    homeStretch: [{ row: 7, col: 13 }, { row: 7, col: 12 }, { row: 7, col: 11 }, { row: 7, col: 10 }, { row: 7, col: 9 }, { row: 7, col: 8 }],
    basePos: [{ row: 11, col: 11 }, { row: 11, col: 12 }, { row: 12, col: 11 }, { row: 12, col: 12 }],
    safeIdx: 27,
  },
  {
    startIdx: 40,
    homeStretch: [{ row: 13, col: 7 }, { row: 12, col: 7 }, { row: 11, col: 7 }, { row: 10, col: 7 }, { row: 9, col: 7 }, { row: 8, col: 7 }],
    basePos: [{ row: 11, col: 2 }, { row: 11, col: 3 }, { row: 12, col: 2 }, { row: 12, col: 3 }],
    safeIdx: 40,
  },
];

export const SAFE = new Set([1, 14, 27, 40]);

export const BOARD_CELLS = Array.from({ length: GRID * GRID }, (_, index) => {
  const row = Math.floor(index / GRID);
  const col = index % GRID;
  return { row, col };
});

function coordKey(row: number, col: number): string {
  return `${row}-${col}`;
}

const CELL_META = new Map<string, CellMeta>();

for (const { row, col } of BOARD_CELLS) {
  let meta: CellMeta = { type: "empty" };

  if (row <= 5 && col <= 5) meta = { type: "base", player: 0 };
  else if (row <= 5 && col >= 9) meta = { type: "base", player: 1 };
  else if (row >= 9 && col >= 9) meta = { type: "base", player: 2 };
  else if (row >= 9 && col <= 5) meta = { type: "base", player: 3 };
  else if (row >= 6 && row <= 8 && col >= 6 && col <= 8) meta = { type: "center" };

  CELL_META.set(coordKey(row, col), meta);
}

PATH.forEach((coord, idx) => {
  CELL_META.set(coordKey(coord.row, coord.col), { type: "path", idx });
});

PCFG.forEach((cfg, player) => {
  cfg.homeStretch.forEach((coord, idx) => {
    CELL_META.set(coordKey(coord.row, coord.col), { type: "home", player, idx });
  });
});

export function getCellType(row: number, col: number): CellMeta {
  return CELL_META.get(coordKey(row, col)) ?? { type: "empty" };
}

export function stepsFromStart(pid: number, pathIdx: number): number {
  return ((pathIdx - PCFG[pid].startIdx + 52) % 52) + 1;
}

export function getTokenPos(token: Token, pid: number): BoardCoord {
  if (token.state === "base") return PCFG[pid].basePos[token.baseSlot];
  if (token.state === "path") return PATH[token.pathIdx];
  if (token.state === "home") return PCFG[pid].homeStretch[token.homeIdx];
  return PCFG[pid].homeStretch[5];
}

export function getFacingBetween(from: BoardCoord, to: BoardCoord): FacingDirection {
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;

  if (Math.abs(colDiff) >= Math.abs(rowDiff)) {
    return colDiff >= 0 ? "right" : "left";
  }

  return rowDiff >= 0 ? "down" : "up";
}

export function getBaseFacing(pid: number, baseSlot: number): FacingDirection {
  return getFacingBetween(PCFG[pid].basePos[baseSlot], PATH[PCFG[pid].startIdx]);
}

export function getNextBoardCoord(token: Token, pid: number): BoardCoord | null {
  if (token.state === "finished") return null;
  if (token.state === "base") return PATH[PCFG[pid].startIdx];
  if (token.state === "path") {
    const nextProgress = stepsFromStart(pid, token.pathIdx) + 1;
    if (nextProgress <= 51) return PATH[(PCFG[pid].startIdx + nextProgress - 1) % 52];
    const homeIdx = nextProgress - 52;
    return PCFG[pid].homeStretch[Math.min(homeIdx, 5)] ?? null;
  }

  return PCFG[pid].homeStretch[Math.min(token.homeIdx + 1, 5)] ?? null;
}

export function getTokenFacing(token: Token, pid: number): FacingDirection {
  if (token.state === "base" || token.state === "finished") return IDLE_TOKEN_FACING;
  const from = getTokenPos(token, pid);
  const to = getNextBoardCoord(token, pid);
  return to ? getFacingBetween(from, to) : token.facing;
}

export function buildMoveSegments(token: Token, pid: number, dice: number): MoveSegment[] {
  if (token.state === "finished") return [];

  const segments: MoveSegment[] = [];
  let current = getTokenPos(token, pid);

  if (token.state === "base") {
    if (dice !== 6) return [];
    const target = PATH[PCFG[pid].startIdx];
    segments.push({ row: target.row, col: target.col, facing: getFacingBetween(current, target) });
    return segments;
  }

  if (token.state === "path") {
    let progress = stepsFromStart(pid, token.pathIdx);
    for (let step = 0; step < dice; step += 1) {
      progress += 1;
      const target = progress <= 51
        ? PATH[(PCFG[pid].startIdx + progress - 1) % 52]
        : PCFG[pid].homeStretch[Math.min(progress - 52, 5)];
      segments.push({ row: target.row, col: target.col, facing: getFacingBetween(current, target) });
      current = target;
    }
    return segments;
  }

  let homeIdx = token.homeIdx;
  for (let step = 0; step < dice; step += 1) {
    homeIdx = Math.min(homeIdx + 1, 5);
    const target = PCFG[pid].homeStretch[homeIdx];
    segments.push({ row: target.row, col: target.col, facing: getFacingBetween(current, target) });
    current = target;
  }

  return segments;
}
