import { useState, useMemo } from 'react'
import Topbar from '../components/Topbar'
import styles from './SudokuKiller.module.css'

type DigitState = 'neutral' | 'required' | 'excluded'
type PairState = 'required' | 'excluded'

const DIGIT_CYCLE: Record<DigitState, DigitState> = {
  neutral: 'required',
  required: 'excluded',
  excluded: 'neutral',
}

const KD_DIFFICULTIES = [
  { label: 'Intermediate', code: 'IM', vols: 25 },
  { label: 'Tough', code: 'TF', vols: 20 },
  { label: 'Challenging', code: 'CH', vols: 20 },
  { label: 'Super-Tough', code: 'ST', vols: 10 },
]

const INITIAL_DIGIT_STATES: Record<number, DigitState> = {
  1: 'neutral', 2: 'neutral', 3: 'neutral', 4: 'neutral', 5: 'neutral',
  6: 'neutral', 7: 'neutral', 8: 'neutral', 9: 'neutral',
}

function minSum(n: number) {
  return (n * (n + 1)) / 2
}

function maxSum(n: number) {
  let t = 0
  for (let i = 9; i > 9 - n; i--) t += i
  return t
}

function pairKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function computeCombinations(
  target: number,
  cells: number,
  excluded: Set<number>,
  required: Set<number>,
): number[][] {
  const out: number[][] = []
  const cur: number[] = []

  function walk(start: number, remaining: number) {
    if (cur.length === cells) {
      if (remaining === 0) out.push([...cur])
      return
    }
    for (let d = start; d <= 9; d++) {
      if (excluded.has(d)) continue
      if (d > remaining) break
      cur.push(d)
      walk(d + 1, remaining - d)
      cur.pop()
    }
  }

  walk(1, target)
  return out.filter(combo => [...required].every(d => combo.includes(d)))
}

