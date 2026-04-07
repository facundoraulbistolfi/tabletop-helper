import { useState, useRef, useCallback, useEffect } from 'react'
import { LabTabBar, LabPanel } from './chinchon-lab/Layout'
import ConfigForm from './evo-lab/ConfigForm'
import Controls from './evo-lab/Controls'
import PopulationGrid from './evo-lab/PopulationGrid'
import Inspector from './evo-lab/Inspector'
import FitnessChart from './evo-lab/FitnessChart'
import MazePopulationView from './evo-lab/MazePopulationView'
import MazeInspectorDetails from './evo-lab/MazeInspectorDetails'
import { PRESETS } from '../lib/genetic-lab/presets'
import { computeMetrics } from '../lib/genetic-lab/metrics'
import { computeMazePopulationStats } from '../lib/genetic-lab/maze-runner'
import type { ExperimentConfig, PopulationSnapshot, MetricsTick, Genome } from '../lib/genetic-lab/types'
import type { GeneticLabWorkerRequest, GeneticLabWorkerMessage } from '../lib/genetic-lab-worker-types'
import type { MazePreset } from '../lib/genetic-lab/maze-runner-types'

const TABS = [
  { value: 'experiment', label: 'Experimento', shortLabel: 'Config' },
  { value: 'evolution', label: 'Evolución', shortLabel: 'Evo' },
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

  const isMaze = config.problemId === 'maze-runner'

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/genetic-lab.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<GeneticLabWorkerMessage>) => {
      const msg = e.data
      if (msg.type === 'error') {
        console.error('Worker error:', msg.message)
        setRunning(false)
        return
      }

      if (msg.type === 'snapshot') {
        setSnapshot(msg.snapshot)
        setMetricsHistory(prev => {
          const last = prev[prev.length - 1]
          if (last && last.generation === msg.metrics.generation) return prev
          return [...prev, msg.metrics]
        })
        if (msg.done) {
          setRunning(false)
        }
      }
    }

    return () => {
      worker.terminate()
      if (runTimerRef.current) clearTimeout(runTimerRef.current)
    }
  }, [])

  const postMessage = useCallback((msg: GeneticLabWorkerRequest) => {
    workerRef.current?.postMessage(msg)
  }, [])

  const handleInit = useCallback(() => {
    const jobId = ++jobIdRef.current
    postMessage({ type: 'initExperiment', jobId, config })
    setMetricsHistory([])
    setSelectedId(null)
    setRunning(false)

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
  }, [config, postMessage])

  const handleStep = useCallback(() => {
    const jobId = ++jobIdRef.current
    postMessage({ type: 'step', jobId })
  }, [postMessage])

  const handleRun = useCallback(() => {
    setRunning(true)
    const jobId = ++jobIdRef.current

    function runBatch() {
      const yieldEvery = tickMs === 0 ? 10 : 1
      const steps = tickMs === 0 ? 50 : 1
      postMessage({ type: 'run', jobId, steps, yieldEvery })
      runTimerRef.current = setTimeout(runBatch, Math.max(tickMs, 16))
    }

    runBatch()
  }, [tickMs, postMessage])

  const handlePause = useCallback(() => {
    setRunning(false)
    if (runTimerRef.current) {
      clearTimeout(runTimerRef.current)
      runTimerRef.current = null
    }
    postMessage({ type: 'cancel', jobId: jobIdRef.current })
  }, [postMessage])

  const handleReset = useCallback(() => {
    handlePause()
    setSnapshot(null)
    setMetricsHistory([])
    setSelectedId(null)
    setTarget(null)
    setMazeCtx(null)
    setTab('experiment')
  }, [handlePause])

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

      {tab === 'metrics' && (
        <LabPanel title="Métricas de fitness" subtitle="Curvas best / promedio / peor por generación.">
          <FitnessChart
            history={displayHistory}
            maxFitness={maxFitness}
          />
          {metricsHistory.length > 0 && (
            <div className="evo-metrics-summary">
              <div><strong>Generación:</strong> {metricsHistory[metricsHistory.length - 1].generation}</div>
              <div><strong>Mejor fitness:</strong> {metricsHistory[metricsHistory.length - 1].best}</div>
              <div><strong>Promedio:</strong> {metricsHistory[metricsHistory.length - 1].avg.toFixed(2)}</div>
              <div><strong>Peor:</strong> {metricsHistory[metricsHistory.length - 1].worst}</div>
              {metricsHistory[metricsHistory.length - 1].diversity !== undefined && (
                <div><strong>Diversidad:</strong> {metricsHistory[metricsHistory.length - 1].diversity!.toFixed(3)}</div>
              )}
              {mazeStats && (
                <>
                  <div><strong>Llegan a la meta:</strong> {mazeStats.reachedPct.toFixed(1)}%</div>
                  <div><strong>Dist. promedio:</strong> {mazeStats.avgDistance.toFixed(1)}</div>
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
