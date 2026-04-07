import { useState, useCallback } from 'react'
import type { MazePreset, MazeCell, MazeGrid } from '../../lib/genetic-lab/maze-runner-types'

type Props = {
  maze: MazePreset
  onChange: (maze: MazePreset) => void
  disabled: boolean
}

type Tool = 'wall' | 'free' | 'start' | 'goal'

const TOOLS: { value: Tool; label: string; title: string }[] = [
  { value: 'wall', label: '#', title: 'Pared' },
  { value: 'free', label: '.', title: 'Libre' },
  { value: 'start', label: 'S', title: 'Inicio' },
  { value: 'goal', label: 'G', title: 'Meta' },
]

function clampDim(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Create a default grid with walls on borders and free cells inside */
function createDefaultGrid(width: number, height: number, start: [number, number], goal: [number, number]): MazeGrid {
  const grid: MazeGrid = []
  for (let r = 0; r < height; r++) {
    const row: MazeCell[] = []
    for (let c = 0; c < width; c++) {
      const isBorder = r === 0 || r === height - 1 || c === 0 || c === width - 1
      row.push(isBorder ? 1 : 0)
    }
    grid.push(row)
  }
  // Ensure start and goal are free
  grid[start[0]][start[1]] = 0
  grid[goal[0]][goal[1]] = 0
  return grid
}

/** Resize an existing grid, preserving content where possible */
function resizeGrid(
  oldGrid: MazeGrid,
  newWidth: number,
  newHeight: number,
  start: [number, number],
  goal: [number, number],
): MazeGrid {
  const grid: MazeGrid = []
  for (let r = 0; r < newHeight; r++) {
    const row: MazeCell[] = []
    for (let c = 0; c < newWidth; c++) {
      const isBorder = r === 0 || r === newHeight - 1 || c === 0 || c === newWidth - 1
      if (isBorder) {
        row.push(1)
      } else if (r < oldGrid.length && c < (oldGrid[0]?.length ?? 0)) {
        row.push(oldGrid[r][c])
      } else {
        row.push(0)
      }
    }
    grid.push(row)
  }
  // Ensure start and goal are free
  grid[start[0]][start[1]] = 0
  grid[goal[0]][goal[1]] = 0
  return grid
}

export default function MazeEditor({ maze, onChange, disabled }: Props) {
  const [tool, setTool] = useState<Tool>('wall')
  const [painting, setPainting] = useState(false)

  const handleCellInteraction = useCallback((r: number, c: number) => {
    if (disabled) return
    // Don't allow editing border cells (they stay as walls)
    if (r === 0 || r === maze.height - 1 || c === 0 || c === maze.width - 1) return

    const newGrid = maze.grid.map(row => [...row]) as MazeGrid
    let newStart = maze.start
    let newGoal = maze.goal

    if (tool === 'wall') {
      // Don't place wall on start or goal
      if ((r === maze.start[0] && c === maze.start[1]) || (r === maze.goal[0] && c === maze.goal[1])) return
      newGrid[r][c] = 1
    } else if (tool === 'free') {
      newGrid[r][c] = 0
    } else if (tool === 'start') {
      // Move start: clear old start, set new
      newGrid[r][c] = 0
      newStart = [r, c]
    } else if (tool === 'goal') {
      newGrid[r][c] = 0
      newGoal = [r, c]
    }

    onChange({
      ...maze,
      grid: newGrid,
      start: newStart,
      goal: newGoal,
    })
  }, [maze, tool, disabled, onChange])

  const handleResize = useCallback((newWidth: number, newHeight: number) => {
    const w = clampDim(newWidth, 4, 20)
    const h = clampDim(newHeight, 4, 20)
    // Clamp start and goal into new bounds (inside border)
    const newStart: [number, number] = [
      Math.min(maze.start[0], h - 2),
      Math.min(maze.start[1], w - 2),
    ]
    const newGoal: [number, number] = [
      Math.min(maze.goal[0], h - 2),
      Math.min(maze.goal[1], w - 2),
    ]
    // Ensure start != goal
    if (newStart[0] === newGoal[0] && newStart[1] === newGoal[1]) {
      newGoal[0] = Math.max(1, newGoal[0] - 1)
    }
    const newGrid = resizeGrid(maze.grid, w, h, newStart, newGoal)
    onChange({
      ...maze,
      id: 'custom',
      name: 'Custom',
      width: w,
      height: h,
      grid: newGrid,
      start: newStart,
      goal: newGoal,
    })
  }, [maze, onChange])

  const handleClear = useCallback(() => {
    const start: [number, number] = [1, 1]
    const goal: [number, number] = [maze.height - 2, maze.width - 2]
    const grid = createDefaultGrid(maze.width, maze.height, start, goal)
    onChange({ ...maze, id: 'custom', name: 'Custom', grid, start, goal })
  }, [maze, onChange])

  const cellSize = Math.min(28, Math.floor(320 / Math.max(maze.width, maze.height)))

  return (
    <div className="evo-maze-editor">
      <div className="evo-maze-editor__size">
        <label>
          Ancho
          <input
            type="number" min={4} max={20}
            value={maze.width}
            onChange={e => handleResize(parseInt(e.target.value) || maze.width, maze.height)}
            disabled={disabled}
          />
        </label>
        <label>
          Alto
          <input
            type="number" min={4} max={20}
            value={maze.height}
            onChange={e => handleResize(maze.width, parseInt(e.target.value) || maze.height)}
            disabled={disabled}
          />
        </label>
        <button type="button" className="lab-tab" onClick={handleClear} disabled={disabled} title="Limpiar todo">
          Limpiar
        </button>
      </div>

      <div className="evo-maze-editor__tools">
        {TOOLS.map(t => (
          <button
            key={t.value}
            type="button"
            className={`evo-maze-editor__tool${tool === t.value ? ' is-active' : ''}`}
            onClick={() => setTool(t.value)}
            disabled={disabled}
            title={t.title}
          >
            {t.label} {t.title}
          </button>
        ))}
      </div>

      <div
        className="evo-maze-editor__grid"
        onMouseLeave={() => setPainting(false)}
        style={{
          gridTemplateColumns: `repeat(${maze.width}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${maze.height}, ${cellSize}px)`,
        }}
      >
        {maze.grid.map((row, r) =>
          row.map((cell, c) => {
            const isStart = r === maze.start[0] && c === maze.start[1]
            const isGoal = r === maze.goal[0] && c === maze.goal[1]
            const isBorder = r === 0 || r === maze.height - 1 || c === 0 || c === maze.width - 1

            let cls = 'evo-maze-editor__cell'
            if (cell === 1) cls += ' is-wall'
            if (isStart) cls += ' is-start'
            if (isGoal) cls += ' is-goal'
            if (isBorder) cls += ' is-border'

            return (
              <div
                key={`${r}-${c}`}
                className={cls}
                onMouseDown={() => { setPainting(true); handleCellInteraction(r, c) }}
                onMouseEnter={() => { if (painting) handleCellInteraction(r, c) }}
                onMouseUp={() => setPainting(false)}
                style={{ width: cellSize, height: cellSize, fontSize: Math.max(10, cellSize * 0.5) }}
              >
                {isStart ? 'S' : isGoal ? 'G' : ''}
              </div>
            )
          })
        )}
      </div>
      <p className="evo-maze-editor__hint">
        Click o arrastr&aacute; para pintar. Los bordes siempre son pared.
      </p>
    </div>
  )
}

/** Build a default custom maze for initial state */
export function buildDefaultCustomMaze(width: number, height: number): MazePreset {
  const start: [number, number] = [1, 1]
  const goal: [number, number] = [height - 2, width - 2]
  return {
    id: 'custom',
    name: 'Custom',
    width,
    height,
    grid: createDefaultGrid(width, height, start, goal),
    start,
    goal,
  }
}
