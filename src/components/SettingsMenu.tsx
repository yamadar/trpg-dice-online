import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { LanguageToggle } from './LanguageToggle'

interface Props {
  name: string
  onChangeName: (name: string) => void
  onOpenHelp: () => void
}

/**
 * Low-frequency controls (player name, language, help) tucked behind a
 * header button so they do not take up permanent screen space.
 */
export function SettingsMenu({ name, onChangeName, onOpenHelp }: Props) {
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

            <button
              type="button"
              className="settings-help-btn"
              onClick={() => {
                setOpen(false)
                onOpenHelp()
              }}
            >
              {t('settings.help')}
            </button>

            <div className="settings-about">
              <h3>{t('settings.about')}</h3>
              <p className="about-title">{t('app.title')}</p>
              <p className="about-line">{t('app.tagline')}</p>
              <p className="about-line">
                MIT License ·{' '}
                <a
                  href="https://github.com/yamadar/trpg-dice-online"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
