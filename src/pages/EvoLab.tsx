import { useState, useRef, useCallback, useEffect } from 'react'
import { LabTabBar, LabPanel } from './chinchon-lab/Layout'
import ConfigForm from './evo-lab/ConfigForm'
import Controls from './evo-lab/Controls'
import PopulationGrid from './evo-lab/PopulationGrid'
import Inspector from './evo-lab/Inspector'
import FitnessChart from './evo-lab/FitnessChart'
import MazePopulationView from './evo-lab/MazePopulationView'
import MazeInspectorDetails from './evo-lab/MazeInspectorDetails'
import MazeAnimationView from './evo-lab/MazeAnimationView'
import { PRESETS } from '../lib/genetic-lab/presets'
import { computeMetrics } from '../lib/genetic-lab/metrics'
import { computeMazePopulationStats } from '../lib/genetic-lab/maze-runner'
import type { ExperimentConfig, PopulationSnapshot, MetricsTick, Genome } from '../lib/genetic-lab/types'
import type { GeneticLabWorkerRequest, GeneticLabWorkerMessage } from '../lib/genetic-lab-worker-types'
import type { MazePreset } from '../lib/genetic-lab/maze-runner-types'

const TABS_BASE = [
  { value: 'experiment', label: 'Experimento', shortLabel: 'Config' },
  { value: 'evolution', label: 'Evolución', shortLabel: 'Evo' },
  { value: 'animation', label: 'Animación', shortLabel: 'Anim' },
  { value: 'metrics', label: 'Métricas', shortLabel: 'Stats' },
]

