import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useFieldNotice } from '../hooks/useFieldNotice'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'
import { FontSizeToggle } from './FontSizeToggle'
import { BrandIcon, CloseIcon, SettingsIcon } from './icons'

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
  const { t, autoTranslate, setAutoTranslate } = useI18n()
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
        <SettingsIcon size={20} />
      </button>

      {open && (
        <>
          <div className="settings-backdrop" onClick={() => setOpen(false)} />
          <div className="settings-panel" role="dialog" aria-label={t('settings.title')}>
            {/* Pinned outside the scroll region so it stays put — same
                placement as the other modals' close button. */}
            <button
              type="button"
              className="sheet-close icon-btn"
              aria-label={t('settings.close')}
              onClick={() => setOpen(false)}
            >
              <CloseIcon />
            </button>
            <div className="settings-body">
              <h2 className="settings-title">{t('settings.title')}</h2>
              <label className="setting-row">
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

              <div className="settings-group">
                <h3>{t('settings.groupLanguage')}</h3>
                <div className="setting-row">
                  <span>{t('lang.label')}</span>
                  <LanguageToggle />
                </div>
                <label className="setting-row">
                  <span>{t('translate.auto')}</span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={autoTranslate}
                    onChange={(e) => setAutoTranslate(e.target.checked)}
                  />
                </label>
              </div>

              <div className="settings-group">
                <h3>{t('settings.groupAppearance')}</h3>
                <div className="setting-row">
                  <span>{t('fontSize.label')}</span>
                  <FontSizeToggle />
                </div>
                <label className="setting-row">
                  <span>{t('feed.compact')}</span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={compact}
                    onChange={onToggleCompact}
                  />
                </label>
                <div className="field">
                  <span>{t('theme.title')}</span>
                  <ThemeToggle />
                </div>
              </div>

              <div className="settings-about">
                <h3>{t('settings.about')}</h3>
                <p className="about-title brand-heading">
                  <BrandIcon className="brand-mark" />
                  <span>{t('app.title')}</span>
                </p>
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
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
