import { useI18n } from '../i18n/useI18n'
import type { RollResult } from '../dice/types'
import { formatDiceSummary, formatRollText } from '../dice/format'

interface Props {
  history: RollResult[]
  isGM: boolean
  onClear: () => void
}

export function HistoryPanel({ history, isGM, onClear }: Props) {
  const { t, lang } = useI18n()

  return (
    <section className="panel history">
      <div className="panel-head">
        <h2>{t('history.section')}</h2>
        {history.length > 0 && (
          <button type="button" className="link" onClick={onClear}>
            {t('history.clear')}
          </button>
        )}
      </div>

      {history.length === 0 && <p className="hint">{t('history.empty')}</p>}

      <ul className="roll-list">
        {history.map((r) => {
          const canSee = isGM || !r.hidden
          const isHidden = r.hidden && !canSee
          return (
            <li key={r.id} className={isHidden ? 'roll hidden' : `roll ${r.kind}`}>
              <div className="roll-head">
                <span className="roll-player">{r.playerName || t('player.anon')}</span>
                <time>{new Date(r.timestamp).toLocaleTimeString(lang)}</time>
              </div>
              <p className="roll-text">{formatRollText(t, r, canSee)}</p>
              {!isHidden && (
                <p className="roll-detail">
                  {formatDiceSummary(r.diceCount, r.diceType, r.modifier)}
                  {' · '}
                  {t('result.faces')}: [{r.faces.join(', ')}]
                  {r.hidden && isGM && ' 🔒'}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
