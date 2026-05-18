import { loadString, saveString } from './local'
import type { TranslationBackend } from '../i18n/translator'

const AUTO_KEY = 'trpg-dice.autoTranslate'
const BACKEND_KEY = 'trpg-dice.translationBackend'

/** Whether chat is auto-translated into the player's UI language. */
export function loadAutoTranslate(): boolean {
  return loadString(AUTO_KEY, '') === '1'
}

export function saveAutoTranslate(on: boolean): void {
  saveString(AUTO_KEY, on ? '1' : '0')
}

/** The chosen translation backend, defaulting to the on-device one. */
export function loadTranslationBackend(): TranslationBackend {
  return loadString(BACKEND_KEY, '') === 'mymemory' ? 'mymemory' : 'chrome'
}

export function saveTranslationBackend(backend: TranslationBackend): void {
  saveString(BACKEND_KEY, backend)
}
