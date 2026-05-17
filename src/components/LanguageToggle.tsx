import { useI18n } from '../i18n/useI18n'
import { LANGS } from '../i18n/translations'

const LABELS: Record<string, string> = { ja: '日本語', en: 'English' }

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="lang-toggle" role="group" aria-label={t('lang.label')}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={l === lang ? 'lang-btn active' : 'lang-btn'}
          aria-pressed={l === lang}
          onClick={() => setLang(l)}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  )
}
