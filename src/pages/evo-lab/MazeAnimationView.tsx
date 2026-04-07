import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Individual } from '../../lib/genetic-lab/types'
import type { MazePreset, SimulationResult } from '../../lib/genetic-lab/maze-runner-types'
import { decodeMoves, simulateMazeRunner } from '../../lib/genetic-lab/maze-runner'

type Props = {
  individuals: Individual[]
  maze: MazePreset
  generation: number
}

const WALL_COLOR = '#1a1a2e'
const FREE_COLOR = '#2a2a4a'
const START_COLOR = '#4caf50'
const GOAL_COLOR = '#ffd34c'
const DOT_REACHED = '#4caf50'
const DOT_NORMAL = '#7c4dff'
const DOT_BEST = '#53f4ff'

/** Interpolate between cold (blue) and hot (red) via a thermometer scale */
function heatColor(t: number): string {
  // t: 0 (cold/no visits) → 1 (hot/many visits)
  // blue → cyan → green → yellow → orange → red
  const clamped = Math.max(0, Math.min(1, t))
  const stops: [number, number, number][] = [
    [30, 60, 180],   // dark blue
    [0, 180, 220],   // cyan
    [0, 200, 80],    // green
    [255, 220, 0],   // yellow
    [255, 140, 0],   // orange
    [255, 40, 20],   // red
  ]
  const idx = clamped * (stops.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, stops.length - 1)
  const frac = idx - lo
  const r = Math.round(stops[lo][0] + (stops[hi][0] - stops[lo][0]) * frac)
  const g = Math.round(stops[lo][1] + (stops[hi][1] - stops[lo][1]) * frac)
  const b = Math.round(stops[lo][2] + (stops[hi][2] - stops[lo][2]) * frac)
  return `rgb(${r},${g},${b})`
}

