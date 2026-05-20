import { en } from './translations/en'
import { ja } from './translations/ja'
import { es } from './translations/es'
import { ptBR } from './translations/pt-BR'
import { de } from './translations/de'
import { fr } from './translations/fr'
import { zhCN } from './translations/zh-CN'
import { ko } from './translations/ko'
import { zhTW } from './translations/zh-TW'
import { it } from './translations/it'
import { ru } from './translations/ru'
import { th } from './translations/th'
import { tr } from './translations/tr'
import { id } from './translations/id'
import { pl } from './translations/pl'
import { vi } from './translations/vi'
import { hi } from './translations/hi'
import { ar } from './translations/ar'
import { uk } from './translations/uk'

/**
 * Supported UI languages, in the order shown by the language picker.
 * English first as a neutral default, then Japanese (the original UI
 * language), then the rest roughly by speaker count.
 */
export const LANGS = [
  'en',
  'ja',
  'es',
  'pt-BR',
  'zh-CN',
  'zh-TW',
  'de',
  'fr',
  'ko',
  'it',
  'ru',
  'th',
  'tr',
  'id',
  'pl',
  'vi',
  'hi',
  'ar',
  'uk',
] as const
export type Lang = (typeof LANGS)[number]

/** Flat key -> string dictionary. Placeholders use {name} syntax. */
export type Dict = Record<string, string>

/** Native-language label shown in the picker for each supported language. */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  ja: '日本語',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  de: 'Deutsch',
  fr: 'Français',
  ko: '한국어',
  it: 'Italiano',
  ru: 'Русский',
  th: 'ไทย',
  tr: 'Türkçe',
  id: 'Bahasa Indonesia',
  pl: 'Polski',
  vi: 'Tiếng Việt',
  hi: 'हिन्दी',
  ar: 'العربية',
  uk: 'Українська',
}

/** Right-to-left scripts that need `dir="rtl"` applied to the document. */
const RTL_LANGS = new Set<Lang>(['ar'])

export function isRtl(lang: Lang): boolean {
  return RTL_LANGS.has(lang)
}

export const TRANSLATIONS: Record<Lang, Dict> = {
  en,
  ja,
  es,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  de,
  fr,
  ko,
  it,
  ru,
  th,
  tr,
  id,
  pl,
  vi,
  hi,
  ar,
  uk,
}

/** Look up a key for a language and interpolate {placeholder} params. */
export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  )
}
