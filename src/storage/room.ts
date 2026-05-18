import { loadString, saveString } from './local'

const LAST_CODE_KEY = 'trpg-dice.lastRoomCode'

/** The room code last created or joined, so the join field can prefill it. */
export function loadLastRoomCode(): string {
  return loadString(LAST_CODE_KEY, '')
}

export function saveLastRoomCode(code: string): void {
  saveString(LAST_CODE_KEY, code)
}
