import type { EvoMetricSummary, EvolutionCandidateProgress } from '../../lib/chinchon-evo-lab'

type Props = {
  individuals: EvolutionCandidateProgress[]
  primaryLabel: string
  secondaryLabel: string | null
  eyebrow?: string
  title?: string
  description?: string
}

const SOURCE_LABELS: Record<EvolutionCandidateProgress['sourceKind'], string> = {
  seed: 'Semilla',
  initial_mutation: 'Mutación inicial',
  elite: 'Elite',
  crossover: 'Cruce',
}

const SOURCE_HINTS: Record<EvolutionCandidateProgress['sourceKind'], string> = {
  seed: 'Es el bot original que arrancó el experimento.',
  initial_mutation: 'Salió de mutar la semilla para poblar la generación inicial.',
  elite: 'Pasó intacto desde la generación anterior por elitismo.',
  crossover: 'Nació del cruce de dos padres y luego pudo mutar.',
}

function compareCandidates(left: EvolutionCandidateProgress, right: EvolutionCandidateProgress) {
  const statusWeight = { done: 2, running: 1, pending: 0 }
  return (
    right.primaryRate - left.primaryRate
    || right.secondaryRate - left.secondaryRate
    || statusWeight[right.status] - statusWeight[left.status]
    || right.progress - left.progress
    || right.gamesPlayed - left.gamesPlayed
    || left.slotIndex - right.slotIndex
  )
}

function getStatusLabel(candidate: EvolutionCandidateProgress) {
  if (candidate.status === 'done' && candidate.stableStop) return 'Estable'
  if (candidate.status === 'done') return 'Listo'
  if (candidate.status === 'running') return 'Corriendo'
  return 'En espera'
}

function formatRate(rate: number) {
  return `${rate.toFixed(1)}%`
}

function formatSource(candidate: EvolutionCandidateProgress) {
  const sourceLabel = SOURCE_LABELS[candidate.sourceKind]
  if (candidate.sourceKind === 'elite' && candidate.parentAId != null) {
    return `${sourceLabel} · viene de ID ${candidate.parentAId}`
  }
  if (candidate.parentAId != null && candidate.parentBId != null) {
    return `${sourceLabel} · padres ${candidate.parentAId} + ${candidate.parentBId}`
  }
  return sourceLabel
}

function renderMetricRows(summary: Pick<EvoMetricSummary, 'gamesWon' | 'gamesPlayed' | 'mirrorRoundsWon' | 'mirrorRoundsPlayed' | 'roundsWon' | 'roundsPlayed' | 'chinchonWins' | 'orphanRoundsPlayed' | 'gameWinRate' | 'mirrorRoundRate' | 'roundWinRate'>) {
  return (
    <div className="evo-candidate-card__stats">
      <span>Partidas {summary.gamesWon}/{summary.gamesPlayed} ({formatRate(summary.gameWinRate)})</span>
      <span>R. espejo {summary.mirrorRoundsWon}/{summary.mirrorRoundsPlayed} ({formatRate(summary.mirrorRoundRate)})</span>
      <span>Rondas {summary.roundsWon}/{summary.roundsPlayed} ({formatRate(summary.roundWinRate)})</span>
      <span>Chinchones {summary.chinchonWins}</span>
      <span>Sin espejo {summary.orphanRoundsPlayed}</span>
    </div>
  )
}

