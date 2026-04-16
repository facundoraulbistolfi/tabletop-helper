import { Suspense, type ReactNode } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import HomeCornerButton from './components/HomeCornerButton'
import Home from './pages/Home'
import { lazyPage, pageLoaders } from './lib/page-loaders'

const SudokuKiller = lazyPage(pageLoaders.sudokuKiller)
const Chinchon = lazyPage(pageLoaders.chinchon)
const PacmanMemory = lazyPage(pageLoaders.pacmanMemory)
const PacmanLudo = lazyPage(pageLoaders.pacmanLudo)
const ChinchonArena = lazyPage(pageLoaders.chinchonLab)
const Truco = lazyPage(pageLoaders.truco)
const PointCounter = lazyPage(pageLoaders.pointCounter)
const EvoLab = lazyPage(pageLoaders.evoLab)
const Sot = lazyPage(pageLoaders.sot)

function RouteFallback() {
  const { pathname } = useLocation()
  const showHomeButton = pathname !== '/'

  return (
    <main className="page page--loading" aria-busy="true">
      {showHomeButton && <HomeCornerButton />}
      <div className="route-loading">
        <div className="route-loading__orb" aria-hidden="true" />
        <div className="route-loading__chip">📚 Abriendo estante</div>
        <h1 className="route-loading__title">Preparando la herramienta.</h1>
        <p className="route-loading__copy">
          Cargando interfaz, reglas y atajos para que vuelvas a la mesa enseguida.
        </p>
      </div>
    </main>
  )
}

function ToolRoute({ children }: { children: ReactNode }) {
  return (
    <>
      <HomeCornerButton />
      {children}
    </>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tools/sudoku-killer" element={<ToolRoute><SudokuKiller /></ToolRoute>} />
        <Route path="/tools/chinchon" element={<ToolRoute><Chinchon /></ToolRoute>} />
        <Route path="/tools/pacman-memory" element={<ToolRoute><PacmanMemory /></ToolRoute>} />
        <Route path="/tools/pacman-ludo" element={<ToolRoute><PacmanLudo /></ToolRoute>} />
        <Route path="/tools/chinchon-lab" element={<ToolRoute><ChinchonArena /></ToolRoute>} />
        <Route path="/tools/chinchon-arena" element={<ToolRoute><ChinchonArena /></ToolRoute>} />
        <Route path="/tools/truco" element={<ToolRoute><Truco /></ToolRoute>} />
        <Route path="/tools/point-counter" element={<ToolRoute><PointCounter /></ToolRoute>} />
        <Route path="/tools/evo-lab" element={<ToolRoute><EvoLab /></ToolRoute>} />
        <Route path="/tools/sot" element={<ToolRoute><Sot /></ToolRoute>} />
      </Routes>
    </Suspense>
  )
}
