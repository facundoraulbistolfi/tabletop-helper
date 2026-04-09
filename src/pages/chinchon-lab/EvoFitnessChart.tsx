import type { EvoMetricsTick } from '../../lib/chinchon-evo-lab'

type Props = {
  history: EvoMetricsTick[]
  primaryLabel: string
}

const WIDTH = 640
const HEIGHT = 260
const PAD_LEFT = 46
const PAD_RIGHT = 12
const PAD_TOP = 16
const PAD_BOTTOM = 30
const REFERENCE_RATE = 50
const MAX_RATE = 100

export default function EvoFitnessChart({ history, primaryLabel }: Props) {
  if (history.length === 0) {
    return (
      <div className="evo-chart evo-chart--empty">
        <p>Sin datos todavía. Iniciá una evolución para ver cómo cambia la población.</p>
      </div>
    )
  }

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const maxGeneration = Math.max(1, history[history.length - 1]?.generation ?? 1)
  const yTicks = [0, 25, 50, 75, 100]
  const xTicks = Math.min(6, history.length)

  function x(generation: number) {
    return PAD_LEFT + (generation / maxGeneration) * plotWidth
  }

  function y(value: number) {
    return PAD_TOP + plotHeight - (value / MAX_RATE) * plotHeight
  }

  function polyline(accessor: (tick: EvoMetricsTick) => number) {
    return history.map(tick => `${x(tick.generation)},${y(accessor(tick))}`).join(' ')
  }

  return (
    <div className="evo-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="evo-chart__svg" role="img" aria-label="Curvas de fitness por generación">
        {yTicks.map(value => {
          const py = y(value)
          const isRival = value === REFERENCE_RATE
          return (
            <g key={value}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={py}
                y2={py}
                stroke={isRival ? '#6b7280' : '#273244'}
                strokeWidth={isRival ? 1.1 : 0.7}
                strokeDasharray={isRival ? '4 3' : undefined}
              />
              <text x={PAD_LEFT - 4} y={py + 4} textAnchor="end" fontSize={10} fill={isRival ? '#cbd5e1' : '#94a3b8'}>
                {value}
              </text>
            </g>
          )
        })}

        {Array.from({ length: xTicks }, (_, index) => {
          const generation = Math.round((maxGeneration / Math.max(1, xTicks - 1)) * index)
          return (
            <text key={generation} x={x(generation)} y={HEIGHT - 6} textAnchor="middle" fontSize={10} fill="#94a3b8">
              {generation}
            </text>
          )
        })}

        <polyline points={polyline(tick => tick.worstPrimaryRate)} fill="none" stroke="#f87171" strokeWidth={1.25} opacity={0.7} />
        <polyline points={polyline(tick => tick.avgPrimaryRate)} fill="none" stroke="#facc15" strokeWidth={1.5} />
        <polyline points={polyline(tick => tick.bestPrimaryRate)} fill="none" stroke="#4ade80" strokeWidth={2} />

        <text x={PAD_LEFT + plotWidth / 2} y={HEIGHT - 1} textAnchor="middle" fontSize={10} fill="#cbd5e1">
          Generación
        </text>
        <text
          x={14}
          y={PAD_TOP + plotHeight / 2}
          textAnchor="middle"
          fontSize={10}
          fill="#cbd5e1"
          transform={`rotate(-90, 14, ${PAD_TOP + plotHeight / 2})`}
        >
          {primaryLabel} (%)
        </text>
      </svg>

      <div className="evo-chart__legend">
        <span className="evo-chart__legend-item is-best">Mejor</span>
        <span className="evo-chart__legend-item is-avg">Promedio</span>
        <span className="evo-chart__legend-item is-worst">Peor</span>
        <span className="evo-chart__legend-item is-rival">Empate (50%)</span>
      </div>
    </div>
  )
}
