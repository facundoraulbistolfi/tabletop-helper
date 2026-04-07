import { useState } from 'react'
import { LabPanel, LabAccordionSection } from '../chinchon-lab/Layout'
import { PRESETS } from '../../lib/genetic-lab/presets'
import { PROBLEMS } from '../../lib/genetic-lab/problems'
import { MAZE_PRESETS } from '../../lib/genetic-lab/maze-runner-maps'
import MazeEditor, { buildDefaultCustomMaze } from './MazeEditor'
import type { ExperimentConfig } from '../../lib/genetic-lab/types'
import type { MazePreset } from '../../lib/genetic-lab/maze-runner-types'

type Props = {
  config: ExperimentConfig
  onChange: (config: ExperimentConfig) => void
  disabled: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Small help icon with tooltip */
function Hint({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="evo-hint-wrap">
      <button
        type="button"
        className="evo-hint"
        onClick={() => setOpen(o => !o)}
        aria-label="Ayuda"
      >?</button>
      {open && (
        <span className="evo-hint__popup" onClick={() => setOpen(false)}>
          {text}
        </span>
      )}
    </span>
  )
}

/** Slider + number input combo for numeric fields */
function SliderField({ label, hint, value, min, max, step, onChange, disabled }: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  const s = step ?? 1
  const isFloat = s < 1
  const display = isFloat ? value.toFixed(String(s).split('.')[1]?.length ?? 2) : value
  return (
    <label>
      {label}{hint && <Hint text={hint} />}
      <div className="evo-slider-field">
        <input
          type="range"
          min={min} max={max} step={s}
          value={value}
          onChange={e => onChange(isFloat ? parseFloat(e.target.value) : parseInt(e.target.value))}
          disabled={disabled}
        />
        <span className="evo-slider-field__value">{display}</span>
      </div>
    </label>
  )
}

export default function ConfigForm({ config, onChange, disabled }: Props) {
  const isMaze = config.problemId === 'maze-runner'
  const maxSteps = isMaze ? ((config.problemParams?.maxSteps as number) ?? 25) : 0
  const isCustomMaze = isMaze && (config.problemParams?.mazePresetId === 'custom')

  function set<K extends keyof ExperimentConfig>(key: K, value: ExperimentConfig[K]) {
    onChange({ ...config, [key]: value })
  }

  function setSelection(method: 'tournament' | 'roulette', k?: number) {
    if (method === 'tournament') {
      set('selection', { method: 'tournament', k: k ?? 3 })
    } else {
      set('selection', { method: 'roulette' })
    }
  }

  function setCrossover(method: 'onePoint' | 'twoPoint' | 'uniform', rate: number) {
    if (method === 'uniform') {
      set('crossover', { method, rate, swapProb: 0.5 })
    } else {
      set('crossover', { method, rate })
    }
  }

  function handleProblemChange(problemId: string) {
    if (problemId === 'maze-runner') {
      // Switch to maze defaults
      const defaultMaxSteps = 25
      onChange({
        ...config,
        problemId,
        genomeLength: defaultMaxSteps * 2,
        problemParams: { mazePresetId: 'easy-corridor', maxSteps: defaultMaxSteps },
      })
    } else {
      // Switch back to non-maze defaults
      const problem = PROBLEMS.find(p => p.id === problemId)
      onChange({
        ...config,
        problemId,
        genomeLength: problem?.defaultGenomeLength ?? 64,
        problemParams: undefined,
      })
    }
  }

  function handleMazePresetChange(mazePresetId: string) {
    if (mazePresetId === 'custom') {
      // Initialize a custom maze
      const customMaze = buildDefaultCustomMaze(8, 6)
      onChange({
        ...config,
        problemParams: { ...config.problemParams, mazePresetId: 'custom', customMaze },
      })
    } else {
      // Remove customMaze when switching to a preset
      const { customMaze: _, ...rest } = (config.problemParams ?? {}) as Record<string, unknown>
      onChange({
        ...config,
        problemParams: { ...rest, mazePresetId },
      })
    }
  }

  function handleCustomMazeChange(maze: MazePreset) {
    onChange({
      ...config,
      problemParams: { ...config.problemParams, mazePresetId: 'custom', customMaze: maze },
    })
  }

  function handleMaxStepsChange(newMaxSteps: number) {
    const clamped = clamp(newMaxSteps, 5, 200)
    onChange({
      ...config,
      genomeLength: clamped * 2,
      problemParams: { ...config.problemParams, maxSteps: clamped },
    })
  }

  const currentCustomMaze = (config.problemParams?.customMaze as MazePreset | undefined) ?? null

  return (
    <div>
      <LabPanel title="Presets" subtitle="Carga una configuración predefinida con un click.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {PRESETS.map(preset => (
            <button
              key={preset.name}
              type="button"
              className="lab-tab"
              disabled={disabled}
              onClick={() => onChange(preset.config)}
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
        {/* Show description of loaded preset if it matches one */}
        {PRESETS.some(p =>
          p.config.problemId === config.problemId &&
          p.config.seed === config.seed
        ) && (
          <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {PRESETS.find(p =>
              p.config.problemId === config.problemId &&
              p.config.seed === config.seed
            )?.description}
          </p>
        )}
      </LabPanel>

      <LabAccordionSection title="Problema" defaultOpen>
        <label>
          Problema <Hint text="Elegí qué problema debe resolver el algoritmo genético. Target BitGrid busca copiar un patrón binario; Maze Runner busca un camino en un laberinto." />
          <select
            value={config.problemId}
            onChange={e => handleProblemChange(e.target.value)}
            disabled={disabled}
          >
            {PROBLEMS.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </label>

        {isMaze && (
          <div className="evo-form-grid" style={{ marginTop: '0.75rem' }}>
            <label>
              Laberinto <Hint text="Elegí un laberinto predefinido o 'Custom' para diseñar el tuyo. Los más grandes son más difíciles de resolver." />
              <select
                value={(config.problemParams?.mazePresetId as string) ?? 'easy-corridor'}
                onChange={e => handleMazePresetChange(e.target.value)}
                disabled={disabled}
              >
                {MAZE_PRESETS.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.width}&times;{m.height})</option>
                ))}
                <option value="custom">Custom (editable)</option>
              </select>
            </label>
            <SliderField
              label="Pasos máx."
              hint="Cantidad máxima de movimientos que puede hacer cada individuo. Más pasos permiten recorridos más largos pero aumentan el espacio de búsqueda."
              value={maxSteps} min={5} max={200} step={5}
              onChange={handleMaxStepsChange}
              disabled={disabled}
            />
            <label>
              Largo del genoma <Hint text="Se calcula automáticamente como pasos × 2 (2 bits por movimiento: arriba, derecha, abajo, izquierda)." />
              <span className="evo-slider-field__value" style={{ fontSize: '0.9rem' }}>{config.genomeLength}</span>
              <span style={{ fontSize: '0.75rem', color: '#888' }}>= pasos &times; 2 (autom&aacute;tico)</span>
            </label>
          </div>
        )}

        {/* Custom maze editor */}
        {isMaze && isCustomMaze && currentCustomMaze && (
          <MazeEditor
            maze={currentCustomMaze}
            onChange={handleCustomMazeChange}
            disabled={disabled}
          />
        )}
      </LabAccordionSection>

      <LabAccordionSection title="Población y genoma" defaultOpen>
        <div className="evo-form-grid">
          <label>
            Seed <Hint text="Semilla del generador de números aleatorios. Con la misma semilla y config, la evolución es idéntica. Cambiala para explorar resultados distintos." />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                value={config.seed}
                onChange={e => set('seed', parseInt(e.target.value) || 0)}
                disabled={disabled}
              />
              <button
                type="button"
                className="lab-tab"
                disabled={disabled}
                onClick={() => set('seed', Math.floor(Math.random() * 2147483647))}
                title="Seed aleatorio"
              >
                &#x1F3B2;
              </button>
            </div>
          </label>
          <SliderField
            label="Población"
            hint="Cantidad de individuos por generación. Más individuos = más diversidad pero más lento. Valores típicos: 50–200."
            value={config.populationSize} min={10} max={400} step={2}
            onChange={v => set('populationSize', v)}
            disabled={disabled}
          />
          {!isMaze && (
            <SliderField
              label="Largo del genoma"
              hint="Cantidad de bits del genoma de cada individuo. Define el tamaño del patrón que debe coincidir con el target."
              value={config.genomeLength} min={4} max={256} step={2}
              onChange={v => set('genomeLength', v)}
              disabled={disabled}
            />
          )}
          <SliderField
            label="Elitismo"
            hint="Cantidad de mejores individuos que pasan directamente a la siguiente generación sin cruce ni mutación. Preserva las mejores soluciones encontradas."
            value={config.elitismCount} min={0} max={Math.floor(config.populationSize * 0.1)}
            onChange={v => set('elitismCount', v)}
            disabled={disabled}
          />
          <SliderField
            label="Generaciones máx."
            hint="Límite de generaciones para la evolución. El algoritmo se detiene al llegar a este número aunque no haya convergido."
            value={config.maxGenerations} min={10} max={5000} step={10}
            onChange={v => set('maxGenerations', v)}
            disabled={disabled}
          />
        </div>
      </LabAccordionSection>

      <LabAccordionSection title="Selección">
        <div className="evo-form-grid">
          <label>
            M&eacute;todo <Hint text="Cómo se eligen los padres para reproducirse. Torneo: se seleccionan k individuos al azar y gana el mejor. Ruleta: la probabilidad de ser elegido es proporcional al fitness." />
            <select
              value={config.selection.method}
              onChange={e => setSelection(e.target.value as 'tournament' | 'roulette')}
              disabled={disabled}
            >
              <option value="tournament">Torneo</option>
              <option value="roulette">Ruleta</option>
            </select>
          </label>
          {config.selection.method === 'tournament' && (
            <SliderField
              label="k (tamaño torneo)"
              hint="Cuántos individuos compiten en cada torneo. k más alto = más presión selectiva (los mejores se reproducen más). k bajo permite más diversidad."
              value={config.selection.k} min={2} max={9}
              onChange={v => setSelection('tournament', v)}
              disabled={disabled}
            />
          )}
        </div>
      </LabAccordionSection>

      <LabAccordionSection title="Cruce">
        <div className="evo-form-grid">
          <label>
            M&eacute;todo <Hint text="Cómo se combinan los genomas de dos padres. Un punto: se corta en un lugar y se intercambian segmentos. Dos puntos: se corta en dos lugares. Uniforme: cada gen se hereda aleatoriamente de un padre u otro." />
            <select
              value={config.crossover.method}
              onChange={e => setCrossover(e.target.value as 'onePoint' | 'twoPoint' | 'uniform', config.crossover.rate)}
              disabled={disabled}
            >
              <option value="onePoint">Un punto</option>
              <option value="twoPoint">Dos puntos</option>
              <option value="uniform">Uniforme</option>
            </select>
          </label>
          <SliderField
            label="Tasa de cruce"
            hint="Probabilidad (0 a 1) de que dos padres intercambien material genético. Si no se cruzan, uno de los padres pasa directo. Valores típicos: 0.7–0.95."
            value={config.crossover.rate} min={0} max={1} step={0.05}
            onChange={v => setCrossover(config.crossover.method, v)}
            disabled={disabled}
          />
        </div>
      </LabAccordionSection>

      <LabAccordionSection title="Mutación">
        <div className="evo-form-grid">
          <SliderField
            label="Tasa por gen"
            hint="Probabilidad de que cada bit individual del genoma se invierta (0↔1). Valores bajos (0.01–0.05) dan mutaciones sutiles; valores altos introducen mucha variación pero pueden destruir buenas soluciones."
            value={config.mutation.ratePerGene} min={0} max={0.2} step={0.005}
            onChange={v => set('mutation', { method: 'bitFlip', ratePerGene: v })}
            disabled={disabled}
          />
        </div>
      </LabAccordionSection>
    </div>
  )
}
