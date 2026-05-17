import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { LanguageToggle } from './LanguageToggle'

interface Props {
  name: string
  onChangeName: (name: string) => void
}

/**
 * Low-frequency controls (player name, language) tucked behind a header
 * button so they do not take up permanent screen space.
 */
export function SettingsMenu({ name, onChangeName }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="settings">
      <button
        type="button"
        className="icon-btn"
        aria-label={t('settings.open')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⚙
      </button>

      {open && (
        <>
          <div className="settings-backdrop" onClick={() => setOpen(false)} />
          <div className="settings-panel" role="dialog" aria-label={t('settings.title')}>
            <div className="settings-head">
              <h2>{t('settings.title')}</h2>
              <button type="button" className="link" onClick={() => setOpen(false)}>
                {t('settings.close')}
              </button>
            </div>
            <label className="field">
              <span>{t('player.name')}</span>
              <input
                type="text"
                value={name}
                maxLength={24}
                placeholder={t('player.namePlaceholder')}
                onChange={(e) => onChangeName(e.target.value)}
              />
            </label>
            <div className="field">
              <span>{t('lang.label')}</span>
              <LanguageToggle />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
