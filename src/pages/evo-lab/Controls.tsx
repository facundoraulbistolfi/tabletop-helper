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
            <button type="button" className="lab-tab is-active" onClick={onInit} title="Crea la poblaci&oacute;n inicial con la configuraci&oacute;n actual y pasa a la tab Evoluci&oacute;n.">
              Inicializar
            </button>
          ) : (
            <>
              {running ? (
                <button type="button" className="lab-tab is-active" onClick={onPause} title="Pausa la evoluci&oacute;n autom&aacute;tica. Pod&eacute;s seguir avanzando con Step.">
                  Pausar
                </button>
              ) : (
                <button type="button" className="lab-tab is-active" onClick={onRun} disabled={atEnd} title="Ejecuta la evoluci&oacute;n autom&aacute;ticamente hasta pausar o llegar al l&iacute;mite de generaciones.">
                  Iniciar
                </button>
              )}
              <button type="button" className="lab-tab" onClick={onStep} disabled={running || atEnd} title="Avanza exactamente una generaci&oacute;n. &Uacute;til para observar cambios paso a paso.">
                Step
              </button>
              <button type="button" className="lab-tab" onClick={onReset} title="Descarta el experimento actual y vuelve a la pantalla de configuraci&oacute;n.">
                Reset
              </button>
            </>
          )}
        </div>

        {initialized && (
          <div className="evo-controls__info">
            <span className="evo-controls__gen" title="Generaci&oacute;n actual / m&aacute;ximo configurado. La evoluci&oacute;n se detiene al llegar al l&iacute;mite.">Gen {generation} / {maxGenerations}</span>
            <label className="evo-controls__speed" title="Milisegundos entre generaciones. 0ms = m&aacute;xima velocidad (procesa en lotes). Valores altos permiten ver la evoluci&oacute;n paso a paso.">
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
