import { useEffect, useState } from 'react'
import { useI18n } from './useI18n'
import { translateText } from './translator'
import type { Lang } from './translations'

export interface TranslatedText {
  /** The translation into the current UI language, or null if unavailable. */
  translated: string | null
  /** True while a translation is in progress. */
  translating: boolean
}

/**
 * Auto-translate `text` (written in `sourceLang`) into the current UI
 * language while auto-translation is on. Best-effort: on failure, when
 * off, or for same-language text, `translated` stays null and the caller
 * shows the original. Re-translates when the target language or the
 * chosen backend changes.
 */
export function useTranslatedText(text: string, sourceLang: Lang): TranslatedText {
  const { lang, autoTranslate, translationBackend } = useI18n()
  const active = autoTranslate && text.trim() !== '' && sourceLang !== lang
  const [translated, setTranslated] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // Reset (and so re-translate) when the target language or backend changes.
  const runKey = `${lang}:${translationBackend}`
  const [prevRunKey, setPrevRunKey] = useState(runKey)
  if (prevRunKey !== runKey) {
    setPrevRunKey(runKey)
    setTranslated(null)
    setFailed(false)
  }

  useEffect(() => {
    if (!active || translated !== null || failed) return
    let cancelled = false
    translateText(text, sourceLang, lang, translationBackend)
      .then((out) => {
        if (!cancelled) setTranslated(out)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [active, translated, failed, text, sourceLang, lang, translationBackend])

  return { translated, translating: active && translated === null && !failed }
}
