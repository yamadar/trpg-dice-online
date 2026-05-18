import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { THEME_IDS, applyTheme, type ThemeId } from '../theme/themes'
import { loadTheme, saveTheme } from '../storage/theme'

/**
 * Colour-theme picker: a grid of swatches. Each swatch carries its own
 * `data-theme`, so it previews that theme's colours via the CSS cascade.
 */
export function ThemeToggle() {
  const { t } = useI18n()
  const [theme, setTheme] = useState<ThemeId>(loadTheme)

  const choose = (id: ThemeId) => {
    setTheme(id)
    saveTheme(id)
    applyTheme(id)
  }

  return (
    <div className="theme-grid" role="group" aria-label={t('theme.title')}>
      {THEME_IDS.map((id) => (
        <button
          key={id}
          type="button"
          className={`theme-option${id === theme ? ' active' : ''}`}
          aria-pressed={id === theme}
          onClick={() => choose(id)}
        >
          <span className="theme-swatch" data-theme={id} aria-hidden="true">
            <span className="theme-swatch-bar" />
            <span className="theme-swatch-dot" />
          </span>
          <span className="theme-name">{t(`theme.${id}`)}</span>
        </button>
      ))}
    </div>
  )
}
