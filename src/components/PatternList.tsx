import { useI18n } from '../i18n/useI18n'
import type { Pattern } from '../dice/types'
import { formatDiceSummary } from '../dice/format'
import { useConfirm } from '../hooks/useConfirm'
import { CloseIcon, DiceIcon, EditIcon } from './icons'

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
  /** Optional heading shown above the list — used when the list is
   *  embedded under another panel (e.g. the dice sheet) so the section
   *  is announced without a separate Sheet header. */
  heading?: string
}

/**
 * Saved-pattern picker. Renders each pattern as a single dense row so
 * a character with many patterns fits in less screen real estate —
 * the previous two-line layout had each pattern eat ~80 px of height,
 * which left no room for the dice roller above when the two panels
 * were merged. Action buttons (roll / load / delete) are icon-only
 * with `aria-label` so the row footprint stays minimal.
 */
export function PatternList({
  hasCharacter,
  characterName,
  patterns,
  isGM,
  onLoad,
  onQuickRoll,
  onDelete,
  onMove,
  heading,
}: Props) {
  const { t } = useI18n()
  const confirm = useConfirm()

  // Deleting a saved pattern is permanent, so require a confirmation.
  const handleDelete = async (pattern: Pattern) => {
    const name = pattern.name || t('pattern.unnamed')
    const ok = await confirm({
      message: t('pattern.deleteConfirm', { name }),
      destructive: true,
    })
    if (ok) onDelete(pattern.id)
  }

  return (
    <section className="panel pattern-panel">
      {heading && <h3 className="pattern-panel-heading">{heading}</h3>}
      {/* The panel title + icon lives in the parent `Sheet` header (or
          the supplied `heading`) so the heading stays pinned above
          the scrollable body. */}
      {!hasCharacter && <p className="hint">{t('pattern.needCharacter')}</p>}
      {hasCharacter && patterns.length === 0 && (
        <p className="hint">
          {t('pattern.none', { name: characterName.trim() || t('character.unnamed') })}
        </p>
      )}
      {hasCharacter && patterns.length > 0 && (
        <ul className="pattern-list pattern-list-compact">
          {patterns.map((p, i) => (
            <li key={p.id}>
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
              <div className="pattern-info">
                <span className="pattern-name" title={p.name || t('pattern.unnamed')}>
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
              <div className="pattern-actions">
                <button
                  type="button"
                  className="icon-btn pattern-action pattern-action-roll"
                  aria-label={t('pattern.roll')}
                  title={t('pattern.roll')}
                  onClick={() => onQuickRoll(p)}
                >
                  <DiceIcon size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn pattern-action"
                  aria-label={t('pattern.load')}
                  title={t('pattern.load')}
                  onClick={() => onLoad(p)}
                >
                  <EditIcon size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn pattern-action pattern-action-delete"
                  aria-label={t('pattern.delete')}
                  title={t('pattern.delete')}
                  onClick={() => handleDelete(p)}
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
