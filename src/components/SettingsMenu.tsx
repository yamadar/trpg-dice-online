import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useFieldNotice } from '../hooks/useFieldNotice'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'

interface Props {
  name: string
  onChangeName: (name: string) => void
  /** Feed-density preference — a display setting, so its toggle lives here. */
  compact: boolean
  onToggleCompact: () => void
  onOpenHelp: () => void
  /** Surfaces a toast, e.g. after the player name has been changed. */
  onNotice: (message: string) => void
}

/**
 * Low-frequency controls (player name, language, display preferences,
 * help) tucked behind a header button so they do not take up permanent
 * screen space.
 */
export function SettingsMenu({
  name,
  onChangeName,
  compact,
  onToggleCompact,
  onOpenHelp,
  onNotice,
}: Props) {
  const { t, autoTranslate, setAutoTranslate, translationBackend, setTranslationBackend } = useI18n()
  const [open, setOpen] = useState(false)
  // Toast once the player-name edit settles (on blur or when the menu closes).
  const { markChanged, flush } = useFieldNotice(() => onNotice(t('toast.playerName')))

  // Closing the menu counts as finishing the edit.
  useEffect(() => {
    if (!open) flush()
  }, [open, flush])

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
                onChange={(e) => {
                  onChangeName(e.target.value)
                  markChanged()
                }}
                onBlur={flush}
              />
            </label>
            <div className="field">
              <span>{t('lang.label')}</span>
              <LanguageToggle />
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={autoTranslate}
                onChange={(e) => setAutoTranslate(e.target.checked)}
              />
              <span>{t('translate.auto')}</span>
            </label>
            {autoTranslate && (
              <div className="field">
                <span>{t('translate.backend')}</span>
                <div className="lang-toggle" role="group" aria-label={t('translate.backend')}>
                  {(['chrome', 'mymemory'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      className={b === translationBackend ? 'lang-btn active' : 'lang-btn'}
                      aria-pressed={b === translationBackend}
                      onClick={() => setTranslationBackend(b)}
                    >
                      {t(`translate.${b}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="checkbox">
              <input type="checkbox" checked={compact} onChange={onToggleCompact} />
              <span>{t('feed.compact')}</span>
            </label>
            <div className="field">
              <span>{t('theme.title')}</span>
              <ThemeToggle />
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
