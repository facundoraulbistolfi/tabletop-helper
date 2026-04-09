import { useEffect, useState } from 'react'

import { CUSTOM_EMOJIS } from '../../lib/chinchon-bot-presets'

export type EvoSaveOutcome =
  | { status: 'saved'; savedBotId: string }
  | { status: 'duplicate' }
  | { status: 'full' }
  | { status: 'error'; message: string }

type SaveDraft = {
  name: string
  emoji: string
  description: string
  replaceExisting: boolean
}

type Props = {
  open: boolean
  initialName: string
  initialEmoji: string
  initialDescription: string
  onClose: () => void
  onSave: (draft: SaveDraft) => EvoSaveOutcome
}

export default function EvoSaveModal({
  open,
  initialName,
  initialEmoji,
  initialDescription,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName)
  const [emoji, setEmoji] = useState(initialEmoji)
  const [description, setDescription] = useState(initialDescription)
  const [error, setError] = useState<string | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setEmoji(initialEmoji)
    setDescription(initialDescription)
    setError(null)
    setReplaceExisting(false)
  }, [initialDescription, initialEmoji, initialName, open])

  if (!open) return null

  function handleSave() {
    const outcome = onSave({
      name,
      emoji,
      description,
      replaceExisting,
    })

    if (outcome.status === 'saved') {
      onClose()
      return
    }

    if (outcome.status === 'duplicate') {
      setReplaceExisting(true)
      setError('Ya existe un bot custom con ese nombre. Volvé a guardar para reemplazarlo.')
      return
    }

    if (outcome.status === 'full') {
      setError('Ya llegaste al máximo de bots custom. Reemplazá uno existente para guardar este resultado.')
      return
    }

    setError(outcome.message)
  }

  return (
    <div className="lab-modal" role="dialog" aria-modal="true" aria-labelledby="evo-save-title" onClick={onClose}>
      <div className="lab-modal__surface evo-save-modal" onClick={event => event.stopPropagation()}>
        <div className="lab-modal__header">
          <div>
            <div className="lab-modal__eyebrow">Guardar resultado</div>
            <h3 id="evo-save-title">Guardar bot evolucionado</h3>
          </div>
          <button type="button" className="lab-modal__close" onClick={onClose} aria-label="Cerrar modal">
            ×
          </button>
        </div>

        <label className="evo-field">
          <span>Nombre</span>
          <input
            type="text"
            maxLength={12}
            value={name}
            onChange={event => {
              setName(event.target.value)
              setError(null)
              setReplaceExisting(false)
            }}
          />
        </label>

        <div className="evo-field">
          <span>Emoji</span>
          <div className="evo-emoji-grid">
            {CUSTOM_EMOJIS.map(option => (
              <button
                key={option}
                type="button"
                className={`evo-emoji-chip${emoji === option ? ' is-active' : ''}`}
                onClick={() => {
                  setEmoji(option)
                  setError(null)
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <label className="evo-field">
          <span>Descripción</span>
          <textarea
            rows={3}
            maxLength={120}
            value={description}
            onChange={event => {
              setDescription(event.target.value)
              setError(null)
            }}
          />
        </label>

        {error ? <div className="evo-save-modal__error">{error}</div> : null}

        <div className="lab-modal__actions">
          <button type="button" className="lab-secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="evo-primary-button" onClick={handleSave}>
            {replaceExisting ? 'Reemplazar bot' : 'Guardar bot'}
          </button>
        </div>
      </div>
    </div>
  )
}
