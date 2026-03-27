import { useState, useEffect, useRef } from 'react'
import Topbar from '../components/Topbar'
import styles from './Chinchon.module.css'

const LIMIT = 100
const SUITS = ['♠', '♥', '♦', '♣']

interface Player {
  name: string
  scores: number[]
  eliminated: boolean
  chinchon: boolean
}

type Phase = 'setup' | 'game' | 'over'

interface GameState {
  v: number
  phase: Phase
  players: Player[]
  dealerIdx: number
  roundDealers: number[]
  winner: Winner | null
}

interface Winner {
  name: string
  reason: string
}

function totalScore(player: Player) {
  return player.scores.reduce((a, b) => a + b, 0)
}

function emptyInputs(len: number): string[] {
  return Array(len).fill('')
}

function emptyFlags(len: number): boolean[] {
  return Array(len).fill(false)
}

export default function Chinchon() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [players, setPlayers] = useState<Player[]>([])
  const [playerCount, setPlayerCount] = useState(2)
  const [setupNames, setSetupNames] = useState(['Facu', 'Dai', '', '', '', ''])
  const [roundInputs, setRoundInputs] = useState<string[]>(emptyInputs(2))
  const [chinchonFlags, setChinchonFlags] = useState<boolean[]>(emptyFlags(2))
  const [minusTenFlags, setMinusTenFlags] = useState<boolean[]>(emptyFlags(2))
  const [dealerIdx, setDealerIdx] = useState(0)
  const [roundDealers, setRoundDealers] = useState<number[]>([])
  const [winner, setWinner] = useState<Winner | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loadOpen, setLoadOpen] = useState(false)
  const [loadText, setLoadText] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  function fireToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2300)
  }

  function evaluateResult(updated: Player[]): { winner: Winner | null; phase: Phase } {
    const chinchonPlayer = updated.find(p => p.chinchon)
    if (chinchonPlayer) return { winner: { name: chinchonPlayer.name, reason: '¡CHINCHÓN!' }, phase: 'over' }
    const active = updated.filter(p => !p.eliminated && !p.chinchon)
    if (active.length === 1) return { winner: { name: active[0].name, reason: 'único sobreviviente' }, phase: 'over' }
    if (active.length === 0) {
      const best = [...updated].sort((a, b) => totalScore(a) - totalScore(b))[0]
      return { winner: { name: best?.name ?? '?', reason: 'menor puntaje' }, phase: 'over' }
    }
    return { winner: null, phase: 'game' }
  }

  function startGame() {
    const names = setupNames.slice(0, playerCount).map((n, i) => n.trim() || `Jugador ${i + 1}`)
    const newPlayers: Player[] = names.map(name => ({ name, scores: [], eliminated: false, chinchon: false }))
    setPlayers(newPlayers)
    setRoundInputs(emptyInputs(playerCount))
    setChinchonFlags(emptyFlags(playerCount))
    setMinusTenFlags(emptyFlags(playerCount))
    setDealerIdx(0)
    setRoundDealers([])
    setWinner(null)
    setLoadOpen(false)
    setPhase('game')
  }

  function addRound() {
    const parsed = roundInputs.map((v, i) => {
      const p = players[i]
      if (p.eliminated || p.chinchon) return 0
      if (chinchonFlags[i]) return 'chinchon' as const
      const base = parseInt(v, 10)
      if (isNaN(base)) return null
      return minusTenFlags[i] ? base - 10 : base
    })

    if (players.some((p, i) => !p.eliminated && !p.chinchon && !chinchonFlags[i] && parsed[i] === null)) {
      fireToast('Faltan puntajes')
      return
    }

    const updated = players.map((p, i) => {
      if (p.eliminated || p.chinchon) return p
      if (parsed[i] === 'chinchon') return { ...p, chinchon: true }
      const newScores = [...p.scores, parsed[i] as number]
      return { ...p, scores: newScores, eliminated: newScores.reduce((a, b) => a + b, 0) >= LIMIT }
    })

    const newRoundDealers = [...roundDealers, dealerIdx]
    let next = (dealerIdx + 1) % updated.length
    for (let t = 0; t < updated.length; t++) {
      if (!updated[next].eliminated && !updated[next].chinchon) break
      next = (next + 1) % updated.length
    }

    const result = evaluateResult(updated)
    setPlayers(updated)
    setRoundDealers(newRoundDealers)
    setDealerIdx(next)
    setRoundInputs(emptyInputs(updated.length))
    setChinchonFlags(emptyFlags(updated.length))
    setMinusTenFlags(emptyFlags(updated.length))
    setWinner(result.winner)
    setPhase(result.phase)
  }

  function reset() {
    setPhase('setup')
    setWinner(null)
    setPlayerCount(prev => players.length || prev)
    setSetupNames(players.length ? [...players.map(p => p.name), '', '', '', ''].slice(0, 6) : setupNames)
    setRoundDealers([])
    setDealerIdx(0)
    setLoadOpen(false)
  }

  function copyState() {
    const state: GameState = { v: 1, phase, players, dealerIdx, roundDealers, winner }
    navigator.clipboard.writeText(JSON.stringify(state))
      .then(() => fireToast('✓ Partida copiada al portapapeles'))
      .catch(() => fireToast('No se pudo copiar'))
  }

  function applyLoad(raw: string) {
    try {
      const state = JSON.parse(raw.trim()) as GameState
      if (!Array.isArray(state.players)) throw new Error('invalid')
      setPlayers(state.players)
      setPhase(state.phase || 'game')
      setWinner(state.winner ?? null)
      setDealerIdx(state.dealerIdx ?? 0)
      setRoundDealers(state.roundDealers || [])
      setRoundInputs(emptyInputs(state.players.length))
      setChinchonFlags(emptyFlags(state.players.length))
      setMinusTenFlags(emptyFlags(state.players.length))
      setLoadOpen(false)
      setLoadText('')
      fireToast('✓ Partida cargada')
    } catch {
      fireToast('❌ Texto inválido')
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      setLoadText(text)
    } catch {
      fireToast('No se pudo leer el portapapeles')
    }
  }

  const maxRounds = Math.max(...players.map(p => p.scores.length), 0)

  return (
    <div className={styles.root}>
      <main className="page">
        <Topbar label="Chinchón" />

        <section className={styles.app}>
          {/* Decorative deck */}
          <div className={styles.deck}>
            {Array.from({ length: 14 }, (_, i) => (
              <span
                key={i}
                style={{
                  fontSize: `${10 + ((i * 7 + 3) % 18)}px`,
                  top: `${(i * 37 + 11) % 100}%`,
                  left: `${(i * 53 + 7) % 100}%`,
                  transform: `rotate(${(i * 47) % 360}deg)`,
                  color: i % 2 === 0 ? 'rgba(180,30,30,.06)' : 'rgba(0,0,0,.05)',
                }}
              >
                {SUITS[i % 4]}
              </span>
            ))}
          </div>

          <div className={styles.hero2}>
            <div className={styles.k}>♣ ANOTADOR ♠</div>
            <h1>Chinchón</h1>
            <div className={styles.sub}>♥ límite: {LIMIT} puntos ♦</div>

            {phase !== 'setup' && (
              <>
                <div className={styles.toolbar}>
                  <button className={`${styles.btn} ${styles.toolbarCopy}`} onClick={copyState}>
                    📋 Copiar partida
                  </button>
                  <button
                    className={`${styles.btn} ${styles.toolbarLoadToggle}`}
                    onClick={() => setLoadOpen(o => !o)}
                  >
                    📂 Cargar partida
                  </button>
                </div>
                {loadOpen && <LoadBox text={loadText} onTextChange={setLoadText} onPaste={pasteFromClipboard} onApply={applyLoad} />}
              </>
            )}
          </div>

          {/* Setup */}
          {phase === 'setup' && (
            <div className={styles.panel}>
              <div className={styles.label}>JUGADORES</div>
              <div className={styles.playerCounts}>
                {[2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    className={`${styles.btn} ${styles.pill} ${playerCount === n ? styles.pillActive : ''}`}
                    onClick={() => setPlayerCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                {Array.from({ length: playerCount }, (_, i) => (
                  <input
                    key={i}
                    className={styles.textInput}
                    placeholder={`Jugador ${i + 1}`}
                    value={setupNames[i] ?? ''}
                    onChange={e => setSetupNames(prev => {
                      const next = [...prev]
                      next[i] = e.target.value
                      return next
                    })}
                  />
                ))}
              </div>
              <button className={`${styles.btn} ${styles.action}`} onClick={startGame}>
                Comenzar partida
              </button>
              <button
                className={`${styles.btn} ${styles.ghost}`}
                onClick={() => setLoadOpen(o => !o)}
              >
                📂 Cargar partida guardada
              </button>
              {loadOpen && <LoadBox text={loadText} onTextChange={setLoadText} onPaste={pasteFromClipboard} onApply={applyLoad} />}
            </div>
          )}

          {/* Winner */}
          {phase === 'over' && winner && (
            <div className={styles.winner}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎴</div>
              <div style={{ fontSize: 11, letterSpacing: 4, color: '#c9a96e', marginBottom: 8 }}>GANADOR</div>
              <div style={{ fontSize: 40, fontWeight: 900, fontStyle: 'italic' }}>{winner.name}</div>
              <div style={{ color: 'rgba(245,230,200,.55)', marginTop: 6, fontStyle: 'italic' }}>
                {winner.reason}
              </div>
              <button
                className={styles.btn}
                onClick={reset}
                style={{
                  marginTop: 24, padding: '12px 32px', background: 'transparent',
                  border: '1px solid #c9a96e', borderRadius: 8, color: '#c9a96e',
                  fontSize: 16, letterSpacing: 2,
                }}
              >
                Nueva partida
              </button>
            </div>
          )}

          {/* Game */}
          {phase !== 'setup' && (
            <>
              {/* Totals */}
              <div
                className={styles.totals}
                style={{ gridTemplateColumns: `repeat(${players.length}, 1fr)` }}
              >
                {players.map((player, idx) => {
                  const score = totalScore(player)
                  const pct = Math.min((score / LIMIT) * 100, 100)
                  const danger = score >= LIMIT * 0.7
                  const isDealer = phase === 'game' && dealerIdx === idx && !player.eliminated && !player.chinchon
                  return (
                    <div
                      key={player.name}
                      className={styles.totalCard}
                      style={{
                        borderColor: player.eliminated
                          ? 'rgba(200,50,50,.4)'
                          : player.chinchon ? 'rgba(201,169,110,.6)'
                          : isDealer ? 'rgba(100,180,255,.45)'
                          : 'rgba(255,255,255,.1)',
                        opacity: player.eliminated ? 0.5 : 1,
                      }}
                    >
                      {player.chinchon && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#c9a96e,#e8c97a,#c9a96e)' }} />
                      )}
                      {isDealer && (
                        <>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#5bb3ff,#a0d8ff,#5bb3ff)' }} />
                          <div style={{ fontSize: 9, letterSpacing: 2, color: '#7ecfff', marginBottom: 2 }}>🃏 REPARTE</div>
                        </>
                      )}
                      <div className={styles.playerName}>{player.name}</div>
                      <div
                        className={styles.scoreValue}
                        style={{ color: player.chinchon ? '#e8c97a' : danger ? '#e87a7a' : '#f5e6c8' }}
                      >
                        {player.chinchon ? '🎴' : player.eliminated ? '✗' : score}
                      </div>
                      {!player.chinchon && !player.eliminated && (
                        <div className={styles.bar}>
                          <div style={{
                            width: `${pct}%`,
                            background: danger
                              ? 'linear-gradient(90deg,#c0392b,#e74c3c)'
                              : 'linear-gradient(90deg,#27ae60,#2ecc71)',
                          }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* History */}
              {maxRounds > 0 && (
                <div className={`${styles.panel} ${styles.historyBox}`}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>#</th>
                        <th>🃏</th>
                        {players.map(p => <th key={p.name}>{p.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: maxRounds }, (_, round) => (
                        <tr key={round}>
                          <td style={{ textAlign: 'left', color: 'rgba(245,230,200,.3)' }}>{round + 1}</td>
                          <td style={{ color: 'rgba(126,207,255,.55)' }}>
                            {roundDealers[round] !== undefined
                              ? (players[roundDealers[round]]?.name?.slice(0, 4) ?? '?')
                              : '—'}
                          </td>
                          {players.map(p => {
                            const val = p.scores[round]
                            const color = val === undefined
                              ? 'rgba(245,230,200,.13)'
                              : val === 0 ? '#7ee87e'
                              : val < 0 ? '#7ecfff'
                              : '#f5e6c8'
                            return (
                              <td key={p.name} style={{ color }}>
                                {val === undefined ? '—' : val}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td colSpan={2} style={{ textAlign: 'left' }}>TOTAL</td>
                        {players.map(p => (
                          <td
                            key={p.name}
                            style={{
                              fontWeight: 700,
                              fontSize: 16,
                              color: p.eliminated ? '#e87a7a' : p.chinchon ? '#e8c97a' : '#f5e6c8',
                            }}
                          >
                            {p.chinchon ? '🎴' : totalScore(p)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Round input */}
              {phase === 'game' && (
                <div className={styles.panel}>
                  <div className={styles.roundSetup}>
                    <div>
                      <div className={styles.label} style={{ marginBottom: 7, color: 'rgba(126,207,255,.65)' }}>
                        🃏 REPARTE EN RONDA {maxRounds + 1}
                      </div>
                      <div className={styles.dealerRow}>
                        {players.map((p, idx) => {
                          if (p.eliminated || p.chinchon) return null
                          return (
                            <button
                              key={p.name}
                              className={`${styles.btn} ${styles.mini} ${dealerIdx === idx ? styles.miniActive : ''}`}
                              onClick={() => setDealerIdx(idx)}
                            >
                              {p.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <div className={styles.label}>RONDA {maxRounds + 1}</div>
                      <div
                        className={styles.roundGrid}
                        style={{ gridTemplateColumns: `repeat(${players.length}, 1fr)` }}
                      >
                        {players.map((player, idx) => (
                          <div
                            key={player.name}
                            className={styles.roundCard}
                            style={{ opacity: player.eliminated ? 0.3 : 1 }}
                          >
                            {!player.eliminated && !player.chinchon ? (
                              <>
                                <div className={styles.playerName} style={{ marginBottom: 6 }}>
                                  {player.name}
                                </div>
                                <input
                                  className={styles.scoreInput}
                                  type="number"
                                  min={-10}
                                  max={110}
                                  placeholder="pts"
                                  disabled={chinchonFlags[idx]}
                                  value={chinchonFlags[idx] ? '' : (roundInputs[idx] ?? '')}
                                  onChange={e => setRoundInputs(prev => {
                                    const next = [...prev]
                                    next[idx] = e.target.value
                                    return next
                                  })}
                                />
                                <div style={{ marginTop: 6 }}>
                                  <button
                                    className={`${styles.btn} ${styles.mini} ${minusTenFlags[idx] ? styles.miniActive : ''}`}
                                    onClick={() => setMinusTenFlags(prev => {
                                      const next = [...prev]
                                      next[idx] = !next[idx]
                                      return next
                                    })}
                                  >
                                    {minusTenFlags[idx] ? '−10 ✓' : '−10'}
                                  </button>
                                </div>
                                <label className={styles.check}>
                                  <input
                                    type="checkbox"
                                    checked={chinchonFlags[idx]}
                                    onChange={e => {
                                      setChinchonFlags(prev => {
                                        const next = [...prev]
                                        next[idx] = e.target.checked
                                        return next
                                      })
                                      if (e.target.checked) {
                                        setRoundInputs(prev => { const n = [...prev]; n[idx] = ''; return n })
                                        setMinusTenFlags(prev => { const n = [...prev]; n[idx] = false; return n })
                                      }
                                    }}
                                  />
                                  {' '}Chinchón
                                </label>
                              </>
                            ) : (
                              <>
                                <div className={styles.playerName} style={{ marginBottom: 6 }}>
                                  {player.name}
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(245,230,200,.22)', fontStyle: 'italic', marginTop: 8 }}>
                                  {player.chinchon ? '🎴' : 'eliminado'}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button className={`${styles.btn} ${styles.add}`} onClick={addRound}>
                      + Agregar ronda
                    </button>
                  </div>
                </div>
              )}

              <button className={`${styles.btn} ${styles.ghost}`} onClick={reset}>
                Reiniciar partida
              </button>
            </>
          )}
        </section>
      </main>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}

interface LoadBoxProps {
  text: string
  onTextChange: (t: string) => void
  onPaste: () => void
  onApply: (t: string) => void
}

function LoadBox({ text, onTextChange, onPaste, onApply }: LoadBoxProps) {
  return (
    <div className={styles.load}>
      <textarea
        className={styles.loadTextarea}
        rows={3}
        placeholder="Pegá el texto de la partida acá…"
        value={text}
        onChange={e => onTextChange(e.target.value)}
      />
      <div className={styles.loadActions}>
        <button className={`${styles.btn} ${styles.smallBtn}`} onClick={onPaste}>
          📋 Pegar
        </button>
        <button
          className={`${styles.btn} ${styles.smallBtn} ${styles.smallBtnPrimary}`}
          onClick={() => onApply(text)}
        >
          Cargar ✓
        </button>
      </div>
    </div>
  )
}
