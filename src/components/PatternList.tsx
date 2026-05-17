import { useI18n } from '../i18n/useI18n'
import type { Pattern } from '../dice/types'
import { formatDiceSummary } from '../dice/format'

interface Props {
  patterns: Pattern[]
  onLoad: (pattern: Pattern) => void
  onQuickRoll: (pattern: Pattern) => void
  onDelete: (id: string) => void
}

export function PatternList({ patterns, onLoad, onQuickRoll, onDelete }: Props) {
  const { t } = useI18n()

  // Deleting a saved pattern is permanent, so require a confirmation.
  const handleDelete = (pattern: Pattern) => {
    const name = pattern.name || t('pattern.unnamed')
    if (window.confirm(t('pattern.deleteConfirm', { name }))) onDelete(pattern.id)
  }

  return (
    <section className="panel">
      <h2>{t('pattern.section')}</h2>
      {patterns.length === 0 && <p className="hint">{t('pattern.none')}</p>}
      <ul className="pattern-list">
        {patterns.map((p) => (
          <li key={p.id}>
            <div className="pattern-info">
              <span className="pattern-name">{p.name || t('pattern.unnamed')}</span>
              <span className="pattern-meta">
                {formatDiceSummary(p.diceCount, p.diceType, p.modifier)} · {t(`kind.${p.kind}`)}
              </span>
            </div>
            <div className="pattern-buttons">
              <button type="button" className="primary" onClick={() => onQuickRoll(p)}>
                {t('pattern.roll')}
              </button>
              <button type="button" onClick={() => onLoad(p)}>
                {t('pattern.load')}
              </button>
              <button
                type="button"
                className="link danger"
                aria-label={t('pattern.delete')}
                onClick={() => handleDelete(p)}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
