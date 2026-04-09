import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import {
  createBotCatalog,
  getBotConfig,
  type BotConfig,
} from '../../lib/chinchon-bot-presets'
import {
  MIN_SIMULATIONS_BEFORE_STABLE_STOP,
  STABLE_SIMULATION_STREAK,
} from '../../lib/chinchon-sim-metrics'
import {
  buildEvolutionDescription,
  defaultEvoConfig,
  getFitnessModeDescriptor,
  type EvoConfig,
  type EvolutionGenerationRecord,
  type FitnessMode,
} from '../../lib/chinchon-evo-lab'
import type {
  EvoDoneMessage,
  EvoProgressMessage,
} from '../../lib/chinchon-lab-worker-types'

import { LabAccordionSection, LabPanel, StickyActionBar } from './Layout'
import EvoResultView from './EvoResultView'
import EvoSaveModal, { type EvoSaveOutcome } from './EvoSaveModal'
import EvoFitnessChart from './EvoFitnessChart'
import EvoGenerationArchive from './EvoGenerationArchive'
import EvoGenerationGrid from './EvoGenerationGrid'

const COUNT_FORMATTER = new Intl.NumberFormat('es-AR')
const EVO_GAMES_PER_EVAL_OPTIONS = [20, 100, 200, 1000, 2000, 10000, 20000, 100000, 200000]

type SaveDraft = {
  name: string
  emoji: string
  description: string
  replaceExisting: boolean
}

type Props = {
  customConfigs: BotConfig[]
  config: EvoConfig
  running: boolean
  progress: EvoProgressMessage | null
  result: EvoDoneMessage | null
  generationHistory: EvolutionGenerationRecord[]
  savedBotId: string | null
  onConfigChange: (config: EvoConfig) => void
  onStart: () => void
  onStop: () => void
  onNewEvolution: () => void
  onSaveBot: (draft: SaveDraft) => EvoSaveOutcome
  onSimulate: () => void
}

type SliderFieldProps = {
  label: string
  help: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  formatter?: (value: number) => string
  onChange: (value: number) => void
}

function SliderField({
  label,
  help,
  value,
  min,
  max,
  step = 1,
  disabled,
  formatter = input => `${input}`,
  onChange,
}: SliderFieldProps) {
  return (
    <label className="evo-slider-field">
      <span className="evo-slider-field__head">
        <strong>{label}</strong>
        <b>{formatter(value)}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
      />
      <small>{help}</small>
    </label>
  )
}