export default function SudokuKiller() {
  const [size, setSize] = useState<number | null>(null)
  const [sum, setSum] = useState<number | null>(null)
  const [digitStates, setDigitStates] = useState<Record<number, DigitState>>(INITIAL_DIGIT_STATES)
  const [pairStates, setPairStates] = useState<Record<string, PairState>>({})
  const [activeTab, setActiveTab] = useState<'solver' | 'kd'>('solver')
  const [kdDifficulty, setKdDifficulty] = useState('IM')
  const [kdVolume, setKdVolume] = useState(1)
  const [kdBook, setKdBook] = useState(1)

  const excluded = useMemo(
    () => new Set(Object.entries(digitStates).filter(([, v]) => v === 'excluded').map(([k]) => Number(k))),
    [digitStates],
  )
  const required = useMemo(
    () => new Set(Object.entries(digitStates).filter(([, v]) => v === 'required').map(([k]) => Number(k))),
    [digitStates],
  )

  const rangeMin = size !== null ? minSum(size) : 1
  const rangeMax = size !== null ? maxSum(size) : 45

  const error = useMemo(() => {
    if (size === null || sum === null) return null
    if (sum < minSum(size) || sum > maxSum(size))
      return `La suma para ${size} celdas debe estar entre ${minSum(size)} y ${maxSum(size)}.`
    if (required.size > size)
      return 'Hay más dígitos requeridos que celdas disponibles.'
    return null
  }, [size, sum, required])

  const combos = useMemo(() => {
    if (size === null || sum === null || error !== null) return []
    const base = computeCombinations(sum, size, excluded, required)
    const rules = Object.entries(pairStates)
    if (!rules.length) return base
    return base.filter(combo =>
      rules.every(([key, state]) => {
        const [a, b] = key.split('-').map(Number)
        const hasA = combo.includes(a)
        const hasB = combo.includes(b)
        if (state === 'required') return hasA && hasB
        return !(hasA && hasB)
      }),
    )
  }, [size, sum, error, excluded, required, pairStates])

  const freq = useMemo(() => {
    const f: Record<number, number> = {}
    combos.forEach(combo => combo.forEach(d => { f[d] = (f[d] ?? 0) + 1 }))
    return f
  }, [combos])

  function cycleDigit(d: number) {
    setDigitStates(prev => ({ ...prev, [d]: DIGIT_CYCLE[prev[d]] }))
  }

  function cyclePair(a: number, b: number) {
    const key = pairKey(a, b)
    setPairStates(prev => {
      const cur = prev[key]
      if (!cur) return { ...prev, [key]: 'required' as PairState }
      if (cur === 'required') return { ...prev, [key]: 'excluded' as PairState }
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function advancePairTag(key: string, state: PairState) {
    setPairStates(prev => {
      if (state === 'required') return { ...prev, [key]: 'excluded' as PairState }
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleSizeClick(v: number) {
    const mn = minSum(v)
    const mx = maxSum(v)
    setSize(v)
    setSum(prev => (prev === null || prev < mn || prev > mx) ? mn : prev)
  }

  // KrazyDad computed
  const kdDiff = KD_DIFFICULTIES.find(d => d.code === kdDifficulty) ?? KD_DIFFICULTIES[0]
  const safeVolume = Math.min(kdVolume, kdDiff.vols)
  const sv = safeVolume === 1 ? kdDiff.code : `${kdDiff.code}${safeVolume}`
  const kdPageUrl = `https://krazydad.com/killersudoku/index.php?sv=${sv}`
  const kdPdfUrl = `https://files.krazydad.com/killersudoku/sfiles/KD_Killer_${kdDiff.code}${safeVolume}_8_v${kdBook}.pdf`

  return (
    <div className={styles.root}>
      <main className="page">
        <Topbar label="Sudoku Killer" />

        <section className={styles.app}>
          <div className={styles.hero2}>
            <div className={styles.k}>Killer Sudoku</div>
            <h1>Cage Solver</h1>
            <p>Combinaciones válidas, filtros y acceso rápido a KrazyDad.</p>
          </div>

          <div className={styles.tabs}>
            <button
              className={activeTab === 'solver' ? styles.active : ''}
              onClick={() => setActiveTab('solver')}
            >
              Solver
            </button>
            <button
              className={activeTab === 'kd' ? styles.active : ''}
              onClick={() => setActiveTab('kd')}
            >
              KrazyDad
            </button>
          </div>

          {activeTab === 'solver' && (
            <>
              {/* Parámetros */}
              <div className={styles.panel}>
                <div className={styles.label}>Parámetros</div>
                <div className={styles.grid}>
                  <div className={styles.field}>
                    <label>Celdas</label>
                    <div className={styles.sizeRow}>
                      {[2, 3, 4, 5, 6, 7, 8, 9].map(v => (
                        <button
                          key={v}
                          className={`${styles.btn} ${size === v ? styles.btnActive : ''}`}
                          onClick={() => handleSizeClick(v)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Suma</label>
                    <div className={styles.rangeWrap}>
                      <div className={styles.rangeTop}>
                        <div className={styles.rangeValue}>{sum !== null ? sum : '—'}</div>
                        <div className={styles.rangeHint}>
                          {size !== null ? `${rangeMin}–${rangeMax}` : 'Elegí celdas primero'}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={rangeMin}
                        max={rangeMax}
                        value={sum ?? rangeMin}
                        disabled={size === null}
                        onChange={e => setSum(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
                {error && <div className={styles.error}>⚠ {error}</div>}
              </div>

              {/* Dígitos */}
              <div className={styles.panel}>
                <div className={styles.label}>Dígitos</div>
                <div className={styles.small} style={{ marginBottom: 10 }}>
                  Click para ciclar: neutro → requerido → excluido
                </div>
                <div className={styles.digitRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
                    const state = digitStates[d]
                    return (
                      <button
                        key={d}
                        className={`${styles.btn} ${state === 'required' ? styles.btnReq : state === 'excluded' ? styles.btnExc : ''}`}
                        onClick={() => cycleDigit(d)}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Combinaciones */}
              <div className={styles.panel}>
                <div className={styles.resultsHead}>
                  <div className={styles.label} style={{ margin: 0 }}>Combinaciones</div>
                  {size !== null && sum !== null && !error && (
                    <div className={styles.resultsCount}>
                      {combos.length} resultado{combos.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                {size === null || sum === null ? (
                  <div className={styles.mutedCenter}>Elegí cantidad de celdas y suma.</div>
                ) : error ? (
                  <div className={styles.mutedCenter}>No hay resultados válidos.</div>
                ) : combos.length === 0 ? (
                  <div className={styles.mutedCenter}>
                    No existen combinaciones con los filtros actuales.
                  </div>
                ) : (
                  <div className={styles.list}>
                    {combos.map((combo, i) => (
                      <div key={i} className={styles.row}>
                        <div className={styles.index}>{i + 1}</div>
                        <div className={styles.digits}>
                          {combo.map(d => (
                            <div
                              key={d}
                              className={`${styles.chip2} ${required.has(d) ? styles.chip2Req : ''}`}
                            >
                              {d}
                            </div>
                          ))}
                        </div>
                        <div className={styles.resultsCount}>
                          Σ {combo.reduce((a, b) => a + b, 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Frecuencia */}
              {combos.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.label}>Frecuencia</div>
                  <div className={styles.freq}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
                      const count = freq[d] ?? 0
                      const pct = combos.length ? Math.round((count / combos.length) * 100) : 0
                      const always = count === combos.length && combos.length > 0
                      return (
                        <div
                          key={d}
                          className={styles.freqItem}
                          style={{ opacity: count === 0 ? 0.28 : 1 }}
                        >
                          <div className={`${styles.freqBox} ${always ? styles.freqBoxAlways : ''}`}>
                            {d}
                          </div>
                          <div className={`${styles.freqPct} ${always ? styles.freqPctAlways : ''}`}>
                            {pct}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Pares vinculados */}
              <div className={styles.panel}>
                <div className={styles.label}>Pares vinculados</div>
                <div className={styles.small} style={{ marginBottom: 12 }}>
                  Click para ciclar: neutro → juntos → prohibido
                </div>
                <div className={styles.matrix}>
                  <div className={styles.mrow}>
                    <div className={`${styles.cell} ${styles.cellAxis}`} />
                    {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                      <div key={n} className={`${styles.cell} ${styles.cellAxis}`}>{n}</div>
                    ))}
                  </div>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(row => (
                    <div key={row} className={styles.mrow}>
                      <div className={`${styles.cell} ${styles.cellAxis}`}>{row}</div>
                      {[2, 3, 4, 5, 6, 7, 8, 9].map(col => {
                        if (col <= row) {
                          return (
                            <div key={col} className={`${styles.cell} ${styles.cellDiag}`}>·</div>
                          )
                        }
                        const key = pairKey(row, col)
                        const state = pairStates[key]
                        return (
                          <div
                            key={col}
                            className={`${styles.cell} ${state === 'required' ? styles.cellReq : state === 'excluded' ? styles.cellExc : ''}`}
                            onClick={() => cyclePair(row, col)}
                          >
                            {state === 'required' ? '✓' : state === 'excluded' ? '✕' : '·'}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                {Object.keys(pairStates).length > 0 && (
                  <div className={styles.tags}>
                    {Object.entries(pairStates).map(([key, state]) => {
                      const [a, b] = key.split('-')
                      return (
                        <div
                          key={key}
                          className={`${styles.tag} ${state === 'required' ? styles.tagReq : styles.tagExc}`}
                          onClick={() => advancePairTag(key, state)}
                        >
                          {a} {state === 'required' ? '✓' : '✕'} {b}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'kd' && (
            <div className={styles.panel}>
              <div className={styles.label}>KrazyDad</div>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label>Dificultad</label>
                  <select
                    value={kdDifficulty}
                    onChange={e => { setKdDifficulty(e.target.value); setKdVolume(1) }}
                  >
                    {KD_DIFFICULTIES.map(d => (
                      <option key={d.code} value={d.code}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Volumen</label>
                  <select value={safeVolume} onChange={e => setKdVolume(Number(e.target.value))}>
                    {Array.from({ length: kdDiff.vols }, (_, i) => i + 1).map(v => (
                      <option key={v} value={v}>Vol. {v}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Libro</label>
                  <select value={kdBook} onChange={e => setKdBook(Number(e.target.value))}>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(b => (
                      <option key={b} value={b}>Libro {b}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.linkbox} style={{ marginTop: 16 }}>
                <div className={styles.small}>{kdPdfUrl}</div>
                <a className={styles.kdLink} href={kdPdfUrl} target="_blank" rel="noreferrer">
                  Abrir PDF
                </a>
                <a
                  className={`${styles.kdLink} ${styles.kdLinkSecondary}`}
                  href={kdPageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver volumen en KrazyDad
                </a>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
