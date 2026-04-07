import type { Genome } from './types'
import type { MazePreset, MoveDirection, SimulationResult } from './maze-runner-types'

// ─── Direction deltas: [dRow, dCol] ──────────────────────────
const DELTAS: Record<MoveDirection, [number, number]> = {
  0: [-1, 0],  // up
  1: [0, 1],   // right
  2: [1, 0],   // down
  3: [0, -1],  // left
}

/** Arrow symbols for each direction */
export const MOVE_ARROWS: Record<MoveDirection, string> = {
  0: '\u2191',  // ↑
  1: '\u2192',  // →
  2: '\u2193',  // ↓
  3: '\u2190',  // ←
}

// ─── Decode genome into moves ────────────────────────────────
// Each pair of bits encodes a direction: 00=up, 01=right, 10=down, 11=left
export function decodeMoves(genome: Genome): MoveDirection[] {
  const moves: MoveDirection[] = []
  for (let i = 0; i + 1 < genome.length; i += 2) {
    const dir = (genome[i] * 2 + genome[i + 1]) as MoveDirection
    moves.push(dir)
  }
  return moves
}

// ─── Simulate a maze run ─────────────────────────────────────
export function simulateMazeRunner(moves: MoveDirection[], maze: MazePreset): SimulationResult {
  const [startR, startC] = maze.start
  const [goalR, goalC] = maze.goal

  let r = startR
  let c = startC
  let wallHits = 0
  const visited = new Set<string>()
  const path: [number, number][] = [[r, c]]
  visited.add(`${r},${c}`)

  let reached = false
  let reachedAtStep: number | null = null

  for (let step = 0; step < moves.length; step++) {
    const [dr, dc] = DELTAS[moves[step]]
    const nr = r + dr
    const nc = c + dc

    // Check bounds and walls
    if (nr < 0 || nr >= maze.height || nc < 0 || nc >= maze.width || maze.grid[nr][nc] === 1) {
      wallHits++
      // Stay in place
      path.push([r, c])
    } else {
      r = nr
      c = nc
      path.push([r, c])
      visited.add(`${r},${c}`)
    }

    // Check if reached goal
    if (r === goalR && c === goalC) {
      reached = true
      reachedAtStep = step
      break
    }
  }

  return {
    path,
    finalPos: [r, c],
    reached,
    reachedAtStep,
    wallHits,
    uniqueCells: visited.size,
    totalSteps: reached ? (reachedAtStep! + 1) : moves.length,
  }
}

// ─── Count free cells in a maze ──────────────────────────────
export function countFreeCells(maze: MazePreset): number {
  let count = 0
  for (let r = 0; r < maze.height; r++) {
    for (let c = 0; c < maze.width; c++) {
      if (maze.grid[r][c] === 0) count++
    }
  }
  return count
}

