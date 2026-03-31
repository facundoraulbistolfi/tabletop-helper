import { useState } from 'react'
import { Link } from 'react-router-dom'
import Topbar from '../components/Topbar'

type Category = 'Puzzles' | 'Cartas' | 'Juegos'

const TOOLS = [
  {
    to: '/tools/sudoku-killer',
    icon: '🔢',
    category: 'Puzzles' as Category,
    chips: ['Solver', 'Lógica'],
    title: 'Sudoku Killer',
    description: 'Solver de cages con filtros de dígitos, restricciones entre pares y acceso rápido a PDFs de KrazyDad.',
  },
  {
    to: '/tools/chinchon',
    icon: '🃏',
    category: 'Cartas' as Category,
    chips: ['Scoreboard', 'Persistencia'],
    title: 'Anotador de Chinchón',
    description: 'Configura jugadores, suma rondas, marca chinchón o −10, y guarda/carga el estado de la partida.',
  },

  {
    to: '/tools/truco',
    icon: '🧉',
    category: 'Cartas' as Category,
    chips: ['Scoreboard', 'Buenas/Malas'],
    title: 'Anotador de Truco',
    description: 'Marcador de truco en palitos con buenas y malas, pensado para partidas rápidas entre nosotros y ellos.',
  },

  {
    to: '/tools/chinchon-arena',
    icon: '🎯',
    category: 'Cartas' as Category,
    chips: ['Arena', 'Bots'],
    title: 'Chinchón Arena',
    description: 'Arena de bots y modo de juego para practicar cortes, chinchón y estrategia de descarte.',
  },
  {
    to: '/tools/pacman-memory',
    icon: '👻',
    category: 'Juegos' as Category,
    chips: ['Memoria', 'Multijugador'],
    title: 'Pac-Memory',
    description: 'Juego de memoria con sprites retro de Pac-Man, Space Invaders, Tetris y más. Para 2–3 jugadores.',
  },

  {
    to: '/tools/point-counter',
    icon: '➕',
    category: 'Juegos' as Category,
    chips: ['Scoreboard', 'Tap', 'Multijugador'],
    title: 'Contador de Puntos',
    description: 'Marcador genérico por jugador con botones de color, suma rápida por toque y suma avanzada con long press.',
  },

  {
    to: '/tools/pacman-ludo',
    icon: '🕹️',
    category: 'Juegos' as Category,
    chips: ['Tablero', 'Multijugador'],
    title: 'Pac-Ludo',
    description: 'Ludo temático de Pac-Man: movés fantasmas por el tablero, capturás rivales y llegás al centro.',
  },
]

const CATEGORIES: Category[] = ['Puzzles', 'Cartas', 'Juegos']

function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem('tabletop-favorites')
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem('tabletop-favorites', JSON.stringify([...favs]))
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites)

  function toggleFavorite(to: string) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(to)) next.delete(to)
      else next.add(to)
      saveFavorites(next)
      return next
    })
  }

  const filtered = TOOLS
    .filter(t => activeCategory === null || t.category === activeCategory)
    .sort((a, b) => Number(!favorites.has(a.to)) - Number(!favorites.has(b.to)))

  return (
    <main className="page">
      <Topbar label="tabletop-helper" sublabel="Herramientas de mesa" />

      <section className="hero">
        <div className="eyebrow">Herramientas de mesa</div>
        <h1>Utilidades para juegos de mesa, cartas y puzzles.</h1>
        <p>
          Herramientas para jugar mejor: solvers, scoreboards y juegos de mesa directamente en el navegador. Sin instalación, sin cuenta.
        </p>
      </section>

      <div className="filter-bar" role="toolbar" aria-label="Filtrar por categoría">
        <button
          className={`filter-btn${activeCategory === null ? ' active' : ''}`}
          onClick={() => setActiveCategory(null)}
        >
          Todos
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`filter-btn${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <section className="grid" aria-label="Herramientas">
        {filtered.map(tool => (
          <article key={tool.to} className={`card${favorites.has(tool.to) ? ' card--fav' : ''}`}>
            <div className="card-header">
              <div className="card-icon" aria-hidden="true">{tool.icon}</div>
              <button
                className={`fav-btn${favorites.has(tool.to) ? ' active' : ''}`}
                aria-label={favorites.has(tool.to) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                onClick={() => toggleFavorite(tool.to)}
              >
                {favorites.has(tool.to) ? '★' : '☆'}
              </button>
            </div>
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

      <footer className="site-footer">
        <a
          href="https://github.com/facundoraulbistolfi/tabletop-helper"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <span aria-hidden="true">·</span>
        <span>{TOOLS.length} herramientas</span>
      </footer>
    </main>
  )
}
