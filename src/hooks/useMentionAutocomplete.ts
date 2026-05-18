import { useCallback, useMemo, useState, type KeyboardEvent, type RefObject } from 'react'
import type { Player } from '../net/protocol'
import { applyMention, mentionQuery } from '../chat/mentions'

/** An entry in the @mention autocomplete list. */
export type MentionSuggestion = { kind: 'all' } | { kind: 'player'; id: string; name: string }

/** How many autocomplete suggestions to show at once. */
const MAX_SUGGESTIONS = 6

interface Options {
  text: string
  setText: (text: string) => void
  players: Player[]
  playerId: string
  inputRef: RefObject<HTMLInputElement | null>
}

export interface MentionAutocomplete {
  /** Suggestions to render; empty when the autocomplete is inactive. */
  suggestions: MentionSuggestion[]
  /** Index of the highlighted suggestion. */
  selected: number
  /** Recompute the autocomplete from the input value and caret position. */
  refresh: (value: string, cursor: number) => void
  /** Dismiss the autocomplete (e.g. on blur or after sending). */
  clear: () => void
  /** Insert a suggestion into the text and return focus to the input. */
  pick: (suggestion: MentionSuggestion) => void
  /** Handle a keydown; returns true when the autocomplete consumed it. */
  handleKeyDown: (e: KeyboardEvent) => boolean
}

/**
 * Drives the chat @mention autocomplete: it tracks the in-progress `@token`
 * the caret sits in, the matching players (plus `@all`), and keyboard
 * navigation. The owning component keeps the text state and passes it in.
 */
export function useMentionAutocomplete({
  text,
  setText,
  players,
  playerId,
  inputRef,
}: Options): MentionAutocomplete {
  const [mention, setMention] = useState<{
    query: string
    start: number
    selected: number
  } | null>(null)

  // The "everyone" entry plus matching players (self excluded).
  const suggestions = useMemo<MentionSuggestion[]>(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    const list: MentionSuggestion[] = []
    if ('all'.startsWith(q)) list.push({ kind: 'all' })
    for (const p of players) {
      if (p.id === playerId) continue
      const name = p.name.trim()
      if (name && name.toLowerCase().includes(q)) {
        list.push({ kind: 'player', id: p.id, name })
      }
    }
    return list.slice(0, MAX_SUGGESTIONS)
  }, [mention, players, playerId])

  const refresh = useCallback((value: string, cursor: number) => {
    const q = mentionQuery(value, cursor)
    setMention(q ? { query: q.query, start: q.start, selected: 0 } : null)
  }, [])

  const clear = useCallback(() => setMention(null), [])

  const pick = useCallback(
    (suggestion: MentionSuggestion) => {
      if (!mention) return
      const label = suggestion.kind === 'all' ? 'all' : suggestion.name
      const next = applyMention(text, mention.start, mention.query, label)
      setText(next.text)
      setMention(null)
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(next.cursor, next.cursor)
        }
      })
    },
    [mention, text, setText, inputRef],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): boolean => {
      if (!mention || suggestions.length === 0) return false
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMention({ ...mention, selected: (mention.selected + 1) % suggestions.length })
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMention({
          ...mention,
          selected: (mention.selected - 1 + suggestions.length) % suggestions.length,
        })
        return true
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(null)
        return true
      }
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault()
        pick(suggestions[mention.selected] ?? suggestions[0])
        return true
      }
      return false
    },
    [mention, suggestions, pick],
  )

  return { suggestions, selected: mention?.selected ?? 0, refresh, clear, pick, handleKeyDown }
}
