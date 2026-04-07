/** 0 = free cell, 1 = wall */
export type MazeCell = 0 | 1

/** grid[row][col] — row 0 is top */
export type MazeGrid = MazeCell[][]

export type MazePreset = {
  id: string
  name: string
  width: number
  height: number
  grid: MazeGrid
  start: [number, number]  // [row, col]
  goal: [number, number]   // [row, col]
}

/** 0=up, 1=right, 2=down, 3=left */
export type MoveDirection = 0 | 1 | 2 | 3

export type SimulationResult = {
  /** Ordered positions visited (including start) */
  path: [number, number][]
  /** Where the individual ended up */
  finalPos: [number, number]
  /** Whether it reached the goal */
  reached: boolean
  /** Step index at which it reached the goal (0-based), or null */
  reachedAtStep: number | null
  /** Number of times a move was blocked by a wall or boundary */
  wallHits: number
  /** Number of distinct cells visited */
  uniqueCells: number
  /** Total moves executed (may be < genome moves if reached early) */
  totalSteps: number
}
