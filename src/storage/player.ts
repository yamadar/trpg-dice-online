import { loadString, saveString } from './local'

const ID_KEY = 'trpg-dice.playerId'
const NAME_KEY = 'trpg-dice.playerName'

/** A stable per-browser player id, created on first use. */
export function getPlayerId(): string {
  let id = loadString(ID_KEY, '')
  if (!id) {
    id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    saveString(ID_KEY, id)
  }
  return id
}

export function loadPlayerName(): string {
  return loadString(NAME_KEY, '')
}

export function savePlayerName(name: string): void {
  saveString(NAME_KEY, name)
}
