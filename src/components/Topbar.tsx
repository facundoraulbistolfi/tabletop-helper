import { Link, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/', label: 'Inicio' },
  { to: '/tools/sudoku-killer', label: 'Sudoku Killer' },
  { to: '/tools/chinchon', label: 'Chinchón' },
  { to: '/tools/chinchon-arena', label: 'Chinchón Arena' },
  { to: '/tools/truco', label: 'Truco' },
  { to: '/tools/pacman-memory', label: 'Pac-Memory' },
  { to: '/tools/pacman-ludo', label: 'Pac-Ludo' },
]

interface TopbarProps {
  label: string
  sublabel?: string
}

export default function Topbar({ label, sublabel = 'tabletop-helper' }: TopbarProps) {
  const { pathname } = useLocation()

  return (
    <nav className="topbar">
      <Link className="brand" to="/">
        <span className="brand-mark">♟️</span>
        <span className="brand-copy">
          <span className="brand-label">{sublabel}</span>
          <span className="brand-title">{label}</span>
        </span>
      </Link>
      <div className="nav">
        {NAV_LINKS.filter(link => link.to !== pathname).map(link => (
          <Link key={link.to} to={link.to}>{link.label}</Link>
        ))}
      </div>
    </nav>
  )
}
