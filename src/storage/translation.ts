import { loadString, saveString } from './local'

const AUTO_KEY = 'trpg-dice.autoTranslate'

/** Whether chat is auto-translated into the player's UI language. */
export function loadAutoTranslate(): boolean {
  return loadString(AUTO_KEY, '') === '1'
}

export function saveAutoTranslate(on: boolean): void {
  saveString(AUTO_KEY, on ? '1' : '0')
}