// ─── Manhattan distance ──────────────────────────────────────
export function manhattan(a: [number, number], b: [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

// ─── Fitness function ────────────────────────────────────────
//
// Fórmula (maxFitness = 1000):
//
// Si llegó a la meta:
//   base = 600 + 400 * (1 - stepsUsed / maxSteps)
//   → 600 por llegar, +hasta 400 por llegar rápido
//
// Si no llegó:
//   maxDist = maze.width + maze.height
//   closeness = 1 - manhattan(finalPos, goal) / maxDist
//   base = 500 * closeness
//   → hasta 500 por estar cerca de la meta
//
// Bonus exploración:
//   +30 * (uniqueCells / totalFreeCells)
//   → hasta 30 puntos por explorar celdas nuevas
//
// Penalizaciones:
//   -2 por cada choque con pared
//   -50 extra si más de la mitad de los pasos fueron choques
//
export function mazeRunnerFitness(genome: Genome, maze: MazePreset): number {
  const moves = decodeMoves(genome)
  const result = simulateMazeRunner(moves, maze)
  return computeFitnessFromResult(result, maze, moves.length)
}

export function computeFitnessFromResult(
  result: SimulationResult,
  maze: MazePreset,
  maxSteps: number,
): number {
  let fitness = 0
  const freeCells = countFreeCells(maze)

  if (result.reached) {
    // Big bonus for reaching + speed bonus
    const speedRatio = 1 - (result.reachedAtStep! + 1) / maxSteps
    fitness = 600 + 400 * Math.max(0, speedRatio)
  } else {
    // Closeness to goal (up to 500)
    const maxDist = maze.width + maze.height
    const dist = manhattan(result.finalPos, maze.goal)
    const closeness = 1 - dist / maxDist
    fitness = 500 * closeness
  }

  // Exploration bonus (up to 30)
  if (freeCells > 0) {
    fitness += 30 * (result.uniqueCells / freeCells)
  }

  // Wall hit penalty: -2 per hit
  fitness -= 2 * result.wallHits

  // Excessive bouncing penalty: if >50% of steps hit walls
  if (result.totalSteps > 0) {
    const bounceRatio = result.wallHits / result.totalSteps
    if (bounceRatio > 0.5) {
      fitness -= 50 * (bounceRatio - 0.5)
    }
  }

  return Math.max(0, Math.round(fitness * 100) / 100)
}

// ─── Didactic description ────────────────────────────────────
// Returns a short deterministic text based on the simulation result.
export function describeMazeResult(result: SimulationResult, maxSteps: number): string {
  if (result.reached) {
    const ratio = (result.reachedAtStep! + 1) / maxSteps
    if (ratio <= 0.4) return 'Este individuo encontr\u00f3 la meta r\u00e1pido.'
    if (ratio <= 0.7) return 'Este individuo llega a la meta con una ruta razonable.'
    return 'Este individuo llega, pero su ruta es ineficiente.'
  }

  if (result.wallHits > maxSteps * 0.5) {
    return 'Este individuo pierde muchos pasos chocando paredes.'
  }

  if (result.uniqueCells > maxSteps * 0.4) {
    return 'Este individuo explora bastante, pero todav\u00eda no optimiza la ruta.'
  }

  return 'Este individuo todav\u00eda no encuentra un camino \u00fatil.'
}

// Better version that receives the maze for distance-based messages
export function describeMazeResultFull(
  result: SimulationResult,
  maze: MazePreset,
  maxSteps: number,
): string {
  if (result.reached) {
    const ratio = (result.reachedAtStep! + 1) / maxSteps
    if (ratio <= 0.4) return 'Este individuo encontr\u00f3 la meta r\u00e1pido.'
    if (ratio <= 0.7) return 'Este individuo llega a la meta con una ruta razonable.'
    return 'Este individuo llega, pero su ruta es ineficiente.'
  }

  const dist = manhattan(result.finalPos, maze.goal)

  if (result.wallHits > maxSteps * 0.5) {
    return 'Este individuo pierde muchos pasos chocando paredes.'
  }

  if (dist <= 2) {
    return `Este individuo casi llega, pero se queda a ${dist} celda${dist === 1 ? '' : 's'}.`
  }

  if (result.uniqueCells > maxSteps * 0.4) {
    return 'Este individuo explora bastante, pero todav\u00eda no optimiza la ruta.'
  }

  return 'Este individuo todav\u00eda no encuentra un camino \u00fatil.'
}

// ─── Population-level metrics ────────────────────────────────
// Compute maze-specific stats from a set of genomes.
export function computeMazePopulationStats(
  genomes: Genome[],
  maze: MazePreset,
): { reachedPct: number; avgDistance: number } {
  let reachedCount = 0
  let totalDist = 0

  for (const genome of genomes) {
    const moves = decodeMoves(genome)
    const result = simulateMazeRunner(moves, maze)
    if (result.reached) {
      reachedCount++
    }
    totalDist += manhattan(result.finalPos, maze.goal)
  }

  return {
    reachedPct: genomes.length > 0 ? (reachedCount / genomes.length) * 100 : 0,
    avgDistance: genomes.length > 0 ? totalDist / genomes.length : 0,
  }
}