export default function EvoLab() {
  const [tab, setTab] = useState('experiment')
  const [config, setConfig] = useState<ExperimentConfig>(PRESETS[0].config)
  const [snapshot, setSnapshot] = useState<PopulationSnapshot | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<MetricsTick[]>([])
  const [running, setRunning] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tickMs, setTickMs] = useState(80)
  const [target, setTarget] = useState<Genome | null>(null)
  const [mazeCtx, setMazeCtx] = useState<MazePreset | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const jobIdRef = useRef(0)
  const runTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRunJobIdRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const tickMsRef = useRef(tickMs)
  const snapshotRef = useRef<PopulationSnapshot | null>(null)
  const configRef = useRef(config)

  const isMaze = config.problemId === 'maze-runner'

  // Only show animation tab for maze problems
  const TABS = isMaze
    ? TABS_BASE
    : TABS_BASE.filter(t => t.value !== 'animation')

  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    tickMsRef.current = tickMs
  }, [tickMs])

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    configRef.current = config
  }, [config])

  const postMessage = useCallback((msg: GeneticLabWorkerRequest) => {
    workerRef.current?.postMessage(msg)
  }, [])

  const clearRunTimer = useCallback(() => {
    if (runTimerRef.current) {
      clearTimeout(runTimerRef.current)
      runTimerRef.current = null
    }
  }, [])

  const queueRunBatch = useCallback((jobId: number, immediate = false) => {
    clearRunTimer()

    const dispatchBatch = () => {
      if (!runningRef.current || activeRunJobIdRef.current !== jobId) return

      const currentSnapshot = snapshotRef.current
      const currentConfig = configRef.current
      if (currentSnapshot && currentSnapshot.generation >= currentConfig.maxGenerations) {
        activeRunJobIdRef.current = null
        runningRef.current = false
        setRunning(false)
        return
      }

      const yieldEvery = tickMsRef.current === 0 ? 10 : 1
      const steps = tickMsRef.current === 0 ? 50 : 1
      postMessage({ type: 'run', jobId, steps, yieldEvery })
    }

    if (immediate) {
      dispatchBatch()
      return
    }

    const delay = tickMsRef.current === 0 ? 0 : Math.max(tickMsRef.current, 16)
    runTimerRef.current = setTimeout(dispatchBatch, delay)
  }, [clearRunTimer, postMessage])

  const cancelActiveRun = useCallback(() => {
    clearRunTimer()
    runningRef.current = false
    setRunning(false)

    const activeRunJobId = activeRunJobIdRef.current
    activeRunJobIdRef.current = null
    if (activeRunJobId !== null) {
      postMessage({ type: 'cancel', jobId: activeRunJobId })
    }
  }, [clearRunTimer, postMessage])

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/genetic-lab.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<GeneticLabWorkerMessage>) => {
      const msg = e.data
      if (msg.jobId !== jobIdRef.current) return

      if (msg.type === 'error') {
        console.error('Worker error:', msg.message)
        clearRunTimer()
        activeRunJobIdRef.current = null
        runningRef.current = false
        setRunning(false)
        return
      }

      if (msg.type === 'snapshot') {
        snapshotRef.current = msg.snapshot
        setSnapshot(msg.snapshot)
        setMetricsHistory(prev => {
          const last = prev[prev.length - 1]
          if (last && last.generation === msg.metrics.generation) return prev
          return [...prev, msg.metrics]
        })

        if (activeRunJobIdRef.current === msg.jobId) {
          if (msg.done) {
            clearRunTimer()
            activeRunJobIdRef.current = null
            runningRef.current = false
            setRunning(false)
          } else if (runningRef.current) {
            queueRunBatch(msg.jobId)
          }
        } else if (msg.done) {
          setRunning(false)
        }
      }
    }

    return () => {
      clearRunTimer()
      worker.terminate()
    }
  }, [clearRunTimer, queueRunBatch])

  const handleInit = useCallback(() => {
    cancelActiveRun()

    const jobId = ++jobIdRef.current
    postMessage({ type: 'initExperiment', jobId, config })
    setMetricsHistory([])
    setSelectedId(null)

    // Build context locally for UI display
    import('../lib/genetic-lab/rng').then(({ createRng }) => {
      import('../lib/genetic-lab/problems').then(({ getProblem }) => {
        const problem = getProblem(config.problemId)
        if (problem) {
          const ctx = problem.buildContext(config, createRng(config.seed))
          setTarget(ctx.target ?? null)
          setMazeCtx(ctx.maze ?? null)
        }
      })
    })

    setTab('evolution')
  }, [cancelActiveRun, config, postMessage])

  const handleStep = useCallback(() => {
    cancelActiveRun()

    const jobId = ++jobIdRef.current
    postMessage({ type: 'step', jobId })
  }, [cancelActiveRun, postMessage])

  const handleRun = useCallback(() => {
    if (snapshotRef.current && snapshotRef.current.generation >= configRef.current.maxGenerations) {
      return
    }

    clearRunTimer()
    runningRef.current = true
    setRunning(true)
    const jobId = ++jobIdRef.current
    activeRunJobIdRef.current = jobId
    queueRunBatch(jobId, true)
  }, [clearRunTimer, queueRunBatch])

  const handlePause = useCallback(() => {
    cancelActiveRun()
  }, [cancelActiveRun])

  const handleReset = useCallback(() => {
    cancelActiveRun()
    snapshotRef.current = null
    setSnapshot(null)
    setMetricsHistory([])
    setSelectedId(null)
    setTarget(null)
    setMazeCtx(null)
    setTab('experiment')
  }, [cancelActiveRun])

  const bestId = snapshot
    ? snapshot.individuals.reduce((best, ind) => (ind.fitness > best.fitness ? ind : best), snapshot.individuals[0]).id
    : null

  const selectedIndividual = snapshot?.individuals.find(i => i.id === selectedId) ?? null

  const initialMetrics = snapshot && metricsHistory.length === 0
    ? computeMetrics(snapshot)
    : null
  const displayHistory = initialMetrics ? [initialMetrics] : metricsHistory

  // Max fitness for chart scaling
  const maxFitness = isMaze ? 1000 : config.genomeLength

  // Maze-specific population stats (computed on UI side)
  const mazeStats = (isMaze && snapshot && mazeCtx)
    ? computeMazePopulationStats(snapshot.individuals.map(i => i.genome), mazeCtx)
    : null

  const maxSteps = isMaze
    ? (config.problemParams?.maxSteps as number) ?? config.genomeLength / 2
    : 0

  return (
    <main className="page evo-lab-page">
      <LabTabBar current={tab} onChange={setTab} tabs={TABS} />

      {tab === 'experiment' && (
        <ConfigForm
          config={config}
          onChange={setConfig}
          disabled={running}
        />
      )}

      {tab === 'evolution' && (
        <>
          {snapshot ? (
            isMaze && mazeCtx ? (
              <>
                <MazePopulationView
                  individuals={snapshot.individuals}
                  maze={mazeCtx}
                  generation={snapshot.generation}
                  bestId={bestId}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <MazeInspectorDetails
                  individual={selectedIndividual}
                  maze={mazeCtx}
                  maxSteps={maxSteps}
                  onClose={() => setSelectedId(null)}
                />
              </>
            ) : (
              <>
                <PopulationGrid
                  individuals={snapshot.individuals}
                  target={target ?? undefined}
                  bestId={bestId}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  genomeLength={config.genomeLength}
                />
                <Inspector
                  individual={selectedIndividual}
                  target={target ?? undefined}
                  onClose={() => setSelectedId(null)}
                />
              </>
            )
          ) : (
            <LabPanel title="Evolución" subtitle="Inicializa un experimento desde la tab Experimento o presiona Inicializar abajo.">
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Usa el botón Inicializar en la barra inferior.</p>
            </LabPanel>
          )}
        </>
      )}

      {tab === 'animation' && isMaze && (
        <>
          {snapshot && mazeCtx ? (
            <MazeAnimationView
              individuals={snapshot.individuals}
              maze={mazeCtx}
              generation={snapshot.generation}
            />
          ) : (
            <LabPanel title="Animación" subtitle="Inicializá un experimento para ver la animación.">
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Usa el botón Inicializar en la barra inferior.</p>
            </LabPanel>
          )}
        </>
      )}

      {tab === 'metrics' && (
        <LabPanel title="Métricas de fitness" subtitle="Curvas best / promedio / peor por generación.">
          <FitnessChart
            history={displayHistory}
            maxFitness={maxFitness}
          />
          {metricsHistory.length > 0 && (
            <div className="evo-metrics-summary">
              <div title="Número de generación actual"><strong>Generación:</strong> {metricsHistory[metricsHistory.length - 1].generation}</div>
              <div title="Fitness más alto de la población actual. En Maze Runner el máximo teórico es 1000."><strong>Mejor fitness:</strong> {metricsHistory[metricsHistory.length - 1].best}</div>
              <div title="Promedio de fitness de todos los individuos. Sube a medida que la población mejora."><strong>Promedio:</strong> {metricsHistory[metricsHistory.length - 1].avg.toFixed(2)}</div>
              <div title="Fitness más bajo de la población. Si sube, la población converge."><strong>Peor:</strong> {metricsHistory[metricsHistory.length - 1].worst}</div>
              {metricsHistory[metricsHistory.length - 1].diversity !== undefined && (
                <div title="Entropía de Shannon promedio por gen (0–1). Valores altos = más variedad genética; valores bajos = convergencia."><strong>Diversidad:</strong> {metricsHistory[metricsHistory.length - 1].diversity!.toFixed(3)}</div>
              )}
              {mazeStats && (
                <>
                  <div title="Porcentaje de individuos que llegan a la meta en la generación actual"><strong>Llegan a la meta:</strong> {mazeStats.reachedPct.toFixed(1)}%</div>
                  <div title="Distancia Manhattan promedio de todos los individuos a la meta. Baja a medida que la población se acerca."><strong>Dist. promedio:</strong> {mazeStats.avgDistance.toFixed(1)}</div>
                </>
              )}
            </div>
          )}
        </LabPanel>
      )}

      <Controls
        generation={snapshot?.generation ?? 0}
        maxGenerations={config.maxGenerations}
        running={running}
        initialized={snapshot !== null}
        onInit={handleInit}
        onStep={handleStep}
        onRun={handleRun}
        onPause={handlePause}
        onReset={handleReset}
        tickMs={tickMs}
        onTickMsChange={setTickMs}
      />
    </main>
  )
}
