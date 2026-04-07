import { useMemo } from 'react'
import type { Individual } from '../../lib/genetic-lab/types'
import type { MazePreset } from '../../lib/genetic-lab/maze-runner-types'
import { decodeMoves, simulateMazeRunner, manhattan } from '../../lib/genetic-lab/maze-runner'
import MazeReplay from './MazeReplay'

type Props = {
  individuals: Individual[]
  maze: MazePreset
  generation: number
  bestId: number | null
  selectedId: number | null
  onSelect: (id: number) => void
}

type IndividualSim = {
  individual: Individual
  result: ReturnType<typeof simulateMazeRunner>
  distance: number
}

export default function MazePopulationView({
  individuals,
  maze,
  generation,
  bestId,
  selectedId,
  onSelect,
}: Props) {
  // Simulate all individuals (memoized by generation to avoid re-computing on re-render)
  const sims: IndividualSim[] = useMemo(() => {
    return individuals.map(ind => {
      const moves = decodeMoves(ind.genome)
      const result = simulateMazeRunner(moves, maze)
      return {
        individual: ind,
        result,
        distance: manhattan(result.finalPos, maze.goal),
      }
    })
  }, [individuals, maze])

  const bestSim = sims.find(s => s.individual.id === (selectedId ?? bestId))
  const reachedCount = sims.filter(s => s.result.reached).length
  const reachedPct = individuals.length > 0 ? ((reachedCount / individuals.length) * 100).toFixed(1) : '0'
  const avgDist = individuals.length > 0
    ? (sims.reduce((sum, s) => sum + s.distance, 0) / individuals.length).toFixed(1)
    : '—'
  const bestFitness = individuals.length > 0
    ? Math.max(...individuals.map(i => i.fitness))
    : 0

  return (
    <div className="evo-maze-population">
      {/* ── Header summary ── */}
      <div className="evo-maze-population__header">
        <span><strong>Maze:</strong> {maze.name}</span>
        <span><strong>Gen:</strong> {generation}</span>
        <span><strong>Mejor:</strong> {bestFitness}</span>
        <span><strong>Llegan:</strong> {reachedPct}%</span>
        <span><strong>Dist. prom:</strong> {avgDist}</span>
      </div>

      {/* ── Didactic panel ── */}
      <details className="evo-maze-didactic" open>
        <summary>Qu&eacute; estoy viendo?</summary>
        <ul>
          <li>Cada individuo es una secuencia de movimientos codificada en binario (2 bits por paso).</li>
          <li>El fitness sube si se acerca a la meta o llega m&aacute;s r&aacute;pido.</li>
          <li>Observ&aacute; si la poblaci&oacute;n deja de chocar paredes y empieza a encontrar rutas &uacute;tiles.</li>
          <li>La selecci&oacute;n favorece individuos con mejor fitness; el cruce combina rutas de dos padres.</li>
        </ul>
      </details>

      {/* ── Main replay of selected/best individual ── */}
      {bestSim && (
        <div className="evo-maze-population__main">
          <div className="evo-maze-population__main-label">
            {selectedId !== null ? `Individuo #${selectedId}` : 'Mejor individuo'}
            {' — '}
            <span style={{ color: bestSim.result.reached ? '#4caf50' : '#ef5350' }}>
              {bestSim.result.reached ? 'Lleg\u00f3' : `Dist: ${bestSim.distance}`}
            </span>
            {' — Fitness: '}{bestSim.individual.fitness}
          </div>
          <MazeReplay maze={maze} result={bestSim.result} />
        </div>
      )}

      {/* ── Population mini-card grid ── */}
      <div className="evo-maze-population__grid">
        {sims.map(({ individual: ind, result, distance }) => {
          const isSelected = ind.id === selectedId
          const isBest = ind.id === bestId
          return (
            <button
              key={ind.id}
              type="button"
              className={
                'evo-maze-card'
                + (isSelected ? ' is-selected' : '')
                + (isBest ? ' is-best' : '')
                + (result.reached ? ' is-reached' : '')
              }
              onClick={() => onSelect(ind.id)}
              title={`#${ind.id} fitness: ${ind.fitness}`}
            >
              <MazeReplay maze={maze} result={result} mini highlight={
                isSelected ? '#53f4ff' : isBest ? '#4caf50' : undefined
              } />
              <div className="evo-maze-card__info">
                <span className="evo-maze-card__fitness">{ind.fitness}</span>
                <span className={`evo-maze-card__status ${result.reached ? 'is-ok' : 'is-miss'}`}>
                  {result.reached ? '\u2713' : distance.toString()}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
