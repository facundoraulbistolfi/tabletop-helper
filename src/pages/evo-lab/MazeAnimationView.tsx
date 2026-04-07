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
const TRAIL_COLOR = '#7c4dff'

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
  const trailWidth = 0.08

  // Count how many reached the goal at current step
  const reachedCount = sims.filter(s => {
    if (!s.result.reached || s.result.reachedAtStep == null) return false
    return s.result.reachedAtStep < step
  }).length

  return (
    <div className="evo-maze-animation">
      <div className="evo-maze-animation__header">
        <span title="N&uacute;mero de generaci&oacute;n que se est&aacute; animando"><strong>Gen:</strong> {generation}</span>
        <span title="Paso actual de la animaci&oacute;n. Cada paso es un movimiento (arriba/derecha/abajo/izquierda) de todos los individuos."><strong>Paso:</strong> {step + 1} / {maxSteps}</span>
        <span title="Cu&aacute;ntos individuos ya alcanzaron la meta hasta este paso"><strong>Llegaron:</strong> {reachedCount} / {individuals.length}</span>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="evo-maze-replay"
        style={{ maxHeight: 400 }}
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
          cx={maze.start[1] * cellSize + cellSize / 2}
          cy={maze.start[0] * cellSize + cellSize / 2}
          r={0.25}
          fill={START_COLOR}
          opacity={0.6}
        />

        {/* Goal marker */}
        <circle
          cx={maze.goal[1] * cellSize + cellSize / 2}
          cy={maze.goal[0] * cellSize + cellSize / 2}
          r={0.25}
          fill={GOAL_COLOR}
          opacity={0.6}
        />

        {/* Trails + dots for each individual */}
        {sims.map((sim, i) => {
          const path = sim.result.path
          const currentStep = Math.min(step, path.length - 1)
          const isBest = sim.fitness === bestFitness
          const hasReached = sim.result.reached && sim.result.reachedAtStep != null && sim.result.reachedAtStep < step

          // Trail: draw path up to current step
          const trailPoints = path
            .slice(0, currentStep + 1)
            .map(([r, c]) => `${c * cellSize + cellSize / 2},${r * cellSize + cellSize / 2}`)
            .join(' ')

          const pos = path[currentStep]
          const cx = pos[1] * cellSize + cellSize / 2
          const cy = pos[0] * cellSize + cellSize / 2

          const color = hasReached ? DOT_REACHED : isBest ? DOT_BEST : DOT_NORMAL

          return (
            <g key={i} opacity={hasReached ? 0.5 : 0.85}>
              {trailPoints && (
                <polyline
                  points={trailPoints}
                  fill="none"
                  stroke={TRAIL_COLOR}
                  strokeWidth={trailWidth}
                  strokeLinecap="round"
                  opacity={0.25}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={isBest ? dotR * 1.3 : dotR}
                fill={color}
                stroke={isBest ? '#fff' : 'none'}
                strokeWidth={isBest ? 0.05 : 0}
              />
            </g>
          )
        })}
      </svg>

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
        <label className="evo-maze-animation__speed" title="Controla la velocidad de la animaci&oacute;n. M&aacute;s a la derecha = m&aacute;s r&aacute;pido.">
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
        Cada punto es un individuo movi&eacute;ndose por el laberinto. Los puntos celestes son el mejor, los verdes ya llegaron a la meta.
      </p>
    </div>
  )
}
