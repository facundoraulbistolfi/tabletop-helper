import type { Individual } from '../../lib/genetic-lab/types'
import type { MazePreset, SimulationResult } from '../../lib/genetic-lab/maze-runner-types'
import { decodeMoves, simulateMazeRunner, manhattan, MOVE_ARROWS, describeMazeResultFull } from '../../lib/genetic-lab/maze-runner'
import MazeReplay from './MazeReplay'

type Props = {
  individual: Individual | null
  maze: MazePreset
  maxSteps: number
  onClose: () => void
}

export default function MazeInspectorDetails({ individual, maze, maxSteps, onClose }: Props) {
  if (!individual) return null

  const moves = decodeMoves(individual.genome)
  const result: SimulationResult = simulateMazeRunner(moves, maze)
  const dist = manhattan(result.finalPos, maze.goal)
  const description = describeMazeResultFull(result, maze, maxSteps)

  // Format moves as arrows (show first 60, truncate if longer)
  const arrowStr = moves.map(m => MOVE_ARROWS[m]).join('')
  const displayArrows = arrowStr.length > 60
    ? arrowStr.slice(0, 60) + '\u2026'
    : arrowStr

  return (
    <div className="evo-inspector">
      <div className="evo-inspector__header">
        <h3>Individuo #{individual.id}</h3>
        <button type="button" className="lab-tab" onClick={onClose}>Cerrar</button>
      </div>

      {/* Replay */}
      <div className="evo-maze-inspector__replay">
        <MazeReplay maze={maze} result={result} />
      </div>

      {/* Didactic description */}
      <p className="evo-maze-inspector__desc">{description}</p>

      {/* Stats */}
      <div className="evo-inspector__stats">
        <div><strong>Fitness:</strong> {individual.fitness}</div>
        <div>
          <strong>Meta:</strong>{' '}
          <span style={{ color: result.reached ? '#4caf50' : '#ef5350' }}>
            {result.reached ? `S\u00ed (paso ${result.reachedAtStep! + 1})` : 'No'}
          </span>
        </div>
        {!result.reached && (
          <div><strong>Distancia final:</strong> {dist} celdas</div>
        )}
        <div><strong>Choques con pared:</strong> {result.wallHits}</div>
        <div><strong>Celdas \u00fanicas:</strong> {result.uniqueCells}</div>
        <div><strong>Pasos totales:</strong> {result.totalSteps} / {maxSteps}</div>
      </div>

      {/* Move sequence */}
      <div className="evo-maze-inspector__moves">
        <strong>Movimientos:</strong>
        <div className="evo-maze-inspector__arrows">{displayArrows}</div>
      </div>

      {/* Genetic metadata */}
      {individual.meta && (
        <div className="evo-inspector__meta">
          {individual.meta.parentAId !== undefined && (
            <div><strong>Padres:</strong> #{individual.meta.parentAId} + #{individual.meta.parentBId}</div>
          )}
          {individual.meta.crossoverPoints && individual.meta.crossoverPoints.length > 0 && (
            <div><strong>Puntos de cruce:</strong> {individual.meta.crossoverPoints.join(', ')}</div>
          )}
          {individual.meta.mutatedGenes && individual.meta.mutatedGenes.length > 0 && (
            <div>
              <strong>Genes mutados:</strong> {individual.meta.mutatedGenes.length}
              {' '}({individual.meta.mutatedGenes.slice(0, 10).join(', ')}
              {individual.meta.mutatedGenes.length > 10 ? '...' : ''})
            </div>
          )}
        </div>
      )}
    </div>
  )
}