export default function MazeAnimationView({ individuals, maze, generation }: Props) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(150)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Simulate all individuals and cache their paths
  const sims: { result: SimulationResult; fitness: number }[] = useMemo(() => {
    return individuals.map(ind => {
      const moves = decodeMoves(ind.genome)
      const result = simulateMazeRunner(moves, maze)
      return { result, fitness: ind.fitness }
    })
  }, [individuals, maze])

  const maxSteps = useMemo(() => {
    return Math.max(1, ...sims.map(s => s.result.path.length))
  }, [sims])

  // Compute heatmap: how many times each cell is visited across ALL individuals up to current step
  const { heatmap, maxHeat } = useMemo(() => {
    const counts: number[][] = Array.from({ length: maze.height }, () =>
      new Array(maze.width).fill(0)
    )
    for (const sim of sims) {
      const pathEnd = Math.min(step + 1, sim.result.path.length)
      for (let s = 0; s < pathEnd; s++) {
        const [r, c] = sim.result.path[s]
        counts[r][c]++
      }
    }
    let mx = 0
    for (const row of counts) for (const v of row) if (v > mx) mx = v
    return { heatmap: counts, maxHeat: mx }
  }, [sims, step, maze.height, maze.width])

  // Reset step when generation changes
  useEffect(() => {
    setStep(0)
    setPlaying(false)
  }, [generation])

  // Animation timer
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    timerRef.current = setTimeout(() => {
      setStep(prev => {
        if (prev >= maxSteps - 1) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, speed)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [playing, step, speed, maxSteps])

  const handlePlay = useCallback(() => {
    if (step >= maxSteps - 1) setStep(0)
    setPlaying(true)
  }, [step, maxSteps])

  const handlePause = useCallback(() => setPlaying(false), [])
  const handleReset = useCallback(() => { setPlaying(false); setStep(0) }, [])

  const bestFitness = Math.max(...individuals.map(i => i.fitness))
  const cellSize = 1
  const w = maze.width * cellSize
  const h = maze.height * cellSize
  const dotR = 0.22

  // Count how many reached the goal at current step
  const reachedCount = sims.filter(s => {
    if (!s.result.reached || s.result.reachedAtStep == null) return false
    return s.result.reachedAtStep < step
  }).length

  return (
    <div className="evo-maze-animation">
      <div className="evo-maze-animation__header">
        <span title="Número de generación que se está animando"><strong>Gen:</strong> {generation}</span>
        <span title="Paso actual de la animación. Cada paso es un movimiento de todos los individuos."><strong>Paso:</strong> {step + 1} / {maxSteps}</span>
        <span title="Cuántos individuos ya alcanzaron la meta hasta este paso"><strong>Llegaron:</strong> {reachedCount} / {individuals.length}</span>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="evo-maze-replay"
        style={{ maxHeight: 400 }}
      >
        {/* Grid cells with heatmap overlay */}
        {maze.grid.map((row, r) =>
          row.map((cell, c) => {
            const isWall = cell === 1
            const heat = heatmap[r][c]
            let fill: string
            if (isWall) {
              fill = WALL_COLOR
            } else if (heat > 0 && maxHeat > 0) {
              fill = heatColor(heat / maxHeat)
            } else {
              fill = FREE_COLOR
            }
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill={fill}
                stroke="#333"
                strokeWidth={0.02}
                opacity={isWall ? 1 : (heat > 0 ? 0.7 + 0.3 * (heat / (maxHeat || 1)) : 1)}
              />
            )
          })
        )}

        {/* Start marker */}
        <circle
          cx={maze.start[1] * cellSize + cellSize / 2}
          cy={maze.start[0] * cellSize + cellSize / 2}
          r={0.25}
          fill={START_COLOR}
          opacity={0.8}
        />

        {/* Goal marker */}
        <circle
          cx={maze.goal[1] * cellSize + cellSize / 2}
          cy={maze.goal[0] * cellSize + cellSize / 2}
          r={0.25}
          fill={GOAL_COLOR}
          opacity={0.8}
        />

        {/* Dots for each individual at current position */}
        {sims.map((sim, i) => {
          const path = sim.result.path
          const currentStep = Math.min(step, path.length - 1)
          const isBest = sim.fitness === bestFitness
          const hasReached = sim.result.reached && sim.result.reachedAtStep != null && sim.result.reachedAtStep < step

          const pos = path[currentStep]
          const cx = pos[1] * cellSize + cellSize / 2
          const cy = pos[0] * cellSize + cellSize / 2

          const color = hasReached ? DOT_REACHED : isBest ? DOT_BEST : DOT_NORMAL

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={isBest ? dotR * 1.3 : dotR}
              fill={color}
              stroke={isBest ? '#fff' : 'none'}
              strokeWidth={isBest ? 0.05 : 0}
              opacity={hasReached ? 0.4 : 0.85}
            />
          )
        })}

        {/* Heatmap legend (gradient bar) */}
        <defs>
          <linearGradient id="heatGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={heatColor(0)} />
            <stop offset="20%" stopColor={heatColor(0.2)} />
            <stop offset="40%" stopColor={heatColor(0.4)} />
            <stop offset="60%" stopColor={heatColor(0.6)} />
            <stop offset="80%" stopColor={heatColor(0.8)} />
            <stop offset="100%" stopColor={heatColor(1)} />
          </linearGradient>
        </defs>
      </svg>

      {/* Heatmap legend bar below SVG */}
      <div className="evo-maze-animation__legend">
        <span className="evo-maze-animation__legend-label">Frío</span>
        <div className="evo-maze-animation__legend-bar" />
        <span className="evo-maze-animation__legend-label">Caliente</span>
        <span className="evo-maze-animation__legend-max">
          (máx: {maxHeat} visitas)
        </span>
      </div>

      <div className="evo-maze-animation__controls">
        {!playing ? (
          <button type="button" className="lab-tab" onClick={handlePlay} title="Reproducir">
            &#9654; Play
          </button>
        ) : (
          <button type="button" className="lab-tab" onClick={handlePause} title="Pausar">
            &#10074;&#10074; Pausa
          </button>
        )}
        <button
          type="button"
          className="lab-tab"
          onClick={() => setStep(s => Math.min(s + 1, maxSteps - 1))}
          disabled={playing || step >= maxSteps - 1}
          title="Avanzar un paso"
        >
          +1
        </button>
        <button type="button" className="lab-tab" onClick={handleReset} title="Reiniciar">
          &#8635; Reset
        </button>
        <label className="evo-maze-animation__speed" title="Controla la velocidad de la animación. Más a la derecha = más rápido.">
          Velocidad
          <input
            type="range"
            min={20}
            max={500}
            value={500 - speed + 20}
            onChange={e => setSpeed(500 - parseInt(e.target.value) + 20)}
          />
        </label>
      </div>

      <p className="evo-maze-animation__hint">
        Las celdas se colorean con un mapa de calor seg&uacute;n cu&aacute;ntos individuos pasaron por ah&iacute;. Azul = pocas visitas, rojo = muchas visitas.
      </p>
    </div>
  )
}
