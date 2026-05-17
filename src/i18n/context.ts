import { createContext } from 'react'
import type { Lang } from './translations'

export type TFn = (key: string, params?: Record<string, string | number>) => string

export interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TFn
}

export const I18nContext = createContext<I18nValue | null>(null)
