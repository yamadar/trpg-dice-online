import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { LANGS, translate, type Lang } from './translations'
import { I18nContext, type I18nValue, type TFn } from './context'

const STORAGE_KEY = 'trpg-dice.lang'

function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang
  } catch {
    /* localStorage may be unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'ja'
  return nav.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = next
  }, [])

  const t = useCallback<TFn>((key, params) => translate(lang, key, params), [lang])

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
