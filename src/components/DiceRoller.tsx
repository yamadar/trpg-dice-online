import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { DICE_TYPES, PATTERN_KINDS, type Pattern } from '../dice/types'
import { formatDiceSummary } from '../dice/format'

export type Draft = Omit<Pattern, 'id'>

interface Props {
  draft: Draft
  onChange: (draft: Draft) => void
  isGM: boolean
  onRoll: (hidden: boolean) => void
  onSave: () => void
}

export function DiceRoller({ draft, onChange, isGM, onRoll, onSave }: Props) {
  const { t } = useI18n()
  const [hidden, setHidden] = useState(false)
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })

  return (
    <section className="panel">
      <h2>{t('dice.section')}</h2>

      <div className="dice-grid">
        <label className="field">
          <span>{t('dice.count')}</span>
          <input
            type="number"
            min={1}
            max={50}
            value={draft.diceCount}
            onChange={(e) =>
              set({ diceCount: Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))) })
            }
          />
        </label>

        <label className="field">
          <span>{t('dice.type')}</span>
          <select value={draft.diceType} onChange={(e) => set({ diceType: e.target.value as Draft['diceType'] })}>
            {DICE_TYPES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t('dice.modifier')}</span>
          <input
            type="number"
            min={-999}
            max={999}
            value={draft.modifier}
            onChange={(e) => set({ modifier: Math.floor(Number(e.target.value) || 0) })}
          />
        </label>

        <label className="field">
          <span>{t('dice.kind')}</span>
          <select value={draft.kind} onChange={(e) => set({ kind: e.target.value as Draft['kind'] })}>
            {PATTERN_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="dice-summary">{formatDiceSummary(draft.diceCount, draft.diceType, draft.modifier)}</p>

      <label className="field">
        <span>{t('pattern.name')}</span>
        <input
          type="text"
          value={draft.name}
          maxLength={40}
          placeholder={t('pattern.namePlaceholder')}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>

      {isGM && (
        <label className="checkbox" title={t('roll.hiddenHint')}>
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          <span>{t('roll.hidden')}</span>
        </label>
      )}

      <div className="dice-actions">
        <button type="button" className="primary big" onClick={() => onRoll(isGM && hidden)}>
          {t('roll.button')}
        </button>
        <button type="button" onClick={onSave}>
          {t('pattern.save')}
        </button>
      </div>
    </section>
  )
}
