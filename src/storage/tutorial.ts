import { loadString, saveString } from './local'

const SEEN_KEY = 'trpg-dice.tutorialSeen'

/** Whether the first-run tutorial has already been shown. */
export function isTutorialSeen(): boolean {
  return loadString(SEEN_KEY, '') === '1'
}

export function markTutorialSeen(): void {
  saveString(SEEN_KEY, '1')
}
