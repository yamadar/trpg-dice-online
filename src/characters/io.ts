import {
  DICE_TYPES,
  PATTERN_KINDS,
  type DiceType,
  type Pattern,
  type PatternKind,
} from '../dice/types'
import { LANGS, type Lang } from '../i18n/translations'
import type { Character } from './types'

const FILE_TYPE = 'trpg-dice-character'
const FILE_VERSION = 1

/** A character ready to be imported — everything but the (local) id. */
export type CharacterImport = Omit<Character, 'id'>

/**
 * Serialize a character to a versioned JSON string for download.
 * The private memo is excluded unless `includeMemo` is explicitly true.
 */
export function exportCharacterJSON(character: Character, includeMemo = false): string {
  const payload = {
    type: FILE_TYPE,
    version: FILE_VERSION,
    character: {
      name: character.name,
      background: character.background,
      memo: includeMemo ? character.memo : '',
      patterns: character.patterns,
      lang: character.lang,
    },
  }
  return JSON.stringify(payload, null, 2)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asLang(value: unknown): Lang {
  return (LANGS as readonly string[]).includes(value as string) ? (value as Lang) : 'ja'
}

/** Defensively coerce one pattern from imported data, or null if unusable. */
function parsePattern(raw: unknown): Pattern | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const diceType = p.diceType as DiceType
  const kind = p.kind as PatternKind
  if (!DICE_TYPES.includes(diceType) || !PATTERN_KINDS.includes(kind)) return null
  const count = Number(p.diceCount)
  const modifier = Number(p.modifier)
  return {
    id: asString(p.id) || `pat-${Math.random().toString(36).slice(2, 10)}`,
    name: asString(p.name),
    kind,
    diceType,
    diceCount: Number.isFinite(count) ? Math.max(1, Math.min(10, Math.floor(count))) : 1,
    modifier: Number.isFinite(modifier) ? Math.floor(modifier) : 0,
    // Absent in files written before hidden patterns existed.
    hidden: p.hidden === true,
  }
}

/**
 * Parse and validate an exported-character file. Returns the character
 * data without an id (the caller assigns a fresh local id), or null if
 * the input is not a recognizable character file.
 */
export function parseCharacterImport(text: string): CharacterImport | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  if (root.type !== FILE_TYPE) return null
  const c = root.character
  if (!c || typeof c !== 'object') return null
  const character = c as Record<string, unknown>
  const patterns = Array.isArray(character.patterns)
    ? (character.patterns.map(parsePattern).filter((p): p is Pattern => p !== null))
    : []
  return {
    name: asString(character.name),
    background: asString(character.background),
    memo: asString(character.memo),
    patterns,
    lang: asLang(character.lang),
  }
}
