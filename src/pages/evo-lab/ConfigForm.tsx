import { LabPanel, LabAccordionSection } from '../chinchon-lab/Layout'
import { PRESETS } from '../../lib/genetic-lab/presets'
import { PROBLEMS } from '../../lib/genetic-lab/problems'
import type { ExperimentConfig } from '../../lib/genetic-lab/types'

type Props = {
  config: ExperimentConfig
  onChange: (config: ExperimentConfig) => void
  disabled: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export default function ConfigForm({ config, onChange, disabled }: Props) {
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
      </LabPanel>

      <LabAccordionSection title="Problema" defaultOpen>
        <label>
          Problema
          <select
            value={config.problemId}
            onChange={e => set('problemId', e.target.value)}
            disabled={disabled}
          >
            {PROBLEMS.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </label>
      </LabAccordionSection>

      <LabAccordionSection title="Población y genoma" defaultOpen>
        <div className="evo-form-grid">
          <label>
            Seed
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
                🎲
              </button>
            </div>
          </label>
          <label>
            Población
            <input
              type="number"
              min={10}
              max={400}
              value={config.populationSize}
              onChange={e => set('populationSize', clamp(parseInt(e.target.value) || 20, 10, 400))}
              disabled={disabled}
            />
          </label>
          <label>
            Largo del genoma
            <input
              type="number"
              min={4}
              max={256}
              value={config.genomeLength}
              onChange={e => set('genomeLength', clamp(parseInt(e.target.value) || 64, 4, 256))}
              disabled={disabled}
            />
          </label>
          <label>
            Elitismo
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
            Generaciones máx.
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
            Método
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
              k (tamaño torneo)
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
            Método
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
            Tasa de cruce
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
            Tasa por gen
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
