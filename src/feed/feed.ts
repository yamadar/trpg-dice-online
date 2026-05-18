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
  | { kind: 'system'; id: string; at: number; marker: SystemMarker }

/**
 * Merge rolls, chat and system markers into a single timeline ordered
 * oldest-first. The filter hides rolls or chat; system markers stay
 * visible for the all / rolls / chat views because they give context.
 * The "files" view is a focused gallery: only chat messages that carry
 * an attachment, with no rolls or markers.
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
      items.push({ kind: 'system', id: marker.id, at: marker.timestamp, marker })
    }
  }
  items.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  return items
}
