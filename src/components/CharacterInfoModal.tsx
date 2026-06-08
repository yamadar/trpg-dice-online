import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useDialogFocus } from '../hooks/useDialogFocus'
import type { Character, CharacterEdits } from '../characters/types'
import { CharacterEditor } from './CharacterEditor'
import { CloseIcon } from './icons'

interface Props {
  character: Character
  onUpdate: (patch: Partial<CharacterEdits>) => void
  onNotice: (message: string) => void
  onClose: () => void
}

/**
 * Modal wrapper around `CharacterEditor`, opened from a placed PC token's
 * edit popover. It edits the token's bound character directly — NOT the
 * active one — so the GM can adjust any player-character token without
 * first switching their operating character. The management-only zones
 * (switcher, add, export, delete) that `CharacterPanel` shows are
 * intentionally absent here; only the card + edit fields appear.
 */
export function CharacterInfoModal({ character, onUpdate, onNotice, onClose }: Props) {
  const { t } = useI18n()
  const cardRef = useRef<HTMLDivElement>(null)

  // Move focus into the modal on open, trap Tab while open, and restore
  // focus to the token's edit popover on close.
  useDialogFocus(cardRef)

  // Escape closes. Capture phase + stopImmediatePropagation so the
  // keystroke does not also reach the tabletop's own Escape handler
  // sitting underneath (which would close the whole tabletop view).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="char-info-layer" role="presentation">
      <div className="char-info-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="char-info-card"
        role="dialog"
        aria-modal="true"
        aria-label={t('tabletop.tokenEdit.editCharacter')}
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="char-info-header">
          <h2>{t('tabletop.tokenEdit.editCharacter')}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tabletop.tokenEdit.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="char-info-body">
          <CharacterEditor
            character={character}
            onUpdate={onUpdate}
            onNotice={onNotice}
          />
        </div>
      </div>
    </div>
  )
}
