import { createContext } from 'react'
import type { Lang } from './translations'
import type { TranslationBackend } from './translator'

export type TFn = (key: string, params?: Record<string, string | number>) => string

export interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TFn
  /** Whether chat is auto-translated into the current UI language. */
  autoTranslate: boolean
  setAutoTranslate: (on: boolean) => void
  /** The chosen free-text translation backend. */
  translationBackend: TranslationBackend
  setTranslationBackend: (backend: TranslationBackend) => void
}

export const I18nContext = createContext<I18nValue | null>(null)
