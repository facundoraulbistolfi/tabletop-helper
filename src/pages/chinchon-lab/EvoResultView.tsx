import { buildBotFromConfig, type BotConfig } from '../../lib/chinchon-bot-presets'
import { explainGeneChange, getChangedGeneRows, type StopReason } from '../../lib/chinchon-evo-lab'
import type { EvoDoneMessage } from '../../lib/chinchon-lab-worker-types'

import EvoGenerationArchive from './EvoGenerationArchive'
import EvoFitnessChart from './EvoFitnessChart'

type Props = {
  result: EvoDoneMessage
  seedConfig: BotConfig
  rivalConfig: BotConfig
  savedBotId: string | null
  onOpenSave: () => void
  onNewEvolution: () => void
  onSimulate: () => void
}

const STOP_REASON_LABELS: Record<StopReason, string> = {
  max_generations: 'Máximo de generaciones',
  absolute_margin: 'Margen absoluto alcanzado',
  target_rate: 'Objetivo alcanzado',
  stagnation: 'Estancamiento',
  cancelled: 'Evolución cancelada',
}

function formatGeneValue(value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

export default function EvoResultView({
  result,
  seedConfig,
  rivalConfig,
  savedBotId,
  onOpenSave,
  onNewEvolution,
  onSimulate,
}: Props) {
  const changedRows = getChangedGeneRows(seedConfig, result.bestConfig)
  const lastHistoryTick = result.fitnessHistory[result.fitnessHistory.length - 1]

  return (
    <div className="lab-workspace">
      <div className="evo-summary-grid">
        <article className="evo-stat-card">
          <div className="evo-stat-card__eyebrow">Resultado</div>
          <strong>{result.stopReason === 'cancelled' ? 'Evolución detenida' : 'Evolución completada'}</strong>
          <span>Razón de parada: {STOP_REASON_LABELS[result.stopReason]}</span>
          <span>Generaciones: {result.totalGenerations} / {lastHistoryTick?.generation ?? result.totalGenerations}</span>
          <span>Cruces espejo evaluados: {Math.round(result.totalEvaluations / 2).toLocaleString('es-AR')}</span>
          <span>Partidas reales: {result.totalEvaluations.toLocaleString('es-AR')}</span>
        </article>

        <article className="evo-stat-card is-highlight">
          <div className="evo-stat-card__eyebrow">Mejor bot encontrado</div>
          <strong>{result.primaryLabel}: {result.bestMetrics.primaryRate.toFixed(1)}%</strong>
          <span>Criterio: {result.primaryLabel}{result.secondaryLabel ? ` > ${result.secondaryLabel}` : ''}</span>
          {result.secondaryLabel ? <span>{result.secondaryLabel}: {result.bestMetrics.secondaryRate.toFixed(1)}%</span> : null}
          <span>Generación encontrada: {result.bestGeneration}</span>
          <span>Variante: {result.bestConfig.emoji} {result.bestConfig.name}</span>
          <span>Contra {rivalConfig.emoji} {rivalConfig.name}</span>
        </article>
      </div>

      <div className="evo-summary-grid">
        <article className="evo-stat-card">
          <div className="evo-stat-card__eyebrow">Partidas</div>
          <strong>{result.bestMetrics.gamesWon} / {result.bestMetrics.gamesPlayed}</strong>
          <span>{result.bestMetrics.gameWinRate.toFixed(1)}% ganadas</span>
        </article>
        <article className="evo-stat-card">
          <div className="evo-stat-card__eyebrow">Rondas Espejo</div>
          <strong>{result.bestMetrics.mirrorRoundsWon} / {result.bestMetrics.mirrorRoundsPlayed}</strong>
          <span>{result.bestMetrics.mirrorRoundRate.toFixed(1)}% ganadas</span>
        </article>
        <article className="evo-stat-card">
          <div className="evo-stat-card__eyebrow">Rondas Totales</div>
          <strong>{result.bestMetrics.roundsWon} / {result.bestMetrics.roundsPlayed}</strong>
          <span>{result.bestMetrics.roundWinRate.toFixed(1)}% ganadas</span>
        </article>
        <article className="evo-stat-card">
          <div className="evo-stat-card__eyebrow">Curiosidades</div>
          <strong>{result.bestMetrics.chinchonWins} chinchones</strong>
          <span>{result.bestMetrics.orphanRoundsPlayed} rondas sin espejo</span>
        </article>
      </div>

      <section className="evo-section">
        <div className="evo-section__header">
          <div>
            <div className="evo-section__eyebrow">Curvas</div>
            <h3>{result.primaryLabel} por generación</h3>
          </div>
        </div>
        <EvoFitnessChart history={result.fitnessHistory} primaryLabel={result.primaryLabel} />
      </section>

      <section className="evo-section">
        <div className="evo-section__header">
          <div>
            <div className="evo-section__eyebrow">Comparación</div>
            <h3>Cambios respecto del bot semilla</h3>
          </div>
          <p>Solo se muestran genes que cambiaron durante la evolución.</p>
        </div>

        {changedRows.length === 0 ? (
          <div className="evo-empty-note">El mejor bot terminó igual al semilla. Probá con más cruces espejo por evaluación o una mutación un poco más alta.</div>
        ) : (
          <div className="evo-diff-table" role="table" aria-label="Comparación entre semilla y bot evolucionado">
            <div className="evo-diff-table__head" role="row">
              <span>Parámetro</span>
              <span>Semilla</span>
              <span>Evolucionado</span>
              <span>Qué cambia</span>
            </div>
            {changedRows.map(row => {
              const before = formatGeneValue(row.before)
              const after = formatGeneValue(row.after)
              const explanation = explainGeneChange(row.path, row.before, row.after)
              const numericDiff =
                typeof row.before === 'number' && typeof row.after === 'number'
                  ? row.after - row.before
                  : 0
              const direction = numericDiff > 0 ? '▲' : numericDiff < 0 ? '▼' : '•'
              const significant = Math.abs(numericDiff) >= 3
              return (
                <div key={row.path} className={`evo-diff-table__row${significant ? ' is-significant' : ''}`} role="row">
                  <span>{row.path}</span>
                  <span>{before}</span>
                  <span>
                    {after} <b>{direction}</b>
                  </span>
                  <span>{explanation}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {result.bestMetrics.primaryRate < 50 ? (
        <div className="evo-warning-note">
          El mejor bot todavía no supera el 50% en la métrica primaria. Probá con más generaciones, más cruces por evaluación o una mutación un poco más agresiva.
        </div>
      ) : null}

      <section className="evo-section">
        <div className="evo-section__header">
          <div>
            <div className="evo-section__eyebrow">Ranking</div>
            <h3>Top 3 individuos</h3>
          </div>
          <p>Hall of fame del run actual, ordenado por el criterio activo.</p>
        </div>
        <div className="evo-top-list">
          {result.topConfigs.map((config, index) => {
            const runtime = buildBotFromConfig(config)
            const metrics = result.topMetrics[index]
            return (
              <article key={`${config.id}-${index}`} className="evo-top-card">
                <div className="evo-top-card__medal">{['🥇', '🥈', '🥉'][index] ?? `#${index + 1}`}</div>
                <div>
                  <strong>{config.emoji} {config.name}</strong>
                  <span>
                    {result.primaryLabel}: {metrics?.primaryRate.toFixed(1) ?? '0.0'}%
                    {result.secondaryLabel ? ` · ${result.secondaryLabel}: ${metrics?.secondaryRate.toFixed(1) ?? '0.0'}%` : ''}
                  </span>
                  <span>
                    Partidas {metrics?.gamesWon ?? 0}/{metrics?.gamesPlayed ?? 0} ·
                    Rondas espejo {metrics?.mirrorRoundsWon ?? 0}/{metrics?.mirrorRoundsPlayed ?? 0} ·
                    Rondas sin espejo {metrics?.orphanRoundsPlayed ?? 0}
                  </span>
                  <span>{runtime?.desc ?? config.description ?? 'Sin descripción adicional'}</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <EvoGenerationArchive
        history={result.generationHistory}
        primaryLabel={result.primaryLabel}
        secondaryLabel={result.secondaryLabel}
        eyebrow="Archivo"
        title="Todas las generaciones"
        description="Cada generación queda disponible con sus individuos, estadísticas y linaje completo."
      />

      <div className="evo-actions">
        <button type="button" className="evo-primary-button" onClick={onOpenSave}>
          {savedBotId ? 'Actualizar bot custom' : 'Guardar como bot custom'}
        </button>
        <button type="button" className="lab-secondary-button" onClick={onNewEvolution}>
          Nueva evolución
        </button>
        <button type="button" className="lab-secondary-button" onClick={onSimulate}>
          Simular vs rival
        </button>
      </div>
    </div>
  )
}
