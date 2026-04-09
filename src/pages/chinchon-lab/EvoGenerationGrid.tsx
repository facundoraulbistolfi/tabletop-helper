import type { EvolutionCandidateProgress } from '../../lib/chinchon-evo-lab'

type Props = {
  individuals: EvolutionCandidateProgress[]
  primaryLabel: string
  secondaryLabel: string | null
}

function compareCandidates(left: EvolutionCandidateProgress, right: EvolutionCandidateProgress) {
  return (
    right.primaryRate - left.primaryRate
    || right.secondaryRate - left.secondaryRate
    || right.progress - left.progress
    || left.slotIndex - right.slotIndex
  )
}

function getStatusLabel(candidate: EvolutionCandidateProgress) {
  if (candidate.status === 'done' && candidate.stableStop) return 'Estable'
  if (candidate.status === 'done') return 'Listo'
  if (candidate.status === 'running') return 'Corriendo'
  return 'En espera'
}

export default function EvoGenerationGrid({ individuals, primaryLabel, secondaryLabel }: Props) {
  const sorted = [...individuals].sort((left, right) => left.slotIndex - right.slotIndex)
  const visibleCandidates = sorted.filter(candidate => candidate.status !== 'pending' || candidate.slotIndex < 3)
  const leader = sorted
    .filter(candidate => candidate.status !== 'pending')
    .sort(compareCandidates)[0]

  return (
    <section className="evo-section">
      <div className="evo-section__header">
        <div>
          <div className="evo-section__eyebrow">Generación actual</div>
          <h3>Seguimiento por individuo</h3>
        </div>
        <p>Vista resumida y throttled: muestra el avance sin mandar un update por cada cruce espejo.</p>
      </div>
      <div className="evo-candidate-grid">
        {visibleCandidates.map(candidate => {
          const isLeader = leader?.slotIndex === candidate.slotIndex
          const mirrorPairsPlayed = Math.round(candidate.gamesPlayed / 2)
          return (
            <article
              key={`${candidate.slotIndex}-${candidate.name}`}
              className={`evo-candidate-card is-${candidate.status}${isLeader ? ' is-leader' : ''}`}
            >
              <div className="evo-candidate-card__top">
                <div>
                  <div className="evo-candidate-card__eyebrow">Individuo {candidate.slotIndex + 1}</div>
                  <strong>{candidate.emoji} {candidate.name}</strong>
                </div>
                <span className={`evo-candidate-card__status is-${candidate.status}`}>
                  {getStatusLabel(candidate)}
                </span>
              </div>

              <div className="evo-candidate-card__metrics">
                <span>{primaryLabel}: {candidate.primaryRate.toFixed(1)}%</span>
                {secondaryLabel ? <span>{secondaryLabel}: {candidate.secondaryRate.toFixed(1)}%</span> : null}
              </div>

              <div className="evo-progress-track" aria-label={`Progreso del individuo ${candidate.slotIndex + 1}`}>
                <span
                  className="evo-progress-track__fill"
                  style={{ width: `${candidate.progress}%` }}
                />
              </div>

              <div className="evo-candidate-card__metrics">
                <span>{mirrorPairsPlayed.toLocaleString('es-AR')} cruces espejo</span>
                <span>{candidate.gamesPlayed.toLocaleString('es-AR')} partidas</span>
              </div>

              <div className="evo-candidate-card__metrics">
                <span>Partidas {candidate.gamesWon}/{candidate.gamesPlayed}</span>
                <span>R. espejo {candidate.mirrorRoundsWon}/{candidate.mirrorRoundsPlayed}</span>
              </div>

              <small className="evo-candidate-card__hint">
                {candidate.stableStop
                  ? 'Esta evaluación se cortó antes porque la tasa dejó de moverse.'
                  : candidate.status === 'pending'
                    ? 'Todavía no entró al pool de evaluación.'
                    : candidate.status === 'running'
                      ? 'Sigue jugando cruces espejo contra el rival.'
                      : 'Terminó su medición en esta generación.'}
              </small>
            </article>
          )
        })}
      </div>
    </section>
  )
}
