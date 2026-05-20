import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isRtl, LANGS, translate, type Lang } from './translations'
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
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  // Try the full BCP 47 tag first (e.g. "pt-BR", "zh-CN"), then the base
  // language (e.g. "es", "pt"); both fall back to English if unsupported.
  const all = LANGS as readonly string[]
  const lower = nav.toLowerCase()
  for (const lang of all) {
    if (lang.toLowerCase() === lower) return lang as Lang
  }
  const base = lower.split('-')[0]
  for (const lang of all) {
    if (lang.toLowerCase().split('-')[0] === base) return lang as Lang
  }
  return 'en'
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

  // Keep <html lang> and writing direction in sync, including the initial
  // detected language. RTL scripts (Arabic) flip the document direction.
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr'
  }, [lang])

  const t = useCallback<TFn>((key, params) => translate(lang, key, params), [lang])

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, autoTranslate, setAutoTranslate }),
    [lang, setLang, t, autoTranslate, setAutoTranslate],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
