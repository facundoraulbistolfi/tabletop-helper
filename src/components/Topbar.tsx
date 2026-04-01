import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { prefetchRoute } from '../lib/page-loaders'

const NAV_LINKS = [
  { to: '/', label: 'Inicio', mobileLabel: 'Inicio' },
  { to: '/tools/sudoku-killer', label: 'Sudoku Killer', mobileLabel: 'Sudoku' },
  { to: '/tools/chinchon', label: 'Chinchón', mobileLabel: 'Chinchón' },
  { to: '/tools/chinchon-lab', label: 'Chinchón Lab', mobileLabel: 'Lab' },
  { to: '/tools/truco', label: 'Truco', mobileLabel: 'Truco' },
  { to: '/tools/point-counter', label: 'Puntos', mobileLabel: 'Puntos' },
  { to: '/tools/pacman-memory', label: 'Pac-Memory', mobileLabel: 'Memory' },
  { to: '/tools/pacman-ludo', label: 'Pac-Ludo', mobileLabel: 'Ludo' },
]

interface TopbarProps {
  label: string
  sublabel?: string
}

export default function Topbar({ label, sublabel = 'tabletop-helper' }: TopbarProps) {
  const { pathname } = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const currentLink = NAV_LINKS.find(link => link.to === pathname) ?? NAV_LINKS[0]

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  function warmRoute(path: string) {
    prefetchRoute(path)
  }

  return (
    <header className="topbar-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <nav className="topbar" aria-label="Navegación principal">
      <Link className="brand" to="/">
        <span className="brand-mark">♟️</span>
        <span className="brand-copy">
          <span className="brand-label">{sublabel}</span>
          <span className="brand-title">{label}</span>
        </span>
      </Link>
      <div className="topbar-status">
        <span className="topbar-status__label">Vista actual</span>
        <span className="topbar-status__value">{currentLink.label}</span>
      </div>
      <button
        type="button"
        className="nav-toggle"
        aria-label={isMenuOpen ? 'Cerrar navegación' : 'Abrir navegación'}
        aria-expanded={isMenuOpen}
        aria-controls="site-nav-drawer"
        onClick={() => setIsMenuOpen(open => !open)}
      >
        <span aria-hidden="true">{isMenuOpen ? '✕' : '☰'}</span>
      </button>
      <div className="nav nav--desktop">
        {NAV_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            aria-current={link.to === pathname ? 'page' : undefined}
            className={link.to === pathname ? 'is-current' : undefined}
            onMouseEnter={() => warmRoute(link.to)}
            onFocus={() => warmRoute(link.to)}
          >
            {link.label}
          </Link>
        ))}
      </div>
      </nav>
      <div
        id="site-nav-drawer"
        className={`nav-drawer${isMenuOpen ? ' is-open' : ''}`}
        aria-hidden={!isMenuOpen}
      >
        <div className="nav-drawer__inner">
          {NAV_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={link.to === pathname ? 'page' : undefined}
              className={link.to === pathname ? 'is-current' : undefined}
              onMouseEnter={() => warmRoute(link.to)}
              onFocus={() => warmRoute(link.to)}
            >
              {link.mobileLabel}
            </Link>
          ))}
        </div>
      </div>
    </header>
  )
}
