import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { DICE_TYPES, PATTERN_KINDS, type Pattern } from '../dice/types'
import { formatDiceSummary } from '../dice/format'

export type Draft = Omit<Pattern, 'id'>

/** Allowed dice counts: 1–10, picked from buttons rather than typed. */
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
const MODIFIER_MIN = -30
const MODIFIER_MAX = 30

interface Props {
  draft: Draft
  onChange: (draft: Draft) => void
  isGM: boolean
  onRoll: (hidden: boolean) => void
  onSave: () => void
}

function clampModifier(value: number): number {
  return Math.max(MODIFIER_MIN, Math.min(MODIFIER_MAX, value))
}

export function DiceRoller({ draft, onChange, isGM, onRoll, onSave }: Props) {
  const { t } = useI18n()
  const [hidden, setHidden] = useState(false)
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })

  return (
    <section className="panel">
      <h2>{t('dice.section')}</h2>

      <div className="field">
        <span>{t('dice.count')}</span>
        <div className="chip-row" role="group" aria-label={t('dice.count')}>
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={n === draft.diceCount ? 'chip active' : 'chip'}
              aria-pressed={n === draft.diceCount}
              onClick={() => set({ diceCount: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>{t('dice.type')}</span>
        <div className="chip-row" role="group" aria-label={t('dice.type')}>
          {DICE_TYPES.map((d) => (
            <button
              key={d}
              type="button"
              className={d === draft.diceType ? 'chip active' : 'chip'}
              aria-pressed={d === draft.diceType}
              onClick={() => set({ diceType: d })}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="dice-grid">
        <div className="field">
          <span>{t('dice.modifier')}</span>
          <div className="stepper">
            <button
              type="button"
              aria-label={t('dice.modifierDec')}
              disabled={draft.modifier <= MODIFIER_MIN}
              onClick={() => set({ modifier: clampModifier(draft.modifier - 1) })}
            >
              −
            </button>
            <span className="stepper-value">
              {draft.modifier > 0 ? `+${draft.modifier}` : draft.modifier}
            </span>
            <button
              type="button"
              aria-label={t('dice.modifierInc')}
              disabled={draft.modifier >= MODIFIER_MAX}
              onClick={() => set({ modifier: clampModifier(draft.modifier + 1) })}
            >
              +
            </button>
          </div>
        </div>

        <div className="field">
          <span>{t('dice.kind')}</span>
          <div className="chip-row" role="group" aria-label={t('dice.kind')}>
            {PATTERN_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={k === draft.kind ? 'chip active' : 'chip'}
                aria-pressed={k === draft.kind}
                onClick={() => set({ kind: k })}
              >
                {t(`kind.${k}`)}
              </button>
            ))}
          </div>
        </div>
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
