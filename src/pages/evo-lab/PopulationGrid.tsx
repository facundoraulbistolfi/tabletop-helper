import type { Individual, Genome } from '../../lib/genetic-lab/types'

type Props = {
  individuals: Individual[]
  target?: Genome
  bestId: number | null
  selectedId: number | null
  onSelect: (id: number) => void
  genomeLength: number
}

function gridSize(genomeLength: number): number {
  return Math.ceil(Math.sqrt(genomeLength))
}

function BitGrid({ genome, size, highlight }: { genome: Genome; size: number; highlight?: string }) {
  const cellPx = Math.max(2, Math.min(6, Math.floor(48 / size)))
  const totalPx = size * cellPx

  return (
    <svg
      width={totalPx}
      height={totalPx}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        border: highlight ? `2px solid ${highlight}` : '1px solid var(--evo-grid-border, #444)',
        borderRadius: 2,
        display: 'block',
      }}
    >
      {Array.from(genome).map((val, i) => {
        const x = i % size
        const y = Math.floor(i / size)
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={1}
            height={1}
            fill={val ? 'var(--evo-bit-on, #7c4dff)' : 'var(--evo-bit-off, #1a1a2e)'}
          />
        )
      })}
    </svg>
  )
}

export default function PopulationGrid({
  individuals,
  target,
  bestId,
  selectedId,
  onSelect,
  genomeLength,
}: Props) {
  const size = gridSize(genomeLength)

  return (
    <div className="evo-population">
      {target && (
        <div className="evo-population__target">
          <span className="evo-population__label">Objetivo</span>
          <BitGrid genome={target} size={size} highlight="#ffd34c" />
        </div>
      )}

      {bestId !== null && (
        <div className="evo-population__target">
          <span className="evo-population__label">Mejor</span>
          <BitGrid
            genome={individuals.find(i => i.id === bestId)?.genome ?? new Uint8Array(genomeLength)}
            size={size}
            highlight="#4caf50"
          />
        </div>
      )}

      <div className="evo-population__grid">
        {individuals.map(ind => (
          <button
            key={ind.id}
            type="button"
            className={`evo-population__cell${ind.id === selectedId ? ' is-selected' : ''}${ind.id === bestId ? ' is-best' : ''}`}
            onClick={() => onSelect(ind.id)}
            title={`#${ind.id} fitness: ${ind.fitness}`}
          >
            <BitGrid
              genome={ind.genome}
              size={size}
              highlight={ind.id === selectedId ? '#53f4ff' : ind.id === bestId ? '#4caf50' : undefined}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
