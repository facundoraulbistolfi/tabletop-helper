import type { MazePreset } from './maze-runner-types'

// Helper: parse a visual string map into a MazeGrid.
// '#' = wall (1), '.' = free (0), 'S' = start (0), 'G' = goal (0)
function parseMaze(rows: string[]): MazePreset['grid'] {
  return rows.map(row =>
    Array.from(row).map(ch => (ch === '#' ? 1 : 0) as 0 | 1)
  )
}

function findChar(rows: string[], ch: string): [number, number] {
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r].indexOf(ch)
    if (c !== -1) return [r, c]
  }
  throw new Error(`Character '${ch}' not found in maze`)
}

// ─── Easy Corridor (8×6) ────────────────────────────────────
// Un pasillo simple con un par de giros. Ideal para ver convergencia rápida.
const EASY_ROWS = [
  '########',
  '#S.....#',
  '#.####.#',
  '#.#..#.#',
  '#....#G#',
  '########',
]

// ─── Dead Ends (10×8) ───────────────────────────────────────
// Callejones sin salida y bifurcaciones falsas.
// El camino correcto requiere esquivar trampas.
const DEADENDS_ROWS = [
  '##########',
  '#S.#.....#',
  '#..#.###.#',
  '#.....#..#',
  '###.#.#.##',
  '#...#.#..#',
  '#.###..#G#',
  '##########',
]

// ─── Long Route (12×10) ─────────────────────────────────────
// Camino largo con varias curvas. Cruce y mutación se notan.
const LONG_ROWS = [
  '############',
  '#S.........#',
  '#.########.#',
  '#.#......#.#',
  '#.#.####.#.#',
  '#.#.#..#.#.#',
  '#.#.#..#...#',
  '#.#.#..###.#',
  '#...#.....G#',
  '############',
]

export const MAZE_PRESETS: MazePreset[] = [
  {
    id: 'easy-corridor',
    name: 'Easy Corridor',
    width: EASY_ROWS[0].length,
    height: EASY_ROWS.length,
    grid: parseMaze(EASY_ROWS),
    start: findChar(EASY_ROWS, 'S'),
    goal: findChar(EASY_ROWS, 'G'),
  },
  {
    id: 'dead-ends',
    name: 'Dead Ends',
    width: DEADENDS_ROWS[0].length,
    height: DEADENDS_ROWS.length,
    grid: parseMaze(DEADENDS_ROWS),
    start: findChar(DEADENDS_ROWS, 'S'),
    goal: findChar(DEADENDS_ROWS, 'G'),
  },
  {
    id: 'long-route',
    name: 'Long Route',
    width: LONG_ROWS[0].length,
    height: LONG_ROWS.length,
    grid: parseMaze(LONG_ROWS),
    start: findChar(LONG_ROWS, 'S'),
    goal: findChar(LONG_ROWS, 'G'),
  },
]

export function getMazePreset(id: string): MazePreset | undefined {
  return MAZE_PRESETS.find(m => m.id === id)
}
