import { useI18n } from '../i18n/useI18n'
import type { Pattern } from '../dice/types'
import { formatDiceSummary } from '../dice/format'
import { CloseIcon } from './icons'

interface Props {
  /** Whether a character is active (patterns belong to a character). */
  hasCharacter: boolean
  /** Active character's name, for the empty-state message. */
  characterName: string
  patterns: Pattern[]
  /** Whether the local player is the GM — the hidden-roll mark is GM-only. */
  isGM: boolean
  onLoad: (pattern: Pattern) => void
  onQuickRoll: (pattern: Pattern) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
}

export function PatternList({
  hasCharacter,
  characterName,
  patterns,
  isGM,
  onLoad,
  onQuickRoll,
  onDelete,
  onMove,
}: Props) {
  const { t } = useI18n()

  // Deleting a saved pattern is permanent, so require a confirmation.
  const handleDelete = (pattern: Pattern) => {
    const name = pattern.name || t('pattern.unnamed')
    if (window.confirm(t('pattern.deleteConfirm', { name }))) onDelete(pattern.id)
  }

  return (
    <section className="panel">
      <h2>
        <span className="panel-icon" aria-hidden="true">
          ⭐
        </span>
        {t('pattern.section')}
      </h2>
      {!hasCharacter && <p className="hint">{t('pattern.needCharacter')}</p>}
      {hasCharacter && patterns.length === 0 && (
        <p className="hint">
          {t('pattern.none', { name: characterName.trim() || t('character.unnamed') })}
        </p>
      )}
      {hasCharacter && (
        <ul className="pattern-list">
          {patterns.map((p, i) => (
            <li key={p.id}>
              <div className="pattern-info">
                <span className="pattern-name">
                  {p.name || t('pattern.unnamed')}
                  {/* The hidden-roll mark is shown only to the GM. */}
                  {isGM && p.hidden && (
                    <span className="pattern-hidden" title={t('roll.hidden')}>
                      🔒
                    </span>
                  )}
                </span>
                <span className="pattern-meta">
                  {formatDiceSummary(p.diceCount, p.diceType, p.modifier)} · {t(`kind.${p.kind}`)}
                </span>
              </div>
              <div className="pattern-buttons">
                <div className="pattern-reorder">
                  <button
                    type="button"
                    className="move-btn"
                    aria-label={t('pattern.moveUp')}
                    disabled={i === 0}
                    onClick={() => onMove(p.id, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="move-btn"
                    aria-label={t('pattern.moveDown')}
                    disabled={i === patterns.length - 1}
                    onClick={() => onMove(p.id, 1)}
                  >
                    ▼
                  </button>
                </div>
                <button type="button" className="primary" onClick={() => onQuickRoll(p)}>
                  {t('pattern.roll')}
                </button>
                <button type="button" onClick={() => onLoad(p)}>
                  {t('pattern.load')}
                </button>
                <button
                  type="button"
                  className="link danger icon-x"
                  aria-label={t('pattern.delete')}
                  onClick={() => handleDelete(p)}
                >
                  <CloseIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
