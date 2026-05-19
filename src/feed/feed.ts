import type { RollResult } from '../dice/types'
import type { ChatMessage } from '../net/protocol'

/**
 * System markers annotate the feed with room-membership events. They are
 * local to each client (not synced) — they describe what *this* player
 * experienced, e.g. joining or leaving a room.
 */
export type MarkerType =
  | 'created'
  | 'joined'
  | 'youLeft'
  | 'youClosed'
  | 'gmClosed'
  | 'hostLost'
  | 'playerJoined'
  | 'playerLeft'
  | 'reconnecting'
  | 'reconnected'
  | 'reconnectFailed'
  | 'codeChanged'

export interface SystemMarker {
  id: string
  timestamp: number
  type: MarkerType
  /** Room code, for created/joined markers. */
  roomCode?: string
  /** Player name, for playerJoined/playerLeft markers. */
  playerName?: string
}

/** A marker that ends the player's membership in a room. */
export function isRoomExitMarker(type: MarkerType): boolean {
  return type === 'youLeft' || type === 'youClosed' || type === 'gmClosed' || type === 'hostLost'
}

export function newMarkerId(): string {
  return `mk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export type FeedFilter = 'all' | 'rolls' | 'chat' | 'files'

export type FeedItem =
  | { kind: 'roll'; id: string; at: number; roll: RollResult }
  | { kind: 'chat'; id: string; at: number; message: ChatMessage }
  /** `count` folds a run of identical consecutive markers — 1 when alone. */
  | { kind: 'system'; id: string; at: number; marker: SystemMarker; count: number }

/** Whether two markers describe the same event for the same player / room. */
function sameMarker(a: SystemMarker, b: SystemMarker): boolean {
  return a.type === b.type && a.playerName === b.playerName && a.roomCode === b.roomCode
}

/**
 * Fold a run of consecutive identical system markers into the first one,
 * counting how many were merged — so e.g. a flaky connection's repeated
 * "joined" notices read as a single "joined (3)" rather than a wall of
 * duplicates. Only adjacent markers merge; anything between breaks the run.
 */
function collapseSystemRuns(items: FeedItem[]): FeedItem[] {
  const out: FeedItem[] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (
      item.kind === 'system' &&
      last &&
      last.kind === 'system' &&
      sameMarker(last.marker, item.marker)
    ) {
      out[out.length - 1] = { ...last, count: last.count + 1 }
    } else {
      out.push(item)
    }
  }
  return out
}

/**
 * Merge rolls, chat and system markers into a single timeline ordered
 * oldest-first. The filter hides rolls or chat; system markers stay
 * visible for the all / rolls / chat views because they give context.
 * The "files" view is a focused gallery: only chat messages that carry
 * an attachment, with no rolls or markers. Entries are de-duplicated by
 * id, since paged-in older history overlaps the live window.
 */
export function buildFeed(
  history: RollResult[],
  chat: ChatMessage[],
  markers: SystemMarker[],
  filter: FeedFilter,
): FeedItem[] {
  const items: FeedItem[] = []
  if (filter === 'all' || filter === 'rolls') {
    for (const roll of history) {
      items.push({ kind: 'roll', id: roll.id, at: roll.timestamp, roll })
    }
  }
  if (filter !== 'rolls') {
    for (const message of chat) {
      if (filter === 'files' && !message.file) continue
      items.push({ kind: 'chat', id: message.id, at: message.timestamp, message })
    }
  }
  if (filter !== 'files') {
    for (const marker of markers) {
      items.push({ kind: 'system', id: marker.id, at: marker.timestamp, marker, count: 1 })
    }
  }
  // Paged-in older history overlaps the live window — show each entry once.
  const seen = new Set<string>()
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
  unique.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  return collapseSystemRuns(unique)
}
