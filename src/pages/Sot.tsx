import { useMemo, useState } from 'react'

type TileType = 'water' | 'island' | 'storm' | 'port' | 'treasure'

type Tile = {
  x: number
  y: number
  type: TileType
  visited: boolean
}

type PlayerState = {
  hull: number
  supplies: number
  gold: number
}

const SIZE = 9
const START = Math.floor(SIZE / 2)

const TILE_META: Record<TileType, { icon: string; label: string }> = {
  water: { icon: '🌊', label: 'Mar abierto' },
  island: { icon: '🏝️', label: 'Isla' },
  storm: { icon: '⛈️', label: 'Tormenta' },
  port: { icon: '⚓', label: 'Puerto' },
  treasure: { icon: '💰', label: 'Tesoro' },
}

function randomTile(): TileType {
  const roll = Math.random()
  if (roll < 0.58) return 'water'
  if (roll < 0.76) return 'island'
  if (roll < 0.89) return 'storm'
  if (roll < 0.97) return 'treasure'
  return 'port'
}

function createMap(): Tile[][] {
  return Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => ({
      x,
      y,
      type: x === START && y === START ? 'port' : randomTile(),
      visited: x === START && y === START,
    })),
  )
}

export default function Sot() {
  const [map, setMap] = useState<Tile[][]>(() => createMap())
  const [position, setPosition] = useState({ x: START, y: START })
  const [player, setPlayer] = useState<PlayerState>({ hull: 20, supplies: 20, gold: 0 })
  const [log, setLog] = useState<string[]>(['⛵ Comienza la expedición pirata.'])

  const currentTile = map[position.y][position.x]
  const gameOver = player.hull <= 0 || player.supplies <= 0

  const visibleMap = useMemo(
    () =>
      map.map((row) =>
        row.map((tile) => {
          const distance = Math.max(Math.abs(tile.x - position.x), Math.abs(tile.y - position.y))
          return { ...tile, visible: distance <= 1 || tile.visited }
        }),
      ),
    [map, position.x, position.y],
  )

  function pushLog(entry: string) {
    setLog((prev) => [...prev.slice(-4), entry])
  }

  function resolveTile(type: TileType) {
    if (type === 'water') {
      pushLog('🌊 Aguas tranquilas. Sin novedades.')
      return
    }

    if (type === 'island') {
      const supplies = 2 + Math.floor(Math.random() * 4)
      setPlayer((prev) => ({ ...prev, supplies: Math.min(prev.supplies + supplies, 25) }))
      pushLog(`🏝️ Recolectaste ${supplies} víveres en una isla.`)
      return
    }

    if (type === 'storm') {
      const dmg = 2 + Math.floor(Math.random() * 4)
      setPlayer((prev) => ({ ...prev, hull: prev.hull - dmg }))
      pushLog(`⛈️ La tormenta dañó el casco (-${dmg}).`)
      return
    }

    if (type === 'treasure') {
      const gold = 4 + Math.floor(Math.random() * 7)
      setPlayer((prev) => ({ ...prev, gold: prev.gold + gold }))
      pushLog(`💰 Encontraste un botín de ${gold} de oro.`)
      return
    }

    const repaired = 5
    const refill = 6
    setPlayer((prev) => ({
      hull: Math.min(prev.hull + repaired, 20),
      supplies: Math.min(prev.supplies + refill, 25),
      gold: prev.gold,
    }))
    pushLog('⚓ Puerto seguro: reparaste casco y reabasteciste víveres.')
  }

  function move(dx: number, dy: number) {
    if (gameOver) return

    const nextX = position.x + dx
    const nextY = position.y + dy
    if (nextX < 0 || nextY < 0 || nextX >= SIZE || nextY >= SIZE) return

    setPosition({ x: nextX, y: nextY })

    setMap((prev) =>
      prev.map((row) =>
        row.map((tile) =>
          tile.x === nextX && tile.y === nextY
            ? {
                ...tile,
                visited: true,
                type: tile.type === 'treasure' ? 'water' : tile.type,
              }
            : tile,
        ),
      ),
    )

    setPlayer((prev) => ({ ...prev, supplies: prev.supplies - 1 }))
    resolveTile(map[nextY][nextX].type)
  }

  function restart() {
    setMap(createMap())
    setPosition({ x: START, y: START })
    setPlayer({ hull: 20, supplies: 20, gold: 0 })
    setLog(['⛵ Nueva expedición lista.'])
  }

  return (
    <main className="page" style={{ maxWidth: 760, margin: '0 auto', padding: '1rem' }}>
      <h1>Sea of Treasures</h1>
      <p style={{ opacity: 0.85 }}>
        Minijuego inspirado en el prototipo de <code>sot.jsx</code>: navegá el mapa, evitá tormentas y juntá oro.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span>❤ Casco: {player.hull}</span>
        <span>🍞 Víveres: {player.supplies}</span>
        <span>💰 Oro: {player.gold}</span>
        <span>
          📍 {TILE_META[currentTile.type].icon} {TILE_META[currentTile.type].label}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
          gap: 4,
          background: 'rgba(255,255,255,0.05)',
          padding: 8,
          borderRadius: 10,
        }}
      >
        {visibleMap.flat().map((tile) => {
          const isShip = tile.x === position.x && tile.y === position.y
          return (
            <button
              key={`${tile.x}-${tile.y}`}
              type="button"
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.18)',
                background: isShip ? '#29466e' : '#10243f',
                color: '#fff',
                fontSize: 18,
              }}
              aria-label={`Tile ${tile.x}-${tile.y}`}
            >
              {isShip ? '⛵' : tile.visible ? TILE_META[tile.type].icon : '·'}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 120px))', gap: 8, marginTop: 14 }}>
        <span />
        <button type="button" onClick={() => move(0, -1)}>↑ Norte</button>
        <span />
        <button type="button" onClick={() => move(-1, 0)}>← Oeste</button>
        <button type="button" onClick={() => move(0, 1)}>↓ Sur</button>
        <button type="button" onClick={() => move(1, 0)}>→ Este</button>
      </div>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1rem' }}>Bitácora</h2>
        <div style={{ display: 'grid', gap: 6 }}>
          {log.map((entry, idx) => (
            <div key={`${entry}-${idx}`} style={{ opacity: 0.9 }}>
              {entry}
            </div>
          ))}
        </div>
      </section>

      {gameOver && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #b95a5a', borderRadius: 10 }}>
          <strong>Fin de la expedición.</strong>
          <p style={{ marginTop: 4 }}>Tu tripulación regresó con {player.gold} de oro acumulado.</p>
          <button type="button" onClick={restart}>Jugar otra vez</button>
        </div>
      )}
    </main>
  )
}
