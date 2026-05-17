import type { Pattern } from '../dice/types'
import { loadJSON, saveJSON } from './local'

const PATTERNS_KEY = 'trpg-dice.patterns'

/** Load the user's saved patterns from localStorage. */
export function loadPatterns(): Pattern[] {
  const list = loadJSON<Pattern[]>(PATTERNS_KEY, [])
  return Array.isArray(list) ? list : []
}

/** Persist the full pattern list. */
export function savePatterns(patterns: Pattern[]): void {
  saveJSON(PATTERNS_KEY, patterns)
}

export function newPatternId(): string {
  return `pat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
