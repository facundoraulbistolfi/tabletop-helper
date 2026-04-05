import { StickyActionBar } from '../chinchon-lab/Layout'

type Props = {
  generation: number
  maxGenerations: number
  running: boolean
  initialized: boolean
  onInit: () => void
  onStep: () => void
  onRun: () => void
  onPause: () => void
  onReset: () => void
  tickMs: number
  onTickMsChange: (ms: number) => void
}

export default function Controls({
  generation,
  maxGenerations,
  running,
  initialized,
  onInit,
  onStep,
  onRun,
  onPause,
  onReset,
  tickMs,
  onTickMsChange,
}: Props) {
  const atEnd = generation >= maxGenerations

  return (
    <StickyActionBar>
      <div className="evo-controls">
        <div className="evo-controls__buttons">
          {!initialized ? (
            <button type="button" className="lab-tab is-active" onClick={onInit}>
              Inicializar
            </button>
          ) : (
            <>
              {running ? (
                <button type="button" className="lab-tab is-active" onClick={onPause}>
                  Pausar
                </button>
              ) : (
                <button type="button" className="lab-tab is-active" onClick={onRun} disabled={atEnd}>
                  Iniciar
                </button>
              )}
              <button type="button" className="lab-tab" onClick={onStep} disabled={running || atEnd}>
                Step
              </button>
              <button type="button" className="lab-tab" onClick={onReset}>
                Reset
              </button>
            </>
          )}
        </div>

        {initialized && (
          <div className="evo-controls__info">
            <span className="evo-controls__gen">Gen {generation} / {maxGenerations}</span>
            <label className="evo-controls__speed">
              <span>{tickMs}ms</span>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={tickMs}
                onChange={e => onTickMsChange(parseInt(e.target.value))}
              />
            </label>
          </div>
        )}
      </div>
    </StickyActionBar>
  )
}
