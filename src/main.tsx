import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorFallback } from './components/AppErrorFallback'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from './i18n/I18nProvider'
import { applyTheme } from './theme/themes'
import { loadTheme } from './storage/theme'
import { applyFontScale } from './theme/fontScale'
import { loadFontScale } from './storage/display'

// Apply the saved theme and text size before the first render — no flash.
applyTheme(loadTheme())
applyFontScale(loadFontScale())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Top-level safety net: catches any render-phase error from the
        I18nProvider, ConfirmProvider, or App subtree and surfaces a
        recovery card with a reload button instead of leaving the user
        with a blank screen. Specific subtrees (the tabletop) install
        their own boundaries for finer-grained recovery. */}
    <ErrorBoundary
      fallback={({ error }) => <AppErrorFallback error={error} />}
    >
      <I18nProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>,
)
