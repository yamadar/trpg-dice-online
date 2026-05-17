import { loadString, saveString } from './local'

const ID_KEY = 'trpg-dice.playerId'
const NAME_KEY = 'trpg-dice.playerName'

/**
 * A per-tab player id, kept in sessionStorage so it survives reloads but
 * stays distinct between tabs. Two tabs (or two people) are two players,
 * each with their own identity and color.
 */
export function getPlayerId(): string {
  try {
    const existing = sessionStorage.getItem(ID_KEY)
    if (existing) return existing
  } catch {
    /* sessionStorage may be unavailable */
  }
  const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  try {
    sessionStorage.setItem(ID_KEY, id)
  } catch {
    /* ignore */
  }
  return id
}

export function loadPlayerName(): string {
  return loadString(NAME_KEY, '')
}

export function savePlayerName(name: string): void {
  saveString(NAME_KEY, name)
}
