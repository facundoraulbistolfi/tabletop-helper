import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SudokuKiller from './pages/SudokuKiller'
import Chinchon from './pages/Chinchon'
import PacmanMemory from './pages/PacmanMemory'
import PacmanLudo from './pages/PacmanLudo'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tools/sudoku-killer" element={<SudokuKiller />} />
      <Route path="/tools/chinchon" element={<Chinchon />} />
      <Route path="/tools/pacman-memory" element={<PacmanMemory />} />
      <Route path="/tools/pacman-ludo" element={<PacmanLudo />} />
    </Routes>
  )
}
