import { useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import styles from './Truco.module.css'

const MAX_SCORE = 30
const HALF_SCORE = 15

type TeamKey = 'nosotros' | 'ellos'

const DEFAULT_NAMES: Record<TeamKey, string> = {
  nosotros: 'Nosotros',
  ellos: 'Ellos',
}

/* ── Palitos SVG ─────────────────────────────────────────────────────────── */

function PalitosSvg({ count }: { count: number }) {
  const groups = Math.floor(count / 5)
  const loose = count % 5
  const marks: JSX.Element[] = []
  const W = 28   // ancho por palito individual
  const GW = 28 * 5 + 14 // ancho de un grupo de 5
  const H = 52
  const PAD = 8

  let x = PAD

  for (let g = 0; g < groups; g++) {
    const gx = x
    // 4 palitos verticales
    for (let i = 0; i < 4; i++) {
      marks.push(
        <line
          key={`g${g}v${i}`}
          x1={gx + i * W + 10}
          y1={6}
          x2={gx + i * W + 6}
          y2={H - 6}
          strokeWidth="3.5"
          strokeLinecap="round"
        />,
      )
    }
    // tachón diagonal
    marks.push(
      <line
        key={`g${g}d`}
        x1={gx}
        y1={H - 8}
        x2={gx + 4 * W + 18}
        y2={8}
        strokeWidth="3.5"
        strokeLinecap="round"
      />,
    )
    x += GW + 20
  }

  for (let i = 0; i < loose; i++) {
    marks.push(
      <line
        key={`l${i}`}
        x1={x + i * W + 10}
        y1={6}
        x2={x + i * W + 6}
        y2={H - 6}
        strokeWidth="3.5"
        strokeLinecap="round"
      />,
    )
  }

  const totalW = groups * (GW + 20) + (loose > 0 ? loose * W + PAD : 0) + PAD
  const svgW = Math.max(totalW, 60)

  if (count === 0) {
    return <span className={styles.palitoEmpty}>—</span>
  }

  return (
    <svg
      className={styles.palitoSvg}
      viewBox={`0 0 ${svgW} ${H}`}
      width={svgW}
      height={H}
      aria-label={`${count} palitos`}
    >
      {marks}
    </svg>
  )
}

/* ── Componente de segmento (malas / buenas) ─────────────────────────────── */

function Segmento({
  label,
  count,
  isCurrent,
}: {
  label: string
  count: number
  isCurrent: boolean
}) {
  return (
    <div className={`${styles.segmento} ${isCurrent ? styles.segmentoActive : ''}`}>
      <span className={styles.segmentoLabel}>{label}</span>
      <div className={styles.palitoRow}>
        <PalitosSvg count={count} />
      </div>
      <span className={styles.segmentoCount}>{count}</span>
    </div>
  )
}

/* ── Ornamento fileteado SVG ─────────────────────────────────────────────── */

function Ornamento({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 20" fill="none" aria-hidden="true">
      <path d="M0 10 Q25 2 50 10 Q75 18 100 10 Q125 2 150 10 Q175 18 200 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="100" cy="10" r="3" fill="currentColor" />
      <circle cx="50" cy="10" r="2" fill="currentColor" />
      <circle cx="150" cy="10" r="2" fill="currentColor" />
      <path d="M88 10 L95 4 L102 10 L95 16 Z" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */

export default function Truco() {
  const [names, setNames] = useState<Record<TeamKey, string>>(DEFAULT_NAMES)
  const [scores, setScores] = useState<Record<TeamKey, number>>({ nosotros: 0, ellos: 0 })

  const winner = useMemo<TeamKey | null>(() => {
    if (scores.nosotros >= MAX_SCORE) return 'nosotros'
    if (scores.ellos >= MAX_SCORE) return 'ellos'
    return null
  }, [scores])

  function add(team: TeamKey, pts: number) {
    if (winner) return
    setScores(prev => ({ ...prev, [team]: Math.min(MAX_SCORE, prev[team] + pts) }))
  }

  function sub(team: TeamKey) {
    if (winner) return
    setScores(prev => ({ ...prev, [team]: Math.max(0, prev[team] - 1) }))
  }

  function reset() {
    setScores({ nosotros: 0, ellos: 0 })
    setNames(DEFAULT_NAMES)
  }

  const malas = (k: TeamKey) => Math.min(scores[k], HALF_SCORE)
  const buenas = (k: TeamKey) => Math.max(0, scores[k] - HALF_SCORE)
  const enBuenas = (k: TeamKey) => scores[k] >= HALF_SCORE

  const TEAMS: TeamKey[] = ['nosotros', 'ellos']

  return (
    <div className={styles.root}>
      <main className="page">
        <Topbar label="Truco" sublabel="Buenas y malas" />

        {/* ── Cartel principal ── */}
        <header className={styles.cartel}>
          <Ornamento className={styles.ornTop} />
          <p className={styles.cartelEyebrow}>Anotador Criollo</p>
          <h1 className={styles.cartelTitle}>Truco</h1>
          <p className={styles.cartelSub}>
            Malas: 0 – 14 &nbsp;·&nbsp; Buenas: 15 – 29 &nbsp;·&nbsp; Gana el primero en llegar a 30
          </p>
          <Ornamento className={styles.ornBottom} />
        </header>

        {/* ── Tablero ── */}
        <section className={styles.tablero} aria-label="Marcador">
          {TEAMS.map(k => (
            <article key={k} className={`${styles.panel} ${winner === k ? styles.panelWinner : ''}`}>

              {/* nombre editable */}
              <div className={styles.nombreWrap}>
                <input
                  className={styles.nombreInput}
                  value={names[k]}
                  maxLength={20}
                  aria-label={`Nombre del equipo ${DEFAULT_NAMES[k]}`}
                  onChange={e => setNames(prev => ({ ...prev, [k]: e.target.value }))}
                />
                <span className={styles.nombreUnderline} aria-hidden="true" />
              </div>

              {/* puntaje total */}
              <div className={styles.puntajeWrap}>
                <span className={styles.puntaje}>{scores[k]}</span>
                <span className={styles.puntajeDe}>/30</span>
              </div>

              {/* segmentos */}
              <div className={styles.segmentos}>
                <Segmento label="Malas" count={malas(k)} isCurrent={!enBuenas(k)} />
                <div className={styles.segmentoDiv} aria-hidden="true" />
                <Segmento label="Buenas" count={buenas(k)} isCurrent={enBuenas(k)} />
              </div>

              {/* botones */}
              <div className={styles.botones} role="group" aria-label={`Puntos para ${names[k]}`}>
                <button className={styles.btnMenos} onClick={() => sub(k)} aria-label="Restar 1">
                  −1
                </button>
                {[1, 2, 3, 4].map(n => (
                  <button key={n} className={styles.btnMas} onClick={() => add(k, n)}>
                    +{n}
                  </button>
                ))}
              </div>

              {/* corona ganador */}
              {winner === k && (
                <div className={styles.coronaWrap} role="status">
                  <span className={styles.corona} aria-label="Ganador">♛</span>
                  <span className={styles.coronaText}>¡Ganó!</span>
                </div>
              )}
            </article>
          ))}
        </section>

        {/* ── Footer ── */}
        <footer className={styles.pie}>
          <Ornamento className={styles.ornPie} />
          <button className={styles.btnReset} onClick={reset}>
            Nueva partida
          </button>
        </footer>
      </main>
    </div>
  )
}
