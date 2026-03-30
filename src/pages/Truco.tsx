import { useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import styles from './Truco.module.css'

const MAX_SCORE = 30
const HALF_SCORE = 15

type TeamKey = 'nosotros' | 'ellos'
type Segment = 'malas' | 'buenas'

interface TeamConfig {
  key: TeamKey
  defaultName: string
  emblem: string
}

const TEAM_CONFIG: TeamConfig[] = [
  { key: 'nosotros', defaultName: 'Nosotros', emblem: '🧉' },
  { key: 'ellos', defaultName: 'Ellos', emblem: '🗣️' },
]

function segmentForScore(score: number): Segment {
  return score >= HALF_SCORE ? 'buenas' : 'malas'
}

function buildPalitos(count: number): string {
  const groups = Math.floor(count / 5)
  const loose = count % 5
  const groupText = Array.from({ length: groups }, () => '||||╱').join(' ')
  const looseText = '|'.repeat(loose)
  return [groupText, looseText].filter(Boolean).join(' ').trim() || '—'
}

export default function Truco() {
  const [teamNames, setTeamNames] = useState<Record<TeamKey, string>>({
    nosotros: 'Nosotros',
    ellos: 'Ellos',
  })
  const [scores, setScores] = useState<Record<TeamKey, number>>({
    nosotros: 0,
    ellos: 0,
  })

  const winner = useMemo(
    () => TEAM_CONFIG.find(team => scores[team.key] >= MAX_SCORE),
    [scores],
  )

  function addPoints(team: TeamKey, amount: number) {
    if (winner) return
    setScores(prev => ({
      ...prev,
      [team]: Math.min(MAX_SCORE, prev[team] + amount),
    }))
  }

  function subtractPoint(team: TeamKey) {
    if (winner) return
    setScores(prev => ({
      ...prev,
      [team]: Math.max(0, prev[team] - 1),
    }))
  }

  function resetMatch() {
    setScores({ nosotros: 0, ellos: 0 })
    setTeamNames({ nosotros: 'Nosotros', ellos: 'Ellos' })
  }

  return (
    <div className={styles.root}>
      <main className="page">
        <Topbar label="Anotador de Truco" sublabel="cantá y sumá" />

        <section className={styles.hero}>
          <p className={styles.overline}>Anotador criollo</p>
          <h1>Truco con buenas y malas</h1>
          <p>
            Sumá en palitos, cantá en voz alta y controlá la partida con estilo porteño.
            De 0 a 14 son <strong>malas</strong>; desde 15 pasan a <strong>buenas</strong>.
          </p>
          {winner && (
            <div className={styles.winnerBanner}>
              ¡Ganó {teamNames[winner.key].trim() || winner.defaultName} con {scores[winner.key]} puntos!
            </div>
          )}
        </section>

        <section className={styles.board}>
          {TEAM_CONFIG.map(team => {
            const score = scores[team.key]
            const segment = segmentForScore(score)
            const malas = Math.min(score, HALF_SCORE)
            const buenas = Math.max(0, score - HALF_SCORE)

            return (
              <article key={team.key} className={styles.teamCard}>
                <label className={styles.teamNameLabel}>
                  Equipo
                  <input
                    className={styles.teamNameInput}
                    value={teamNames[team.key]}
                    onChange={e => setTeamNames(prev => ({ ...prev, [team.key]: e.target.value }))}
                    aria-label={`Nombre de ${team.defaultName}`}
                  />
                </label>

                <div className={styles.scoreLine}>
                  <span className={styles.emblem} aria-hidden="true">{team.emblem}</span>
                  <div>
                    <p className={styles.scoreValue}>{score}</p>
                    <p className={styles.segmentTag}>En {segment}</p>
                  </div>
                </div>

                <div className={styles.palitosBlock}>
                  <div>
                    <p className={styles.palitosTitle}>Malas ({malas})</p>
                    <p className={styles.palitosText}>{buildPalitos(malas)}</p>
                  </div>
                  <div>
                    <p className={styles.palitosTitle}>Buenas ({buenas})</p>
                    <p className={styles.palitosText}>{buildPalitos(buenas)}</p>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button className={styles.btnGhost} onClick={() => subtractPoint(team.key)}>-1</button>
                  <button className={styles.btn} onClick={() => addPoints(team.key, 1)}>1</button>
                  <button className={styles.btn} onClick={() => addPoints(team.key, 2)}>2</button>
                  <button className={styles.btn} onClick={() => addPoints(team.key, 3)}>3</button>
                  <button className={styles.btn} onClick={() => addPoints(team.key, 4)}>4</button>
                </div>
              </article>
            )
          })}
        </section>

        <section className={styles.footerPanel}>
          <p>Primero en llegar a 30 gana la partida.</p>
          <button className={styles.resetBtn} onClick={resetMatch}>Reiniciar marcador</button>
        </section>
      </main>
    </div>
  )
}
