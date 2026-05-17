import type { Character } from '../characters/types'
import { loadJSON, saveJSON, loadString, saveString } from './local'

const CHARACTERS_KEY = 'trpg-dice.characters'
const ACTIVE_KEY = 'trpg-dice.activeCharacterId'

/** Load all of the player's characters from localStorage. */
export function loadCharacters(): Character[] {
  const list = loadJSON<Character[]>(CHARACTERS_KEY, [])
  return Array.isArray(list) ? list : []
}

export function saveCharacters(characters: Character[]): void {
  saveJSON(CHARACTERS_KEY, characters)
}

/** Load the id of the character the player last had active (or null). */
export function loadActiveCharacterId(): string | null {
  const id = loadString(ACTIVE_KEY, '')
  return id || null
}

export function saveActiveCharacterId(id: string | null): void {
  saveString(ACTIVE_KEY, id ?? '')
}

export function newCharacterId(): string {
  return `chr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
