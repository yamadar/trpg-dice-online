/**
 * Chat @mentions.
 *
 * Mentions are resolved to player ids at send time and stored that way, so
 * a highlight keeps working after the target renames, and two players who
 * share a name are both matched. `@all` / `@ALL` highlights everyone.
 */

/** A player as far as mention matching is concerned. */
export interface MentionTarget {
  id: string
  /** Player (person) name — the text typed after `@`. */
  name: string
}

/** Resolved mentions found in a chat message's text. */
export interface ResolvedMentions {
  /** Ids of explicitly mentioned players. */
  ids: string[]
  /** True when the message mentions everyone (`@all`). */
  all: boolean
}

/** Matches `@all` (any case) not glued to another letter/number. */
const ALL_PATTERN = /@all(?![\p{L}\p{N}])/iu

/**
 * Resolve every `@mention` in `text` against the given players. Matching
 * is by name (`@name` appearing anywhere in the text); ids are returned so
 * the result survives later renames. Pure.
 */
export function resolveMentions(text: string, players: MentionTarget[]): ResolvedMentions {
  const ids = new Set<string>()
  for (const player of players) {
    const name = player.name.trim()
    if (name && text.includes('@' + name)) ids.add(player.id)
  }
  return { ids: [...ids], all: ALL_PATTERN.test(text) }
}

/** An in-progress `@` token the caret currently sits in. */
export interface MentionQuery {
  /** Text typed after the `@`, used to filter suggestions. */
  query: string
  /** Index of the `@` in the text. */
  start: number
}

/**
 * If the caret sits inside an `@token` (the `@` at the start of the text
 * or after whitespace), return that token for autocomplete. Pure.
 */
export function mentionQuery(text: string, cursor: number): MentionQuery | null {
  const before = text.slice(0, Math.max(0, cursor))
  const m = before.match(/(?:^|\s)@(\S*)$/u)
  if (!m) return null
  const query = m[1]
  return { query, start: cursor - query.length - 1 }
}

/**
 * Replace the in-progress `@token` at `start` with `@label ` (trailing
 * space), returning the new text and where the caret should land. Pure.
 */
export function applyMention(
  text: string,
  start: number,
  query: string,
  label: string,
): { text: string; cursor: number } {
  const tokenEnd = start + 1 + query.length
  const inserted = '@' + label + ' '
  return {
    text: text.slice(0, start) + inserted + text.slice(tokenEnd),
    cursor: start + inserted.length,
  }
}
