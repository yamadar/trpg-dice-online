import { useCallback, useMemo, useState } from 'react'
import type { Pattern } from '../dice/types'
import type { Lang } from '../i18n/translations'
import { newPatternId } from '../storage/patterns'
import {
  loadActiveCharacterId,
  loadCharacters,
  newCharacterId,
  saveActiveCharacterId,
  saveCharacters,
} from '../storage/characters'
import { parseCharacterImport } from './io'
import type { Character, CharacterEdits } from './types'

export interface UseCharacters {
  characters: Character[]
  activeId: string | null
  activeCharacter: Character | null
  setActiveId: (id: string | null) => void
  /** Create a character and make it active; returns its id. */
  createCharacter: (name: string, lang: Lang) => string
  updateCharacter: (id: string, patch: Partial<CharacterEdits>) => void
  deleteCharacter: (id: string) => void
  addPattern: (characterId: string, pattern: Omit<Pattern, 'id'>) => void
  deletePattern: (characterId: string, patternId: string) => void
  /** Import a character from an exported-file string; returns success. */
  importCharacter: (text: string) => boolean
}

/** Saved characters and the active selection, backed by localStorage. */
export function useCharacters(): UseCharacters {
  const [characters, setCharacters] = useState<Character[]>(loadCharacters)
  const [activeId, setActiveIdState] = useState<string | null>(loadActiveCharacterId)

  const setActiveId = useCallback((id: string | null) => {
    saveActiveCharacterId(id)
    setActiveIdState(id)
  }, [])

  const createCharacter = useCallback(
    (name: string, lang: Lang): string => {
      const id = newCharacterId()
      const character: Character = { id, name, background: '', memo: '', patterns: [], lang }
      setCharacters((prev) => {
        const next = [...prev, character]
        saveCharacters(next)
        return next
      })
      setActiveId(id)
      return id
    },
    [setActiveId],
  )

  const updateCharacter = useCallback(
    (id: string, patch: Partial<CharacterEdits>) => {
      setCharacters((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
        saveCharacters(next)
        return next
      })
    },
    [],
  )

  const deleteCharacter = useCallback(
    (id: string) => {
      setCharacters((prev) => {
        const next = prev.filter((c) => c.id !== id)
        saveCharacters(next)
        return next
      })
      // Deleting the active character drops back to "no character".
      setActiveIdState((current) => {
        if (current !== id) return current
        saveActiveCharacterId(null)
        return null
      })
    },
    [],
  )

  const addPattern = useCallback((characterId: string, pattern: Omit<Pattern, 'id'>) => {
    setCharacters((prev) => {
      const next = prev.map((c) =>
        c.id === characterId
          ? { ...c, patterns: [{ ...pattern, id: newPatternId() }, ...c.patterns] }
          : c,
      )
      saveCharacters(next)
      return next
    })
  }, [])

  const deletePattern = useCallback((characterId: string, patternId: string) => {
    setCharacters((prev) => {
      const next = prev.map((c) =>
        c.id === characterId
          ? { ...c, patterns: c.patterns.filter((p) => p.id !== patternId) }
          : c,
      )
      saveCharacters(next)
      return next
    })
  }, [])

  const importCharacter = useCallback(
    (text: string): boolean => {
      const imported = parseCharacterImport(text)
      if (!imported) return false
      const id = newCharacterId()
      setCharacters((prev) => {
        const next = [...prev, { ...imported, id }]
        saveCharacters(next)
        return next
      })
      setActiveId(id)
      return true
    },
    [setActiveId],
  )

  const activeCharacter = useMemo(
    () => characters.find((c) => c.id === activeId) ?? null,
    [characters, activeId],
  )

  return {
    characters,
    activeId,
    activeCharacter,
    setActiveId,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    addPattern,
    deletePattern,
    importCharacter,
  }
}
