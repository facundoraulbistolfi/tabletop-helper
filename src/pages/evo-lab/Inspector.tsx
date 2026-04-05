import type { Individual, Genome } from '../../lib/genetic-lab/types'

type Props = {
  individual: Individual | null
  target?: Genome
  onClose: () => void
}

export default function Inspector({ individual, target, onClose }: Props) {
  if (!individual) return null

  const matchCount = target
    ? Array.from(individual.genome).filter((v, i) => v === target[i]).length
    : null

  return (
    <div className="evo-inspector">
      <div className="evo-inspector__header">
        <h3>Individuo #{individual.id}</h3>
        <button type="button" className="lab-tab" onClick={onClose}>Cerrar</button>
      </div>

      <div className="evo-inspector__stats">
        <div><strong>Fitness:</strong> {individual.fitness}</div>
        {matchCount !== null && target && (
          <div><strong>Match:</strong> {matchCount} / {target.length} ({(matchCount / target.length * 100).toFixed(1)}%)</div>
        )}
      </div>

      {individual.meta && (
        <div className="evo-inspector__meta">
          {individual.meta.parentAId !== undefined && (
            <div><strong>Padres:</strong> #{individual.meta.parentAId} + #{individual.meta.parentBId}</div>
          )}
          {individual.meta.crossoverPoints && individual.meta.crossoverPoints.length > 0 && (
            <div><strong>Puntos de cruce:</strong> {individual.meta.crossoverPoints.join(', ')}</div>
          )}
          {individual.meta.mutatedGenes && individual.meta.mutatedGenes.length > 0 && (
            <div><strong>Genes mutados:</strong> {individual.meta.mutatedGenes.length} ({individual.meta.mutatedGenes.slice(0, 10).join(', ')}{individual.meta.mutatedGenes.length > 10 ? '...' : ''})</div>
          )}
        </div>
      )}

      {target && (
        <div className="evo-inspector__diff">
          <strong>Diff vs objetivo:</strong>
          <div className="evo-inspector__genome">
            {Array.from(individual.genome).map((val, i) => {
              const match = val === target[i]
              return (
                <span
                  key={i}
                  className={`evo-inspector__gene${match ? ' is-match' : ' is-miss'}`}
                >
                  {val}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
