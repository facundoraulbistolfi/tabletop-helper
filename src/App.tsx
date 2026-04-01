import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import { lazyPage, pageLoaders } from './lib/page-loaders'

const SudokuKiller = lazyPage(pageLoaders.sudokuKiller)
const Chinchon = lazyPage(pageLoaders.chinchon)
const PacmanMemory = lazyPage(pageLoaders.pacmanMemory)
const PacmanLudo = lazyPage(pageLoaders.pacmanLudo)
const ChinchonArena = lazyPage(pageLoaders.chinchonLab)
const Truco = lazyPage(pageLoaders.truco)
const PointCounter = lazyPage(pageLoaders.pointCounter)

function RouteFallback() {
  return (
    <main className="page page--loading" aria-busy="true">
      <div className="route-loading">
        <div className="route-loading__chip">Cargando…</div>
        <p>Preparando la herramienta.</p>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tools/sudoku-killer" element={<SudokuKiller />} />
        <Route path="/tools/chinchon" element={<Chinchon />} />
        <Route path="/tools/pacman-memory" element={<PacmanMemory />} />
        <Route path="/tools/pacman-ludo" element={<PacmanLudo />} />
        <Route path="/tools/chinchon-lab" element={<ChinchonArena />} />
        <Route path="/tools/chinchon-arena" element={<ChinchonArena />} />
        <Route path="/tools/truco" element={<Truco />} />
        <Route path="/tools/point-counter" element={<PointCounter />} />
      </Routes>
    </Suspense>
  )
}
