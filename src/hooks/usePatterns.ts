import { useCallback, useState } from 'react'
import type { Pattern } from '../dice/types'
import { loadPatterns, newPatternId, savePatterns } from '../storage/patterns'

export interface UsePatterns {
  patterns: Pattern[]
  addPattern: (pattern: Omit<Pattern, 'id'>) => void
  deletePattern: (id: string) => void
}

/** Saved-pattern list backed by localStorage. */
export function usePatterns(): UsePatterns {
  const [patterns, setPatterns] = useState<Pattern[]>(loadPatterns)

  const addPattern = useCallback((pattern: Omit<Pattern, 'id'>) => {
    setPatterns((prev) => {
      const next = [{ ...pattern, id: newPatternId() }, ...prev]
      savePatterns(next)
      return next
    })
  }, [])

  const deletePattern = useCallback((id: string) => {
    setPatterns((prev) => {
      const next = prev.filter((p) => p.id !== id)
      savePatterns(next)
      return next
    })
  }, [])

  return { patterns, addPattern, deletePattern }
}
