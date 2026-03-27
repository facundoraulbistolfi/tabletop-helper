import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SudokuKiller from './pages/SudokuKiller'
import Chinchon from './pages/Chinchon'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tools/sudoku-killer" element={<SudokuKiller />} />
      <Route path="/tools/chinchon" element={<Chinchon />} />
    </Routes>
  )
}