export default function EvoGenerationGrid({
  individuals,
  primaryLabel,
  secondaryLabel,
  eyebrow = 'Generación actual',
  title = 'Seguimiento por individuo',
  description = 'Ordenado de mejor a peor según el criterio activo, con linaje y comparación contra la semilla.',
}: Props) {
  const sorted = [...individuals].sort(compareCandidates)
  const leader = sorted.find(candidate => candidate.status !== 'pending') ?? sorted[0]

  return (
    <section className="evo-section">
      <div className="evo-section__header">
        <div>
          <div className="evo-section__eyebrow">{eyebrow}</div>
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
      </div>
      <div className="evo-candidate-grid">
        {sorted.map((candidate, index) => {
          const isLeader = leader?.slotIndex === candidate.slotIndex
          return (
            <article
              key={`${candidate.generation}-${candidate.slotIndex}-${candidate.id ?? 'pending'}`}
              className={`evo-candidate-card is-${candidate.status}${isLeader ? ' is-leader' : ''}`}
            >
              <div className="evo-candidate-card__top">
                <div>
                  <div className="evo-candidate-card__eyebrow">
                    #{index + 1} · Gen {candidate.generation} · Slot {candidate.slotIndex + 1}
                  </div>
                  <strong>{candidate.emoji} {candidate.name}</strong>
                  <div className="evo-candidate-card__meta">
                    <span>ID {candidate.id ?? 'pendiente'}</span>
                    <span>{formatSource(candidate)}</span>
                  </div>
                </div>
                <span className={`evo-candidate-card__status is-${candidate.status}`}>
                  {getStatusLabel(candidate)}
                </span>
              </div>

              <div className="evo-candidate-card__metrics">
                <span>{primaryLabel}: {formatRate(candidate.primaryRate)}</span>
                {secondaryLabel ? <span>{secondaryLabel}: {formatRate(candidate.secondaryRate)}</span> : null}
              </div>

              <div className="evo-progress-track" aria-label={`Progreso del individuo ${candidate.slotIndex + 1}`}>
                <span
                  className="evo-progress-track__fill"
                  style={{ width: `${candidate.progress}%` }}
                />
              </div>

              <div className="evo-candidate-card__panel">
                <div className="evo-candidate-card__panel-title">Vs rival</div>
                {renderMetricRows({
                  gamesPlayed: candidate.gamesPlayed,
                  gamesWon: candidate.gamesWon,
                  mirrorRoundsPlayed: candidate.mirrorRoundsPlayed,
                  mirrorRoundsWon: candidate.mirrorRoundsWon,
                  roundsPlayed: candidate.roundsPlayed,
                  roundsWon: candidate.roundsWon,
                  chinchonWins: candidate.chinchonWins,
                  orphanRoundsPlayed: candidate.orphanRoundsPlayed,
                  gameWinRate: candidate.gamesPlayed > 0 ? (candidate.gamesWon / candidate.gamesPlayed) * 100 : 0,
                  mirrorRoundRate: candidate.mirrorRoundsPlayed > 0 ? (candidate.mirrorRoundsWon / candidate.mirrorRoundsPlayed) * 100 : 0,
                  roundWinRate: candidate.roundsPlayed > 0 ? (candidate.roundsWon / candidate.roundsPlayed) * 100 : 0,
                })}
              </div>

              {candidate.originalMetrics ? (
                <div className="evo-candidate-card__panel is-muted">
                  <div className="evo-candidate-card__panel-title">Vs semilla / original</div>
                  {renderMetricRows(candidate.originalMetrics)}
                </div>
              ) : null}

              <div className="evo-candidate-card__meta-block">
                <strong>Cómo se creó</strong>
                <span>{SOURCE_HINTS[candidate.sourceKind]}</span>
                {candidate.parentAId != null ? (
                  <span>
                    Padres: {candidate.parentAId}
                    {candidate.parentBId != null ? ` + ${candidate.parentBId}` : ''}
                  </span>
                ) : null}
                <span>
                  Mutaciones: {candidate.mutatedGenes.length > 0 ? candidate.mutatedGenes.join(', ') : 'ninguna'}
                </span>
              </div>

              <small className="evo-candidate-card__hint">
                {candidate.stableStop
                  ? 'Esta evaluación se cortó antes porque la tasa dejó de moverse.'
                  : candidate.status === 'pending'
                    ? 'Todavía no entró al pool de evaluación.'
                    : candidate.status === 'running'
                      ? 'Sigue jugando cruces espejo y su foto se actualiza a medida que avanza.'
                      : 'Terminó su medición para esta generación.'}
              </small>
            </article>
          )
        })}
      </div>
    </section>
  )
}
