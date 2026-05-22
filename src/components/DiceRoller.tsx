import { useI18n } from '../i18n/useI18n'
import { DICE_TYPES, PATTERN_KINDS, type DiceType, type Pattern } from '../dice/types'
import { formatDicePreview } from '../dice/format'

export type Draft = Omit<Pattern, 'id'>

/** Allowed dice counts: 1–10. Picked with a stepper so the row keeps
 *  individual / type / modifier together in one compact line. */
const COUNT_MIN = 1
const COUNT_MAX = 10
const MODIFIER_MIN = -30
const MODIFIER_MAX = 30

interface Props {
  draft: Draft
  onChange: (draft: Draft) => void
  isGM: boolean
  onRoll: (hidden: boolean) => void
  onSave: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function DiceRoller({ draft, onChange, isGM, onRoll, onSave }: Props) {
  const { t } = useI18n()
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })

  // Composed roll headline shown in the preview card. The feed's own
  // detail row keeps the compact `NdM±k` form (familiar to TRPG
  // veterans); the pre-roll preview here uses the expanded
  // "count × type ± modifier" form so a first-time user can read
  // "what is multiplied by what". The kind is rendered in its accent
  // colour right next to it.
  const formula = formatDicePreview(draft.diceCount, draft.diceType, draft.modifier)

  return (
    <section className="panel dice-roller">
      {/* The panel title + icon lives in the parent `Sheet` header so the
          heading stays pinned above the scrollable body. */}

      {/* The roll title doubles as the saved-pattern name when the user
          presses "Save pattern" — it is the headline shown in the feed
          either way, so it sits at the very top like a normal title
          field rather than buried near the save button. */}
      <label className="field dice-name-field">
        <span className="visually-hidden">{t('dice.rollName')}</span>
        <input
          type="text"
          value={draft.name}
          maxLength={40}
          placeholder={t('dice.namePlaceholder')}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>

      {/* The actual dice expression — count, type, modifier — fits on
          one row. Steppers for the numeric pieces (count / modifier),
          a select for the die type so the seven options stay reachable
          without claiming a full chip row each. */}
      <div className="dice-formula-row" role="group" aria-label={t('dice.formula')}>
        <div className="dice-formula-field">
          <span className="dice-formula-label">{t('dice.count')}</span>
          <div className="stepper">
            <button
              type="button"
              aria-label={t('dice.countDec')}
              disabled={draft.diceCount <= COUNT_MIN}
              onClick={() => set({ diceCount: clamp(draft.diceCount - 1, COUNT_MIN, COUNT_MAX) })}
            >
              −
            </button>
            <span className="stepper-value">{draft.diceCount}</span>
            <button
              type="button"
              aria-label={t('dice.countInc')}
              disabled={draft.diceCount >= COUNT_MAX}
              onClick={() => set({ diceCount: clamp(draft.diceCount + 1, COUNT_MIN, COUNT_MAX) })}
            >
              +
            </button>
          </div>
        </div>

        <div className="dice-formula-field">
          <span className="dice-formula-label">{t('dice.type')}</span>
          <select
            className="dice-type-select"
            value={draft.diceType}
            onChange={(e) => set({ diceType: e.target.value as DiceType })}
            aria-label={t('dice.type')}
          >
            {DICE_TYPES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="dice-formula-field">
          <span className="dice-formula-label">{t('dice.modifier')}</span>
          <div className="stepper">
            <button
              type="button"
              aria-label={t('dice.modifierDec')}
              disabled={draft.modifier <= MODIFIER_MIN}
              onClick={() => set({ modifier: clamp(draft.modifier - 1, MODIFIER_MIN, MODIFIER_MAX) })}
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
              onClick={() => set({ modifier: clamp(draft.modifier + 1, MODIFIER_MIN, MODIFIER_MAX) })}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* "What kind of roll is this?" is conceptually separate from the
          dice expression, so it gets its own row rather than being
          tacked onto the formula. The pair stays as a chip group
          (only two options) for the bigger tap area. */}
      <div className="field">
        <span>{t('dice.kind')}</span>
        <div className="chip-row chip-grid-2" role="group" aria-label={t('dice.kind')}>
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

      {/* Preview card — same headline shape as the feed will render,
          tinted with the kind's accent colour (--damage / --judgment)
          so the type reads at a glance. */}
      <p className={`dice-summary dice-summary--${draft.kind}`}>
        <span className="dice-summary-kind">{t(`kind.${draft.kind}`)}</span>
        <span className="dice-summary-formula">{formula}</span>
      </p>

      {/* The hidden-roll flag lives on the pattern, but is only shown to
          (and editable by) the GM. */}
      {isGM && (
        <label className="checkbox" title={t('roll.hiddenHint')}>
          <input
            type="checkbox"
            checked={draft.hidden}
            onChange={(e) => set({ hidden: e.target.checked })}
          />
          <span>{t('roll.hidden')}</span>
        </label>
      )}

      <button
        type="button"
        className="primary big dice-roll-button"
        onClick={() => onRoll(isGM && draft.hidden)}
      >
        {t('roll.button')}
      </button>

      {/* The save action is secondary to rolling: a thin divider plus
          a quieter button reads as "and by the way, you can also
          keep this combo as a named pattern" without competing with
          the roll button visually. */}
      <div className="dice-save-row">
        <button type="button" className="dice-save-button" onClick={onSave}>
          {t('pattern.save')}
        </button>
      </div>
    </section>
  )
}
