import type { MazePreset } from '../../lib/genetic-lab/maze-runner-types'
import type { SimulationResult } from '../../lib/genetic-lab/maze-runner-types'

type Props = {
  maze: MazePreset
  result?: SimulationResult
  /** Compact mode for mini-cards */
  mini?: boolean
  /** Highlight style when selected */
  highlight?: string
}

const WALL_COLOR = '#1a1a2e'
const FREE_COLOR = '#2a2a4a'
const START_COLOR = '#4caf50'
const GOAL_COLOR = '#ffd34c'
const PATH_COLOR = '#7c4dff'
const PATH_END_REACHED = '#4caf50'
const PATH_END_MISSED = '#ef5350'

export default function MazeReplay({ maze, result, mini, highlight }: Props) {
  const cellSize = 1
  const w = maze.width * cellSize
  const h = maze.height * cellSize

  const [startR, startC] = maze.start
  const [goalR, goalC] = maze.goal

  // Build path line points
  let pathPoints = ''
  if (result && result.path.length > 1) {
    pathPoints = result.path
      .map(([r, c]) => `${c * cellSize + cellSize / 2},${r * cellSize + cellSize / 2}`)
      .join(' ')
  }

  const finalPos = result?.finalPos
  const reached = result?.reached ?? false

  const strokeW = mini ? 0.15 : 0.1
  const markerR = mini ? 0.25 : 0.2

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`evo-maze-replay${mini ? ' evo-maze-replay--mini' : ''}`}
      style={{
        border: highlight ? `2px solid ${highlight}` : undefined,
        borderRadius: mini ? 3 : 4,
      }}
    >
      {/* Grid cells */}
      {maze.grid.map((row, r) =>
        row.map((cell, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * cellSize}
            y={r * cellSize}
            width={cellSize}
            height={cellSize}
            fill={cell === 1 ? WALL_COLOR : FREE_COLOR}
            stroke="#333"
            strokeWidth={0.02}
          />
        ))
      )}

      {/* Start marker */}
      <circle
        cx={startC * cellSize + cellSize / 2}
        cy={startR * cellSize + cellSize / 2}
        r={markerR}
        fill={START_COLOR}
        opacity={0.7}
      />

      {/* Goal marker */}
      <circle
        cx={goalC * cellSize + cellSize / 2}
        cy={goalR * cellSize + cellSize / 2}
        r={markerR}
        fill={GOAL_COLOR}
        opacity={0.7}
      />

      {/* Path trace */}
      {pathPoints && (
        <polyline
          points={pathPoints}
          fill="none"
          stroke={PATH_COLOR}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      )}

      {/* Final position marker */}
      {finalPos && (
        <circle
          cx={finalPos[1] * cellSize + cellSize / 2}
          cy={finalPos[0] * cellSize + cellSize / 2}
          r={markerR * 0.8}
          fill={reached ? PATH_END_REACHED : PATH_END_MISSED}
          stroke="#fff"
          strokeWidth={0.05}
        />
      )}
    </svg>
  )
}
