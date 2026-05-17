import { useI18n } from '../i18n/useI18n'
import type { Pattern } from '../dice/types'
import { formatDiceSummary } from '../dice/format'

interface Props {
  patterns: Pattern[]
  onLoad: (pattern: Pattern) => void
  onDelete: (id: string) => void
}

export function PatternList({ patterns, onLoad, onDelete }: Props) {
  const { t } = useI18n()
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
              <button type="button" onClick={() => onLoad(p)}>
                {t('pattern.load')}
              </button>
              <button type="button" className="link danger" onClick={() => onDelete(p.id)}>
                {t('pattern.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
