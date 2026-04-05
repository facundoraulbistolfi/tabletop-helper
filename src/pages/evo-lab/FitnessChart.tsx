import type { MetricsTick } from '../../lib/genetic-lab/types'

type Props = {
  history: MetricsTick[]
  maxFitness: number
}

export default function FitnessChart({ history, maxFitness }: Props) {
  if (history.length === 0) {
    return (
      <div className="evo-chart evo-chart--empty">
        <p>Sin datos. Inicia un experimento para ver las curvas de fitness.</p>
      </div>
    )
  }

  const width = 600
  const height = 260
  const padLeft = 45
  const padRight = 10
  const padTop = 15
  const padBottom = 30

  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const maxGen = history[history.length - 1].generation || 1
  const yMax = maxFitness || 1

  function x(gen: number) {
    return padLeft + (gen / maxGen) * plotW
  }
  function y(val: number) {
    return padTop + plotH - (val / yMax) * plotH
  }

  function polyline(accessor: (t: MetricsTick) => number): string {
    return history.map(t => `${x(t.generation)},${y(accessor(t))}`).join(' ')
  }

  const yTicks = 5
  const xTicks = Math.min(history.length, 6)

  return (
    <div className="evo-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="evo-chart__svg">
        {/* Y axis grid & labels */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const val = (yMax / yTicks) * i
          const py = y(val)
          return (
            <g key={`y${i}`}>
              <line x1={padLeft} x2={width - padRight} y1={py} y2={py} stroke="#333" strokeWidth={0.5} />
              <text x={padLeft - 4} y={py + 4} textAnchor="end" fontSize={10} fill="#888">
                {Math.round(val)}
              </text>
            </g>
          )
        })}

        {/* X axis labels */}
        {Array.from({ length: xTicks }, (_, i) => {
          const gen = Math.round((maxGen / (xTicks - 1)) * i)
          return (
            <text key={`x${i}`} x={x(gen)} y={height - 5} textAnchor="middle" fontSize={10} fill="#888">
              {gen}
            </text>
          )
        })}

        {/* Lines */}
        <polyline points={polyline(t => t.worst)} fill="none" stroke="#ef5350" strokeWidth={1.2} opacity={0.5} />
        <polyline points={polyline(t => t.avg)} fill="none" stroke="#ffd34c" strokeWidth={1.5} />
        <polyline points={polyline(t => t.best)} fill="none" stroke="#4caf50" strokeWidth={2} />

        {/* Axis labels */}
        <text x={padLeft + plotW / 2} y={height - 1} textAnchor="middle" fontSize={10} fill="#aaa">
          Generación
        </text>
        <text x={12} y={padTop + plotH / 2} textAnchor="middle" fontSize={10} fill="#aaa" transform={`rotate(-90, 12, ${padTop + plotH / 2})`}>
          Fitness
        </text>
      </svg>

      <div className="evo-chart__legend">
        <span style={{ color: '#4caf50' }}>Mejor</span>
        <span style={{ color: '#ffd34c' }}>Promedio</span>
        <span style={{ color: '#ef5350' }}>Peor</span>
      </div>
    </div>
  )
}
