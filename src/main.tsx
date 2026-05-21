import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConfirmProvider } from './components/ConfirmDialog'
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
    <I18nProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </I18nProvider>
  </StrictMode>,
)
