import { Link } from 'react-router-dom'
import Topbar from '../components/Topbar'

const TOOLS = [
  {
    to: '/tools/sudoku-killer',
    chips: ['Sudoku', 'Solver', 'KrazyDad'],
    title: 'Sudoku Killer',
    description: 'Solver de cages con filtros de dígitos, restricciones entre pares y acceso rápido a PDFs de KrazyDad.',
  },
  {
    to: '/tools/chinchon',
    chips: ['Cartas', 'Scoreboard', 'Persistencia'],
    title: 'Anotador de Chinchón',
    description: 'Configura jugadores, suma rondas, marca chinchón o −10, y guarda/carga el estado de la partida.',
  },
  {
    to: '/tools/pacman-memory',
    chips: ['Pac-Man', 'Memoria', 'Multijugador'],
    title: 'Pac-Memory',
    description: 'Juego de memoria con sprites retro de Pac-Man, Space Invaders, Tetris y más. Para 2-3 jugadores.',
  },
  {
    to: '/tools/pacman-ludo',
    chips: ['Pac-Man', 'Ludo', 'Multijugador'],
    title: 'Pac-Ludo',
    description: 'Ludo temático de Pac-Man: movés fantasmas por el tablero, capturás rivales y llegás al centro.',
  },
]

export default function Home() {
  return (
    <main className="page">
      <Topbar label="tabletop-helper" sublabel="Herramientas de mesa" />

      <section className="hero">
        <div className="eyebrow">Herramientas de mesa</div>
        <h1>Utilidades para juegos de mesa, cartas y puzzles.</h1>
        <p>
          Abrí cada herramienta desde acá o entrá directo por URL a su página dedicada.
        </p>
      </section>

      <section className="grid" aria-label="Herramientas">
        {TOOLS.map(tool => (
          <article key={tool.to} className="card">
            <div className="chips">
              {tool.chips.map(chip => (
                <span key={chip} className="chip">{chip}</span>
              ))}
            </div>
            <h2>{tool.title}</h2>
            <p>{tool.description}</p>
            <div className="actions">
              <Link className="cta primary" to={tool.to}>Abrir herramienta</Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
