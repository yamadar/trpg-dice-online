import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useFieldNotice } from '../hooks/useFieldNotice'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'
import { FontSizeToggle } from './FontSizeToggle'
import {
  BrandIcon,
  ChatIcon,
  CloseIcon,
  CompactIcon,
  FontSizeIcon,
  HelpIcon,
  InfoIcon,
  PlayerIcon,
  SettingsIcon,
  ThemeIcon,
  TranslateIcon,
} from './icons'

interface Props {
  name: string
  onChangeName: (name: string) => void
  /** Feed-density preference — a display setting, so its toggle lives here. */
  compact: boolean
  onToggleCompact: () => void
  /** "Show others' typing…" — HSP-friendly opt-out, see-side. */
  showTyping: boolean
  onToggleShowTyping: () => void
  /** "Broadcast my own typing" — HSP-friendly opt-out, send-side. */
  broadcastTyping: boolean
  onToggleBroadcastTyping: () => void
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
  showTyping,
  onToggleShowTyping,
  broadcastTyping,
  onToggleBroadcastTyping,
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
            {/* Pinned header — title (with the same cog icon as the
                trigger button, so the affordance and the open panel
                feel like one continuous surface) on the left, close
                button on the right. Stays put while the body scrolls,
                same pattern as the other panels' Sheet header. */}
            <div className="settings-header">
              <h2 className="settings-title">
                <SettingsIcon size={22} />
                <span>{t('settings.title')}</span>
              </h2>
              <button
                type="button"
                className="sheet-close icon-btn"
                aria-label={t('settings.close')}
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="settings-body">
              <label className="setting-row">
                <span className="setting-label">
                  <PlayerIcon />
                  <span>{t('player.name')}</span>
                </span>
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
                <h3 className="settings-group-title">
                  <TranslateIcon size={16} />
                  <span>{t('settings.groupLanguage')}</span>
                </h3>
                <div className="setting-row">
                  <span className="setting-label">
                    <TranslateIcon size={16} />
                    <span>{t('lang.label')}</span>
                  </span>
                  <LanguageToggle />
                </div>
                <label className="setting-row">
                  <span className="setting-label">
                    <TranslateIcon size={16} />
                    <span>{t('translate.auto')}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={autoTranslate}
                    onChange={(e) => setAutoTranslate(e.target.checked)}
                  />
                </label>
              </div>

              <div className="settings-group">
                <h3 className="settings-group-title">
                  <ThemeIcon size={16} />
                  <span>{t('settings.groupAppearance')}</span>
                </h3>
                <div className="setting-row">
                  <span className="setting-label">
                    <FontSizeIcon />
                    <span>{t('fontSize.label')}</span>
                  </span>
                  <FontSizeToggle />
                </div>
                <label className="setting-row">
                  <span className="setting-label">
                    <CompactIcon />
                    <span>{t('feed.compact')}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={compact}
                    onChange={onToggleCompact}
                  />
                </label>
                <div className="field setting-row">
                  <span className="setting-label">
                    <ThemeIcon />
                    <span>{t('theme.title')}</span>
                  </span>
                  <ThemeToggle />
                </div>
              </div>

              {/* Split toggles for the "typing…" indicator. The two
                  sides — see / be seen — are independent so an
                  HSP-sensitive user can opt out of either without
                  giving up the other. */}
              <div className="settings-group">
                <h3 className="settings-group-title">
                  <ChatIcon size={16} />
                  <span>{t('settings.groupTyping')}</span>
                </h3>
                <label className="setting-row">
                  <span className="setting-label">
                    <ChatIcon size={16} />
                    <span>{t('settings.showTyping')}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={showTyping}
                    onChange={onToggleShowTyping}
                  />
                </label>
                <label className="setting-row">
                  <span className="setting-label">
                    <ChatIcon size={16} />
                    <span>{t('settings.broadcastTyping')}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={broadcastTyping}
                    onChange={onToggleBroadcastTyping}
                  />
                </label>
              </div>

              <div className="settings-about">
                <h3 className="settings-group-title">
                  <InfoIcon size={16} />
                  <span>{t('settings.about')}</span>
                </h3>
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
                  <HelpIcon />
                  <span>{t('settings.help')}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