function SelectField({
  label,
  value,
  disabled,
  onChange,
  children,
}: {
  label: string
  value: string | number
  disabled?: boolean
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="evo-field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  )
}

function StopToggle({
  checked,
  label,
  help,
  disabled,
  children,
  onChange,
}: {
  checked: boolean
  label: string
  help: string
  disabled?: boolean
  children?: ReactNode
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="evo-toggle-card">
      <label className="evo-toggle-card__head">
        <span>
          <strong>{label}</strong>
          <small>{help}</small>
        </span>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      </label>
      {checked ? <div className="evo-toggle-card__body">{children}</div> : null}
    </div>
  )
}

function getSelectionHelp(method: EvoConfig['selectionMethod'], tournamentK: number) {
  if (method === 'tournament') {
    return `Torneo: se sortean ${tournamentK} candidatos y se reproduce el mejor. Más alto = más presión para copiar a los fuertes.`
  }

  return 'Ruleta: todos pueden reproducirse, pero los que tienen mejor fitness salen favorecidos por probabilidad.'
}

const FITNESS_MODE_OPTIONS: Array<{ value: FitnessMode; label: string }> = [
  { value: 'mirror_rounds_only', label: 'Sólo Rondas Espejo' },
  { value: 'games_only', label: 'Sólo Partidas' },
  { value: 'mirror_rounds_then_games', label: '1ro Rondas Espejo / 2do Partidas' },
  { value: 'games_then_mirror_rounds', label: '1ro Partidas / 2do Rondas Espejo' },
]

function formatCount(value: number) {
  return COUNT_FORMATTER.format(value)
}

export default function EvoTab({
  customConfigs,
  config,
  running,
  progress,
  result,
  generationHistory,
  savedBotId,
  onConfigChange,
  onStart,
  onStop,
  onNewEvolution,
  onSaveBot,
  onSimulate,
}: Props) {
  const catalog = useMemo(() => createBotCatalog(customConfigs), [customConfigs])
  const rivalConfig = getBotConfig(config.rivalBotIndex, customConfigs)
  const seedConfig = getBotConfig(config.seedBotIndex, customConfigs)
  const sameBot = config.rivalBotIndex === config.seedBotIndex
  const fitnessDescriptor = getFitnessModeDescriptor(config.fitnessMode)
  const progressDescriptor = getFitnessModeDescriptor(progress?.fitnessMode ?? config.fitnessMode)
  const deferredGenerationIndividuals = useDeferredValue(progress?.generationIndividuals ?? [])
  const gamesPerEval = config.simsPerEval * 2
  const gamesPerEvalOptions = useMemo(
    () => [...new Set([defaultEvoConfig.simsPerEval * 2, gamesPerEval, ...EVO_GAMES_PER_EVAL_OPTIONS])].sort((left, right) => left - right),
    [gamesPerEval],
  )
  const estimatedGamesPerGeneration = config.populationSize * gamesPerEval
  const estimatedGamesPerFullRun = estimatedGamesPerGeneration * config.maxGenerations

  const [saveOpen, setSaveOpen] = useState(false)

  useEffect(() => {
    if (!result) setSaveOpen(false)
  }, [result])

  const saveDefaults = useMemo(() => {
    const bestPrimaryRate = result?.bestMetrics.primaryRate ?? 0
    const bestSecondaryRate = result?.bestMetrics.secondaryRate ?? 0
    const generations = result?.totalGenerations ?? 0
    return {
      name: `Evo vs ${rivalConfig.name}`.slice(0, 12),
      emoji: '🧬',
      description: buildEvolutionDescription(
        rivalConfig.name,
        result?.fitnessMode ?? config.fitnessMode,
        bestPrimaryRate,
        bestSecondaryRate,
        generations,
      ),
    }
  }, [config.fitnessMode, result?.bestMetrics.primaryRate, result?.bestMetrics.secondaryRate, result?.fitnessMode, result?.totalGenerations, rivalConfig.name])

  function update<K extends keyof EvoConfig>(key: K, value: EvoConfig[K]) {
    onConfigChange({ ...config, [key]: value })
  }

  function handleRivalChange(nextValue: string) {
    const nextIndex = Number(nextValue)
    onConfigChange({
      ...config,
      rivalBotIndex: nextIndex,
      seedBotIndex: sameBot ? nextIndex : config.seedBotIndex,
    })
  }

  function handleSameBotToggle(checked: boolean) {
    if (checked) {
      update('seedBotIndex', config.rivalBotIndex)
      return
    }

    const fallbackSeedIndex = catalog.findIndex((_, index) => index !== config.rivalBotIndex)
    if (fallbackSeedIndex >= 0) {
      update('seedBotIndex', fallbackSeedIndex)
    }
  }

  function handleSave(draft: SaveDraft) {
    return onSaveBot(draft)
  }

  return (
    <>
      <LabPanel
        title="Evolución"
        subtitle="Evolucioná un bot para que supere a un rival usando algoritmos genéticos y seguí la mejora en tiempo real."
      >
        {result ? (
          <EvoResultView
            result={result}
            seedConfig={seedConfig}
            rivalConfig={rivalConfig}
            savedBotId={savedBotId}
            onOpenSave={() => setSaveOpen(true)}
            onNewEvolution={onNewEvolution}
            onSimulate={() => {
              if (!savedBotId) {
                setSaveOpen(true)
                return
              }
              onSimulate()
            }}
          />
        ) : running ? (
          <div className="lab-workspace">
            <div className="evo-summary-grid">
              <article className="evo-stat-card is-highlight">
                <div className="evo-stat-card__eyebrow">Progreso</div>
                <strong>Generación {progress?.generation ?? 0} / {config.maxGenerations}</strong>
                <span>{progress?.evaluatedIndividuals ?? 0} / {progress?.populationSize ?? config.populationSize} individuos evaluados</span>
                <div className="evo-progress-track" aria-label="Progreso de la generación actual">
                  <span
                    className="evo-progress-track__fill"
                    style={{ width: `${progress?.generationProgress ?? 0}%` }}
                  />
                </div>
                <span>{progress?.generationProgress ?? 0}% de la generación actual</span>
                <span>Cruces espejo evaluados: {Math.round((progress?.totalEvaluations ?? 0) / 2).toLocaleString('es-AR')}</span>
                <span>Partidas reales: {(progress?.totalEvaluations ?? 0).toLocaleString('es-AR')}</span>
              </article>

              <article className="evo-stat-card">
                <div className="evo-stat-card__eyebrow">Mejor actual</div>
                <strong>{progress?.primaryLabel ?? progressDescriptor.primaryLabel}: {(progress?.bestPrimaryRate ?? 0).toFixed(1)}%</strong>
                {progress?.secondaryLabel ? (
                  <span>{progress.secondaryLabel}: {(progress?.bestSecondaryRate ?? 0).toFixed(1)}%</span>
                ) : (
                  <span>Sin desempate secundario activo</span>
                )}
                <span>Partidas: {progress?.bestMetrics.gamesWon ?? 0} / {progress?.bestMetrics.gamesPlayed ?? 0}</span>
                <span>Rondas espejo: {progress?.bestMetrics.mirrorRoundsWon ?? 0} / {progress?.bestMetrics.mirrorRoundsPlayed ?? 0}</span>
                <span>Encontrado en generación {progress?.bestGeneration ?? 0}</span>
              </article>
            </div>

            <section className="evo-section">
              <div className="evo-section__header">
                <div>
                  <div className="evo-section__eyebrow">Curvas</div>
                  <h3>Evolucionando contra {rivalConfig.emoji} {rivalConfig.name}</h3>
                </div>
                <p>El gráfico sigue la métrica primaria del criterio activo, con línea de referencia en el 50%.</p>
              </div>
              <EvoFitnessChart history={progress?.fitnessHistory ?? []} primaryLabel={progress?.primaryLabel ?? progressDescriptor.primaryLabel} />
            </section>

            <EvoGenerationGrid
              individuals={deferredGenerationIndividuals}
              primaryLabel={progress?.primaryLabel ?? progressDescriptor.primaryLabel}
              secondaryLabel={progress?.secondaryLabel ?? progressDescriptor.secondaryLabel}
            />

            <EvoGenerationArchive
              history={generationHistory}
              primaryLabel={progress?.primaryLabel ?? progressDescriptor.primaryLabel}
              secondaryLabel={progress?.secondaryLabel ?? progressDescriptor.secondaryLabel}
              eyebrow="Archivo parcial"
              title="Generaciones ya cerradas"
              description="Mientras la evolución sigue corriendo, acá quedan las generaciones que ya se completaron."
            />

            <StickyActionBar>
              <button type="button" className="evo-danger-button" onClick={onStop}>
                Detener evolución
              </button>
            </StickyActionBar>
          </div>
        ) : (
          <div className="lab-workspace">
            <section className="evo-config-hero">
              <div className="evo-config-hero__copy">
                <div className="evo-section__eyebrow">Setup</div>
                <h3>Elegí el rival, definí el semilla y ajustá el laboratorio.</h3>
                <p>
                  El algoritmo genera variantes del bot semilla, las enfrenta en partidas espejo contra el rival y se queda
                  con las configuraciones que mejor rinden.
                </p>
              </div>
              <div className="evo-config-hero__facts">
                <span>Población default: {defaultEvoConfig.populationSize}</span>
                <span>Partidas / eval: {formatCount(defaultEvoConfig.simsPerEval * 2)}</span>
                <span>Default: {getFitnessModeDescriptor(defaultEvoConfig.fitnessMode).shortLabel}</span>
                <span>Target: {defaultEvoConfig.targetRate}% {fitnessDescriptor.primaryLabel.toLowerCase()}</span>
              </div>
            </section>

            <LabAccordionSection title="Bots" subtitle="Rival a superar y semilla de partida" defaultOpen>
              <div className="evo-card-grid">
                <SelectField label="Bot rival (a superar)" value={config.rivalBotIndex} disabled={running} onChange={handleRivalChange}>
                  {catalog.map((bot, index) => (
                    <option key={bot.id} value={index}>
                      {bot.emoji} {bot.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Bot semilla"
                  value={config.seedBotIndex}
                  disabled={running || sameBot}
                  onChange={value => update('seedBotIndex', Number(value))}
                >
                  {catalog.map((bot, index) => (
                    <option key={bot.id} value={index}>
                      {bot.emoji} {bot.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <label className="evo-inline-check">
                <input type="checkbox" checked={sameBot} disabled={running} onChange={event => handleSameBotToggle(event.target.checked)} />
                <span>Usar el mismo bot como rival y semilla</span>
              </label>
              <div className="evo-bot-duel">
                <article className="evo-bot-card" style={{ '--evo-accent': rivalConfig.color ?? '#34d399' } as CSSProperties}>
                  <div className="evo-bot-card__role">Rival</div>
                  <strong>{rivalConfig.emoji} {rivalConfig.name}</strong>
                  <p>{rivalConfig.description || 'Bot seleccionado como objetivo a superar.'}</p>
                </article>
                <article className="evo-bot-card" style={{ '--evo-accent': seedConfig.color ?? '#60a5fa' } as CSSProperties}>
                  <div className="evo-bot-card__role">Semilla</div>
                  <strong>{seedConfig.emoji} {seedConfig.name}</strong>
                  <p>{seedConfig.description || 'Punto de partida de la población inicial.'}</p>
                </article>
              </div>
            </LabAccordionSection>

            <LabAccordionSection title="Población y evaluación" subtitle="Tamaño del pool y costo de cada generación" defaultOpen>
              <div className="evo-static-note">
                Acá conviene priorizar pocas variantes y muchísimos cruces espejo por bot.
                <strong>El criterio de fitness es configurable</strong>: podés ordenar por partidas, por rondas espejo o por una prioridad lexicográfica entre ambas.
              </div>
              <div className="evo-card-grid">
                <SelectField
                  label="Criterio de fitness"
                  value={config.fitnessMode}
                  disabled={running}
                  onChange={value => update('fitnessMode', value as FitnessMode)}
                >
                  {FITNESS_MODE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <SliderField
                  label="Población"
                  help="Cantidad de variantes por generación. Está capada a 10 para privilegiar más cruces espejo por individuo."
                  min={4}
                  max={10}
                  value={config.populationSize}
                  disabled={running}
                  onChange={value => update('populationSize', value)}
                />
                <SelectField
                  label="Partidas por evaluación"
                  value={gamesPerEval}
                  disabled={running}
                  onChange={value => update('simsPerEval', Math.max(1, Math.round(Number(value) / 2)))}
                >
                  {gamesPerEvalOptions.map(option => (
                    <option key={option} value={option}>
                      {formatCount(option)} partidas ({formatCount(option / 2)} cruces espejo)
                    </option>
                  ))}
                </SelectField>
                <SliderField
                  label="Generaciones máximas"
                  help="Tope duro del experimento. Si nada dispara una condición de corte antes, el run termina acá."
                  min={10}
                  max={200}
                  value={config.maxGenerations}
                  disabled={running}
                  onChange={value => update('maxGenerations', value)}
                />
                <SliderField
                  label="Elitismo"
                  help="Cuántos de los mejores pasan a la generación siguiente sin tocarse. Sirve para no perder una buena solución."
                  min={0}
                  max={5}
                  value={config.elitismCount}
                  disabled={running}
                  onChange={value => update('elitismCount', value)}
                />
              </div>
              <div className="evo-static-note">
                Criterio activo: <strong>{fitnessDescriptor.shortLabel}</strong>.
                La métrica primaria es <strong>{fitnessDescriptor.primaryLabel.toLowerCase()}</strong>
                {fitnessDescriptor.secondaryLabel ? ` y desempata con ${fitnessDescriptor.secondaryLabel.toLowerCase()}.` : '.'}
              </div>
              <div className="evo-static-note">
                Costo estimado con esta config: <strong>{formatCount(estimatedGamesPerGeneration)}</strong> partidas por generación
                ({formatCount(gamesPerEval)} por bot). Si el run llega al tope, puede rozar <strong>{formatCount(estimatedGamesPerFullRun)}</strong> partidas en total.
              </div>
              <StopToggle
                checked={config.useStabilizedEvaluation}
                disabled={running}
                label="Cortar evaluación por estabilidad"
                help="Cada candidato puede medirse con menos cruces si la tasa ya quedó planchada, igual que en la simulación normal."
                onChange={checked => update('useStabilizedEvaluation', checked)}
              >
                <SliderField
                  label="Precisión a comparar"
                  help={`Si la/s tasa/s del criterio activo no cambian durante ${STABLE_SIMULATION_STREAK} cruces seguidos, después de al menos ${MIN_SIMULATIONS_BEFORE_STABLE_STOP} cruces espejo, esa evaluación se corta sola.`}
                  min={0}
                  max={3}
                  value={config.stabilizeDecimals}
                  disabled={running || !config.useStabilizedEvaluation}
                  formatter={value => `${value} ${value === 1 ? 'decimal' : 'decimales'}`}
                  onChange={value => update('stabilizeDecimals', value)}
                />
              </StopToggle>
            </LabAccordionSection>

            <LabAccordionSection title="Operadores genéticos" subtitle="Selección, cruce y mutación" defaultOpen={false}>
              <div className="evo-static-note">
                Primero la selección decide qué bots se reproducen, después el cruce mezcla parámetros de dos padres,
                y por último la mutación mete cambios nuevos para seguir explorando el espacio de estrategias.
              </div>
              <div className="evo-static-note">
                {getSelectionHelp(config.selectionMethod, config.tournamentK)}
              </div>
              <div className="evo-card-grid">
                <SelectField
                  label="Método de selección"
                  value={config.selectionMethod}
                  disabled={running}
                  onChange={value => update('selectionMethod', value as EvoConfig['selectionMethod'])}
                >
                  <option value="tournament">Torneo</option>
                  <option value="roulette">Ruleta</option>
                </SelectField>

                {config.selectionMethod === 'tournament' ? (
                  <SliderField
                    label="k (torneo)"
                    help="Cuántos candidatos entran en cada mini torneo antes de elegir un padre. Más alto = más chances de que siempre gane uno fuerte."
                    min={2}
                    max={7}
                    value={config.tournamentK}
                    disabled={running}
                    onChange={value => update('tournamentK', value)}
                  />
                ) : (
                  <div className="evo-static-note">
                    Con ruleta no hay mini torneos: cada candidato entra al sorteo, pero los de mejor fitness tienen más chances de salir.
                  </div>
                )}

                <SliderField
                  label="Tasa de cruce"
                  help="Qué tan seguido una pareja mezcla genes en vez de pasar casi intacta. 0.80 = 80% de las parejas generan hijos mezclados."
                  min={0}
                  max={1}
                  step={0.01}
                  formatter={value => value.toFixed(2)}
                  value={config.crossoverRate}
                  disabled={running}
                  onChange={value => update('crossoverRate', Number(value.toFixed(2)))}
                />
                <SliderField
                  label="Tasa de mutación"
                  help="Probabilidad de que cada gen cambie al crear un hijo. Más alta = más exploración, pero también más ruido."
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  formatter={value => value.toFixed(2)}
                  value={config.mutationRate}
                  disabled={running}
                  onChange={value => update('mutationRate', Number(value.toFixed(2)))}
                />
                <SliderField
                  label="Sigma"
                  help="Tamaño típico del cambio cuando muta un parámetro numérico. Más alta = saltos más bruscos; más baja = ajustes finos."
                  min={0.5}
                  max={5}
                  step={0.1}
                  formatter={value => value.toFixed(1)}
                  value={config.mutationSigma}
                  disabled={running}
                  onChange={value => update('mutationSigma', Number(value.toFixed(1)))}
                />
              </div>
            </LabAccordionSection>

            <LabAccordionSection title="Condiciones de corte" subtitle="Cuándo frenar el run" defaultOpen={false}>
              <div className="evo-toggle-stack">
                <StopToggle
                  checked={config.absoluteMargin != null}
                  disabled={running}
                  label="Parar por margen absoluto"
                  help={`Frena si la métrica primaria supera el 50% por un colchón fijo de puntos porcentuales.`}
                  onChange={checked => update('absoluteMargin', checked ? defaultEvoConfig.absoluteMargin : null)}
                >
                  <SliderField
                    label="Margen absoluto"
                    help={`Puntos porcentuales por encima del 50% en ${fitnessDescriptor.primaryLabel.toLowerCase()}.`}
                    min={1}
                    max={25}
                    value={config.absoluteMargin ?? defaultEvoConfig.absoluteMargin ?? 5}
                    disabled={running}
                    formatter={value => `+${value}%`}
                    onChange={value => update('absoluteMargin', value)}
                  />
                </StopToggle>

                <StopToggle
                  checked={config.targetRate != null}
                  disabled={running}
                  label={`Parar por objetivo de ${fitnessDescriptor.primaryLabel.toLowerCase()}`}
                  help="La meta automática siempre sigue la métrica primaria del criterio activo."
                  onChange={checked => update('targetRate', checked ? defaultEvoConfig.targetRate : null)}
                >
                  <SliderField
                    label="Objetivo"
                    help={`Porcentaje objetivo de ${fitnessDescriptor.primaryLabel.toLowerCase()} para cortar el run automáticamente.`}
                    min={51}
                    max={90}
                    value={config.targetRate ?? defaultEvoConfig.targetRate ?? 60}
                    disabled={running}
                    formatter={value => `${value}%`}
                    onChange={value => update('targetRate', value)}
                  />
                </StopToggle>

                <StopToggle
                  checked={config.stagnationLimit != null}
                  disabled={running}
                  label="Parar por estancamiento"
                  help="Evita gastar generaciones si el mejor no mejora."
                  onChange={checked => update('stagnationLimit', checked ? defaultEvoConfig.stagnationLimit : null)}
                >
                  <SliderField
                    label="Generaciones sin mejora"
                    help="Cantidad máxima de generaciones estancadas."
                    min={5}
                    max={50}
                    value={config.stagnationLimit ?? defaultEvoConfig.stagnationLimit ?? 15}
                    disabled={running}
                    onChange={value => update('stagnationLimit', value)}
                  />
                </StopToggle>
              </div>
            </LabAccordionSection>

            <StickyActionBar>
              <button type="button" className="evo-primary-button" onClick={onStart}>
                Iniciar evolución
              </button>
            </StickyActionBar>
          </div>
        )}
      </LabPanel>

      <EvoSaveModal
        open={saveOpen}
        initialName={saveDefaults.name}
        initialEmoji={saveDefaults.emoji}
        initialDescription={saveDefaults.description}
        onClose={() => setSaveOpen(false)}
        onSave={handleSave}
      />
    </>
  )
}
