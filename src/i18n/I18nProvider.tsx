import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANGS, translate, type Lang } from './translations'
import { I18nContext, type I18nValue, type TFn } from './context'
import { loadAutoTranslate, saveAutoTranslate } from '../storage/translation'

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
  const [autoTranslate, setAutoState] = useState(loadAutoTranslate)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const setAutoTranslate = useCallback((on: boolean) => {
    setAutoState(on)
    saveAutoTranslate(on)
  }, [])

  // Keep <html lang> in sync, including the initial detected language.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback<TFn>((key, params) => translate(lang, key, params), [lang])

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, autoTranslate, setAutoTranslate }),
    [lang, setLang, t, autoTranslate, setAutoTranslate],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
