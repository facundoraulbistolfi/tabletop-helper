import { useEffect, useMemo, useRef, useState } from 'react'
import Topbar from '../components/Topbar'
import styles from './PointCounter.module.css'

type PlayerId = string

interface Player {
  id: PlayerId
  name: string
  color: string
  score: number
}

interface CounterSettings {
  quickIncrement: number
  sliderMin: number
  sliderMax: number
  allowNegative: boolean
  confirmReset: boolean
}

type ScoreAction =
  | { type: 'increment'; playerId: PlayerId; amount: number; timestamp: number }
  | { type: 'decrement'; playerId: PlayerId; amount: number; timestamp: number }
  | { type: 'set-score'; playerId: PlayerId; previousValue: number; nextValue: number; timestamp: number }
  | { type: 'reset'; previousScores: Record<PlayerId, number>; timestamp: number }

interface CounterState {
  players: Player[]
  settings: CounterSettings
  history: ScoreAction[]
  updatedAt: number
}

const STORAGE_KEY = 'tabletop-point-counter-state-v1'
const LONG_PRESS_MS = 400
const DEFAULT_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#10B981',
  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF',
]

function makeId() {
  return crypto.randomUUID()
}

function getTextColor(background: string) {
  const hex = background.replace('#', '')
  const parsed = hex.length === 3
    ? hex.split('').map(ch => ch + ch).join('')
    : hex

  if (!/^[0-9a-fA-F]{6}$/.test(parsed)) return '#111827'

  const r = Number.parseInt(parsed.slice(0, 2), 16)
  const g = Number.parseInt(parsed.slice(2, 4), 16)
  const b = Number.parseInt(parsed.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#111827' : '#F9FAFB'
}

function makeDefaultState(): CounterState {
  return {
    players: [0, 1].map(index => ({
      id: makeId(),
      name: `Jugador ${index + 1}`,
      color: DEFAULT_COLORS[index],
      score: 0,
    })),
    settings: {
      quickIncrement: 1,
      sliderMin: 1,
      sliderMax: 20,
      allowNegative: false,
      confirmReset: true,
    },
    history: [],
    updatedAt: Date.now(),
  }
}

function sanitizeState(raw: CounterState): CounterState {
  const sliderMin = Math.max(1, Math.floor(raw.settings.sliderMin || 1))
  const sliderMax = Math.max(sliderMin, Math.floor(raw.settings.sliderMax || 20))

  return {
    players: raw.players.map((player, index) => ({
      ...player,
      name: player.name.trim() || `Jugador ${index + 1}`,
      score: Number.isFinite(player.score) ? player.score : 0,
      color: player.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    })),
    settings: {
      quickIncrement: Math.max(1, Math.floor(raw.settings.quickIncrement || 1)),
      sliderMin,
      sliderMax,
      allowNegative: Boolean(raw.settings.allowNegative),
      confirmReset: raw.settings.confirmReset !== false,
    },
    history: Array.isArray(raw.history) ? raw.history.slice(-50) : [],
    updatedAt: Date.now(),
  }
}

export default function PointCounter() {
  const [state, setState] = useState<CounterState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return makeDefaultState()
      return sanitizeState(JSON.parse(stored) as CounterState)
    } catch {
      return makeDefaultState()
    }
  })

  const [setupCount, setSetupCount] = useState(state.players.length)
  const [phase, setPhase] = useState<'setup' | 'game'>(state.players.length >= 2 ? 'game' : 'setup')
  const [activePlayerId, setActivePlayerId] = useState<PlayerId | null>(null)
  const [sliderValue, setSliderValue] = useState(1)
  const [mode, setMode] = useState<'add' | 'subtract'>('add')
  const [manualScore, setManualScore] = useState('0')
  const [feedback, setFeedback] = useState<{ playerId: PlayerId; label: string } | null>(null)
  const [pointerState, setPointerState] = useState<{ playerId: PlayerId; status: 'pressed' | 'pending' } | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const cancelPressRef = useRef(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }))
  }, [state])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 800)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const activePlayer = useMemo(
    () => state.players.find(player => player.id === activePlayerId) ?? null,
    [state.players, activePlayerId],
  )

  const historyAvailable = state.history.length > 0

  function commit(action: ScoreAction, recipe: (players: Player[]) => Player[]) {
    setState(prev => ({
      ...prev,
      players: recipe(prev.players),
      history: [...prev.history.slice(-49), action],
      updatedAt: Date.now(),
    }))
  }

  function openToolbox(playerId: PlayerId) {
    setActivePlayerId(playerId)
    setSliderValue(state.settings.sliderMin)
    setMode('add')
    const player = state.players.find(item => item.id === playerId)
    setManualScore(String(player?.score ?? 0))
    setPointerState({ playerId, status: 'pending' })
  }

  function applyQuickIncrement(playerId: PlayerId) {
    const amount = state.settings.quickIncrement
    commit({ type: 'increment', playerId, amount, timestamp: Date.now() }, players =>
      players.map(player =>
        player.id === playerId
          ? { ...player, score: player.score + amount }
          : player,
      ),
    )
    setFeedback({ playerId, label: `+${amount}` })
  }

  function applyAdvanced() {
    if (!activePlayer) return
    const amount = sliderValue
    const isSubtract = mode === 'subtract'
    if (isSubtract && !state.settings.allowNegative) return

    commit(
      {
        type: isSubtract ? 'decrement' : 'increment',
        playerId: activePlayer.id,
        amount,
        timestamp: Date.now(),
      },
      players => players.map(player => {
        if (player.id !== activePlayer.id) return player
        const nextScore = isSubtract ? player.score - amount : player.score + amount
        return {
          ...player,
          score: !state.settings.allowNegative ? Math.max(0, nextScore) : nextScore,
        }
      }),
    )

    setFeedback({ playerId: activePlayer.id, label: `${isSubtract ? '-' : '+'}${amount}` })
    closeToolbox()
  }

  function applyManualScore() {
    if (!activePlayer) return
    const parsed = Number.parseInt(manualScore, 10)
    if (!Number.isFinite(parsed)) return
    const nextValue = !state.settings.allowNegative ? Math.max(0, parsed) : parsed

    commit(
      {
        type: 'set-score',
        playerId: activePlayer.id,
        previousValue: activePlayer.score,
        nextValue,
        timestamp: Date.now(),
      },
      players => players.map(player => (
        player.id === activePlayer.id ? { ...player, score: nextValue } : player
      )),
    )

    setFeedback({ playerId: activePlayer.id, label: `= ${nextValue}` })
    closeToolbox()
  }

  function closeToolbox() {
    setActivePlayerId(null)
    setPointerState(null)
  }

  function undoLastAction() {
    setState(prev => {
      const last = prev.history[prev.history.length - 1]
      if (!last) return prev
      let players = prev.players

      if (last.type === 'increment') {
        players = prev.players.map(player =>
          player.id === last.playerId
            ? { ...player, score: player.score - last.amount }
            : player,
        )
      }

      if (last.type === 'decrement') {
        players = prev.players.map(player =>
          player.id === last.playerId
            ? { ...player, score: player.score + last.amount }
            : player,
        )
      }

      if (last.type === 'set-score') {
        players = prev.players.map(player =>
          player.id === last.playerId
            ? { ...player, score: last.previousValue }
            : player,
        )
      }

      if (last.type === 'reset') {
        players = prev.players.map(player => ({
          ...player,
          score: last.previousScores[player.id] ?? 0,
        }))
      }

      return {
        ...prev,
        players,
        history: prev.history.slice(0, -1),
        updatedAt: Date.now(),
      }
    })
  }

  function resetScores() {
    if (state.settings.confirmReset) {
      const accepted = window.confirm('¿Seguro que querés resetear los puntajes?')
      if (!accepted) return
    }

    const previousScores = Object.fromEntries(state.players.map(player => [player.id, player.score]))
    commit(
      { type: 'reset', previousScores, timestamp: Date.now() },
      players => players.map(player => ({
        ...player,
        score: 0,
      })),
    )

  }

  function resetAll() {
    if (window.confirm('Se reiniciará toda la herramienta. ¿Continuar?')) {
      const fresh = makeDefaultState()
      setState(fresh)
      setSetupCount(fresh.players.length)
      setPhase('setup')
      setActivePlayerId(null)
    }
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  function onPlayerPointerDown(playerId: PlayerId) {
    clearLongPressTimer()
    longPressTriggeredRef.current = false
    cancelPressRef.current = false
    setPointerState({ playerId, status: 'pressed' })

    longPressTimerRef.current = window.setTimeout(() => {
      if (cancelPressRef.current) return
      longPressTriggeredRef.current = true
      openToolbox(playerId)
    }, LONG_PRESS_MS)
  }

  function onPlayerPointerUp(playerId: PlayerId) {
    clearLongPressTimer()

    if (!longPressTriggeredRef.current && !cancelPressRef.current) {
      applyQuickIncrement(playerId)
    }

    setTimeout(() => setPointerState(prev => (prev?.playerId === playerId ? null : prev)), 80)
  }

  function onPlayerPointerLeave() {
    cancelPressRef.current = true
    clearLongPressTimer()
    setPointerState(null)
  }

  function adjustSetupPlayers(nextCount: number) {
    const bounded = Math.max(2, Math.min(12, nextCount))
    setSetupCount(bounded)
    setState(prev => {
      let players = [...prev.players]
      if (bounded > players.length) {
        for (let i = players.length; i < bounded; i += 1) {
          players.push({
            id: makeId(),
            name: `Jugador ${i + 1}`,
            color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
            score: 0,
          })
        }
      } else {
        players = players.slice(0, bounded)
      }
      return { ...prev, players }
    })
  }

  function updatePlayer(playerId: PlayerId, patch: Partial<Player>) {
    setState(prev => ({
      ...prev,
      players: prev.players.map(player => (player.id === playerId ? { ...player, ...patch } : player)),
    }))
  }

  function movePlayer(playerId: PlayerId, direction: -1 | 1) {
    setState(prev => {
      const index = prev.players.findIndex(player => player.id === playerId)
      if (index < 0) return prev
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.players.length) return prev
      const players = [...prev.players]
      const [item] = players.splice(index, 1)
      players.splice(nextIndex, 0, item)
      return { ...prev, players }
    })
  }

  function updateSettings(patch: Partial<CounterSettings>) {
    setState(prev => {
      const merged = { ...prev.settings, ...patch }
      const sliderMin = Math.max(1, merged.sliderMin)
      const sliderMax = Math.max(sliderMin, merged.sliderMax)
      return {
        ...prev,
        settings: {
          ...merged,
          sliderMin,
          sliderMax,
        },
      }
    })
  }

  function startGame() {
    setState(prev => ({
      ...prev,
      players: prev.players.map((player, index) => ({
        ...player,
        name: player.name.trim() || `Jugador ${index + 1}`,
      })),
      history: [],
    }))
    setPhase('game')
  }

  return (
    <main className="page">
      <Topbar label="Contador de Puntos" sublabel="Scoreboard rápido" />

      <section className={styles.header}>
        <h1>Contador de Puntos</h1>
        <p>Tap corto para sumar rápido. Mantené presionado para suma avanzada y edición manual.</p>
      </section>

      {phase === 'setup' ? (
        <section className={styles.setupPanel}>
          <h2>Setup inicial</h2>
          <div className={styles.setupControls}>
            <label>
              Jugadores (2 a 12)
              <input
                type="number"
                min={2}
                max={12}
                value={setupCount}
                onChange={event => adjustSetupPlayers(Number.parseInt(event.target.value, 10) || 2)}
              />
            </label>
            <label>
              Incremento rápido
              <input
                type="number"
                min={1}
                value={state.settings.quickIncrement}
                onChange={event => updateSettings({ quickIncrement: Number.parseInt(event.target.value, 10) || 1 })}
              />
            </label>
            <label>
              Slider máximo
              <input
                type="number"
                min={1}
                value={state.settings.sliderMax}
                onChange={event => updateSettings({ sliderMax: Number.parseInt(event.target.value, 10) || 20 })}
              />
            </label>
          </div>

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={state.settings.allowNegative}
              onChange={event => updateSettings({ allowNegative: event.target.checked })}
            />
            Permitir restar puntos
          </label>

          <div className={styles.playersSetup}>
            {state.players.map((player, index) => (
              <article key={player.id} className={styles.playerSetupRow}>
                <span className={styles.playerIndex}>{index + 1}</span>
                <input
                  type="text"
                  value={player.name}
                  maxLength={24}
                  aria-label={`Nombre del jugador ${index + 1}`}
                  onChange={event => updatePlayer(player.id, { name: event.target.value })}
                />
                <select
                  value={player.color}
                  aria-label={`Color de ${player.name || `Jugador ${index + 1}`}`}
                  onChange={event => updatePlayer(player.id, { color: event.target.value })}
                >
                  {DEFAULT_COLORS.map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={player.color}
                  onChange={event => updatePlayer(player.id, { color: event.target.value })}
                  aria-label={`Color HEX manual para ${player.name || `Jugador ${index + 1}`}`}
                />
                <div className={styles.reorderButtons}>
                  <button type="button" onClick={() => movePlayer(player.id, -1)} aria-label={`Subir ${player.name}`}>↑</button>
                  <button type="button" onClick={() => movePlayer(player.id, 1)} aria-label={`Bajar ${player.name}`}>↓</button>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.setupActions}>
            <button className="cta" type="button" onClick={resetAll}>Reiniciar todo</button>
            <button className="cta primary" type="button" onClick={startGame}>Iniciar partida</button>
          </div>
        </section>
      ) : (
        <>
          <section className={styles.globalActions}>
            <button className="cta" type="button" onClick={() => setPhase('setup')}>Editar setup</button>
            <button className="cta" type="button" onClick={undoLastAction} disabled={!historyAvailable}>Deshacer</button>
            <button className="cta" type="button" onClick={resetScores}>Reset puntajes</button>
            <button className="cta" type="button" onClick={resetAll}>Reiniciar todo</button>
          </section>

          <section className={styles.scoreGrid} aria-label="Jugadores">
            {state.players.map(player => {
              const active = pointerState?.playerId === player.id
              const textColor = getTextColor(player.color)
              const playerFeedback = feedback?.playerId === player.id ? feedback.label : null
              return (
                <button
                  type="button"
                  key={player.id}
                  className={`${styles.playerCard} ${active ? styles.playerCardActive : ''}`}
                  style={{
                    background: `linear-gradient(145deg, ${player.color}, rgba(0,0,0,0.22))`,
                    color: textColor,
                  }}
                  onPointerDown={() => onPlayerPointerDown(player.id)}
                  onPointerUp={() => onPlayerPointerUp(player.id)}
                  onPointerLeave={onPlayerPointerLeave}
                  onContextMenu={event => event.preventDefault()}
                  aria-label={`Sumar ${state.settings.quickIncrement} punto a ${player.name}`}
                >
                  <span className={styles.playerName}>{player.name}</span>
                  <span className={styles.playerScore}>{player.score}</span>
                  {playerFeedback && <span className={styles.floatBadge}>{playerFeedback}</span>}
                </button>
              )
            })}
          </section>
        </>
      )}

      {activePlayer && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Suma avanzada para ${activePlayer.name}`}>
          <section className={styles.toolbox}>
            <header>
              <p className={styles.toolboxName}>{activePlayer.name}</p>
              <p className={styles.toolboxScore}>Puntaje actual: {activePlayer.score}</p>
            </header>

            <label className={styles.sliderLabel}>
              Cantidad: {sliderValue}
              <input
                type="range"
                min={state.settings.sliderMin}
                max={state.settings.sliderMax}
                step={1}
                value={sliderValue}
                onChange={event => setSliderValue(Number.parseInt(event.target.value, 10))}
              />
            </label>

            {state.settings.allowNegative && (
              <div className={styles.modeSwitch}>
                <button
                  type="button"
                  className={mode === 'add' ? styles.modeActive : ''}
                  onClick={() => setMode('add')}
                >
                  Sumar
                </button>
                <button
                  type="button"
                  className={mode === 'subtract' ? styles.modeActive : ''}
                  onClick={() => setMode('subtract')}
                >
                  Restar
                </button>
              </div>
            )}

            <div className={styles.toolboxActions}>
              <button type="button" className="cta primary" onClick={applyAdvanced}>
                {mode === 'subtract' ? `Restar -${sliderValue}` : `Sumar +${sliderValue}`}
              </button>
              <button type="button" className="cta" onClick={closeToolbox}>Cancelar</button>
            </div>

            <div className={styles.manualEdit}>
              <label>
                Puntaje exacto
                <input
                  type="number"
                  value={manualScore}
                  onChange={event => setManualScore(event.target.value)}
                />
              </label>
              <button type="button" className="cta" onClick={applyManualScore}>Guardar valor</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
