import { useEffect, useMemo, useState } from 'react'

import type { EvolutionGenerationRecord } from '../../lib/chinchon-evo-lab'

import EvoGenerationGrid from './EvoGenerationGrid'

type Props = {
  history: EvolutionGenerationRecord[]
  primaryLabel: string
  secondaryLabel: string | null
  eyebrow?: string
  title?: string
  description?: string
}

export default function EvoGenerationArchive({
  history,
  primaryLabel,
  secondaryLabel,
  eyebrow = 'Archivo',
  title = 'Generaciones completadas',
  description = 'Podés revisar cada generación ya cerrada y ver todos sus individuos de mayor a menor.',
}: Props) {
  const sortedHistory = useMemo(
    () => [...history].sort((left, right) => right.generation - left.generation),
    [history],
  )
  const [selectedGeneration, setSelectedGeneration] = useState<number | null>(sortedHistory[0]?.generation ?? null)

  useEffect(() => {
    if (sortedHistory.length === 0) {
      setSelectedGeneration(null)
      return
    }

    const stillExists = sortedHistory.some(record => record.generation === selectedGeneration)
    if (!stillExists) {
      setSelectedGeneration(sortedHistory[0].generation)
    }
  }, [selectedGeneration, sortedHistory])

  if (sortedHistory.length === 0 || selectedGeneration == null) {
    return null
  }

  const selectedRecord = sortedHistory.find(record => record.generation === selectedGeneration) ?? sortedHistory[0]

  return (
    <section className="evo-section">
      <div className="evo-section__header">
        <div>
          <div className="evo-section__eyebrow">{eyebrow}</div>
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
      </div>

      <div className="evo-archive-toolbar">
        <label className="evo-field evo-archive-toolbar__field">
          <span>Generación</span>
          <select value={selectedGeneration} onChange={event => setSelectedGeneration(Number(event.target.value))}>
            {sortedHistory.map(record => (
              <option key={record.generation} value={record.generation}>
                Generación {record.generation}
              </option>
            ))}
          </select>
        </label>
        <div className="evo-archive-toolbar__meta">
          <span>{selectedRecord.individuals.length} individuos</span>
          <span>Ordenados por {primaryLabel.toLowerCase()}{secondaryLabel ? ` y luego ${secondaryLabel.toLowerCase()}` : ''}</span>
        </div>
      </div>

      <EvoGenerationGrid
        individuals={selectedRecord.individuals}
        primaryLabel={primaryLabel}
        secondaryLabel={secondaryLabel}
        eyebrow={`Generación ${selectedRecord.generation}`}
        title="Composición de la generación"
        description="Snapshot cerrado de esa generación, con métricas, linaje y comparación contra la semilla."
      />
    </section>
  )
}
