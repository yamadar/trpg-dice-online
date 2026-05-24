import { LANGS, translate, type Lang } from '../i18n/translations'

const LANG_STORAGE_KEY = 'trpg-dice.lang'

/**
 * Read the saved UI language directly from localStorage so the
 * top-level error fallback can speak the user's language even when
 * the `I18nProvider` subtree is the one that crashed.
 */
function readSavedLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved && (LANGS as readonly string[]).includes(saved)) {
      return saved as Lang
    }
  } catch {
    /* localStorage unavailable */
  }
  return 'en'
}

/**
 * Top-level recovery card rendered by the app-wide ErrorBoundary in
 * `main.tsx`. Sits outside `I18nProvider` so it works even when the
 * provider tree is what threw — it reads the saved language directly
 * for localisation.
 *
 * The single recovery action is a hard reload: by definition this
 * fallback runs after every other layer failed, so a fresh process is
 * the most reliable way back to a working state. localStorage /
 * IndexedDB survive a reload, so the user keeps their characters,
 * patterns and feed history.
 */
export function AppErrorFallback({ error }: { error: Error }) {
  const lang = readSavedLang()
  return (
    <div
      className="error-fallback"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-error-title"
    >
      <div className="error-fallback-card">
        <h2 id="app-error-title" className="error-fallback-title">
          {translate(lang, 'app.error.title')}
        </h2>
        <p className="error-fallback-body">
          {translate(lang, 'app.error.body')}
        </p>
        <div className="error-fallback-actions">
          <button
            type="button"
            className="primary"
            autoFocus
            onClick={() => window.location.reload()}
          >
            {translate(lang, 'app.error.reload')}
          </button>
        </div>
        <details className="error-fallback-details">
          <summary>{translate(lang, 'app.error.details')}</summary>
          <pre>{error.stack ?? error.message}</pre>
        </details>
      </div>
    </div>
  )
}
