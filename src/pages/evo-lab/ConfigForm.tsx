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
  return (
    <span className="evo-hint" title={text}>?</span>
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
            <label>
              Pasos m&aacute;x. <Hint text="Cantidad máxima de movimientos que puede hacer cada individuo. Más pasos permiten recorridos más largos pero aumentan el espacio de búsqueda." />
              <input
                type="number"
                min={5}
                max={200}
                value={maxSteps}
                onChange={e => handleMaxStepsChange(parseInt(e.target.value) || 25)}
                disabled={disabled}
              />
            </label>
            <label>
              Largo del genoma <Hint text="Se calcula automáticamente como pasos × 2 (2 bits por movimiento: arriba, derecha, abajo, izquierda)." />
              <input
                type="number"
                value={config.genomeLength}
                disabled
                title="Se calcula autom&aacute;ticamente: pasos &times; 2"
              />
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
          <label>
            Poblaci&oacute;n <Hint text="Cantidad de individuos por generación. Más individuos = más diversidad pero más lento. Valores típicos: 50–200." />
            <input
              type="number"
              min={10}
              max={400}
              value={config.populationSize}
              onChange={e => set('populationSize', clamp(parseInt(e.target.value) || 20, 10, 400))}
              disabled={disabled}
            />
          </label>
          {!isMaze && (
            <label>
              Largo del genoma <Hint text="Cantidad de bits del genoma de cada individuo. Define el tamaño del patrón que debe coincidir con el target." />
              <input
                type="number"
                min={4}
                max={256}
                value={config.genomeLength}
                onChange={e => set('genomeLength', clamp(parseInt(e.target.value) || 64, 4, 256))}
                disabled={disabled}
              />
            </label>
          )}
          <label>
            Elitismo <Hint text="Cantidad de mejores individuos que pasan directamente a la siguiente generación sin cruce ni mutación. Preserva las mejores soluciones encontradas." />
            <input
              type="number"
              min={0}
              max={Math.floor(config.populationSize * 0.1)}
              value={config.elitismCount}
              onChange={e => set('elitismCount', clamp(parseInt(e.target.value) || 0, 0, Math.floor(config.populationSize * 0.1)))}
              disabled={disabled}
            />
          </label>
          <label>
            Generaciones m&aacute;x. <Hint text="Límite de generaciones para la evolución. El algoritmo se detiene al llegar a este número aunque no haya convergido." />
            <input
              type="number"
              min={10}
              max={5000}
              value={config.maxGenerations}
              onChange={e => set('maxGenerations', clamp(parseInt(e.target.value) || 300, 10, 5000))}
              disabled={disabled}
            />
          </label>
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
            <label>
              k (tama&ntilde;o torneo) <Hint text="Cuántos individuos compiten en cada torneo. k más alto = más presión selectiva (los mejores se reproducen más). k bajo permite más diversidad." />
              <input
                type="number"
                min={2}
                max={9}
                value={config.selection.k}
                onChange={e => setSelection('tournament', clamp(parseInt(e.target.value) || 3, 2, 9))}
                disabled={disabled}
              />
            </label>
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
          <label>
            Tasa de cruce <Hint text="Probabilidad (0 a 1) de que dos padres intercambien material genético. Si no se cruzan, uno de los padres pasa directo. Valores típicos: 0.7–0.95." />
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.crossover.rate}
              onChange={e => setCrossover(config.crossover.method, clamp(parseFloat(e.target.value) || 0, 0, 1))}
              disabled={disabled}
            />
          </label>
        </div>
      </LabAccordionSection>

      <LabAccordionSection title="Mutación">
        <div className="evo-form-grid">
          <label>
            Tasa por gen <Hint text="Probabilidad de que cada bit individual del genoma se invierta (0↔1). Valores bajos (0.01–0.05) dan mutaciones sutiles; valores altos introducen mucha variación pero pueden destruir buenas soluciones." />
            <input
              type="number"
              min={0}
              max={0.2}
              step={0.005}
              value={config.mutation.ratePerGene}
              onChange={e => set('mutation', { method: 'bitFlip', ratePerGene: clamp(parseFloat(e.target.value) || 0, 0, 0.2) })}
              disabled={disabled}
            />
          </label>
        </div>
      </LabAccordionSection>
    </div>
  )
}
