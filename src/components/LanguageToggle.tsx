import { useI18n } from '../i18n/useI18n'
import { LANG_NAMES, LANGS, type Lang } from '../i18n/translations'

/**
 * A `<select>` dropdown — the only sensible UI once the language list
 * grew past a couple of options. Native dropdowns scale to many items,
 * stay keyboard-accessible and free us from owning a custom popup. Each
 * option is labelled in its own native script so a player can find their
 * language even when the UI is currently in one they cannot read.
 */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <select
      className="lang-select"
      aria-label={t('lang.label')}
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
    >
      {LANGS.map((l) => (
        <option key={l} value={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </select>
  )
}
