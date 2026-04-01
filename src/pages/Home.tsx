import { useState } from 'react'
import { Link } from 'react-router-dom'
import Topbar from '../components/Topbar'
import { prefetchRoute } from '../lib/page-loaders'

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
    to: '/tools/chinchon-lab',
    icon: '🎯',
    category: 'Cartas' as Category,
    chips: ['Arena', 'Bots'],
    title: 'Chinchón Lab',
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
const FAVORITES_STORAGE_KEY = 'ludario-favorites'
const LEGACY_FAVORITES_STORAGE_KEY = 'tabletop-favorites'

function loadFavorites(): Set<string> {
  try {
    const current = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (current) return new Set(JSON.parse(current) as string[])

    const legacy = localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY)
    if (!legacy) return new Set()

    const migrated = new Set(JSON.parse(legacy) as string[])
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...migrated]))
    localStorage.removeItem(LEGACY_FAVORITES_STORAGE_KEY)
    return migrated
  } catch {
    return new Set()
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favs]))
  localStorage.removeItem(LEGACY_FAVORITES_STORAGE_KEY)
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
  const favoriteTools = filtered.filter(tool => favorites.has(tool.to))
  const otherTools = filtered.filter(tool => !favorites.has(tool.to))
  const hasOtherTools = otherTools.length > 0

  function warmRoute(path: string) {
    prefetchRoute(path)
  }

  function renderToolCard(tool: (typeof TOOLS)[number]) {
    const isFavorite = favorites.has(tool.to)

    return (
      <article key={tool.to} className={`card${isFavorite ? ' card--fav' : ''}`}>
        <div className="card-header">
          <div className="card-icon" aria-hidden="true">{tool.icon}</div>
          <button
            type="button"
            className={`fav-btn${isFavorite ? ' active' : ''}`}
            aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            aria-pressed={isFavorite}
            onClick={() => toggleFavorite(tool.to)}
          >
            {isFavorite ? '★' : '☆'}
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
          <Link
            className="cta primary"
            to={tool.to}
            onMouseEnter={() => warmRoute(tool.to)}
            onFocus={() => warmRoute(tool.to)}
          >
            Abrir herramienta
          </Link>
        </div>
      </article>
    )
  }

  return (
    <main className="page page--home" id="main-content">
      <Topbar label="Ludario" sublabel="Herramientas de mesa" />

      <section className="hero">
        <div className="eyebrow">Herramientas de mesa</div>
        <h1>Utilidades para juegos de mesa, cartas y puzzles.</h1>
        <p>
          Herramientas para jugar mejor: solvers, scoreboards y juegos de mesa directamente en el navegador. Sin instalación, sin cuenta.
        </p>
      </section>

      <div className="filter-bar" role="toolbar" aria-label="Filtrar por categoría">
        <button
          type="button"
          className={`filter-btn${activeCategory === null ? ' active' : ''}`}
          aria-pressed={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        >
          Todos
        </button>
        {CATEGORIES.map(cat => (
          <button
            type="button"
            key={cat}
            className={`filter-btn${activeCategory === cat ? ' active' : ''}`}
            aria-pressed={activeCategory === cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {favoriteTools.length > 0 && (
        <section className="tool-section" aria-labelledby="favoritas-title">
          <div className="tool-section__header">
            <div>
              <div className="eyebrow eyebrow--small">Acceso rápido</div>
              <h2 id="favoritas-title">Tus favoritas</h2>
            </div>
            <p>Primero lo que más usás.</p>
          </div>
          <div className="grid" aria-label="Herramientas favoritas">
            {favoriteTools.map(renderToolCard)}
          </div>
        </section>
      )}

      <section className="tool-section" aria-labelledby="tools-title">
        <div className="tool-section__header">
          <div>
            <div className="eyebrow eyebrow--small">Catálogo</div>
            <h2 id="tools-title">{favoriteTools.length > 0 ? 'Todas las demás' : 'Herramientas disponibles'}</h2>
          </div>
          <p>{filtered.length} herramientas visibles.</p>
        </div>
        {hasOtherTools ? (
          <div className="grid" aria-label="Herramientas">
            {otherTools.map(renderToolCard)}
          </div>
        ) : (
          <div className="hero">
            <p>No quedan herramientas fuera de favoritas con este filtro. Probá cambiar la categoría o sacar alguna estrella.</p>
          </div>
        )}
      </section>

      <footer className="site-footer">
        <a
          href="https://github.com/facundoraulbistolfi/ludario"
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
