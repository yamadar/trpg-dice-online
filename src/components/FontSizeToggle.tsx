import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { FONT_SCALES, applyFontScale, type FontScale } from '../theme/fontScale'
import { loadFontScale, saveFontScale } from '../storage/display'

/**
 * Text-size picker: a small / medium / large segmented control. Changing
 * it rescales the whole UI by adjusting the root font-size.
 */
export function FontSizeToggle() {
  const { t } = useI18n()
  const [scale, setScale] = useState<FontScale>(loadFontScale)

  const choose = (next: FontScale) => {
    setScale(next)
    saveFontScale(next)
    applyFontScale(next)
  }

  return (
    <div className="seg-toggle" role="group" aria-label={t('fontSize.label')}>
      {FONT_SCALES.map((s) => (
        <button
          key={s}
          type="button"
          className={s === scale ? 'seg-btn active' : 'seg-btn'}
          aria-pressed={s === scale}
          onClick={() => choose(s)}
        >
          {t(`fontSize.${s}`)}
        </button>
      ))}
    </div>
  )
}
