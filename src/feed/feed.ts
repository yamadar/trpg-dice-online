import type { RollResult } from '../dice/types'
import type { ChatMessage } from '../net/protocol'
import { characterImagesKey, legacyCharacterIdFromName } from '../storage/roomLog'

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

/** Resolve the `${playerId}|${characterId}` key for a feed speaker, with
 *  the `legacyCharacterIdFromName` fallback for entries that predate the
 *  `characterId` field. Exported so both the live and read-only feeds
 *  look up the same per-character row in `sessionCharacters`.
 *
 *  The fallback only kicks in when `characterId` is *missing*
 *  (`undefined`); an explicit empty string means "the player was
 *  acting directly, no character" and must stay empty — otherwise a
 *  message that carries both `characterId: ''` and a stray legacy
 *  `characterName` (an older client, a buggy writer) would resolve
 *  to the wrong `@n:<name>` row in `sessionCharacters`. */
export function speakerImageKey(speaker: {
  playerId: string
  characterId?: string
  characterName?: string
}): string {
  const cid =
    speaker.characterId !== undefined
      ? speaker.characterId
      : legacyCharacterIdFromName(speaker.characterName ?? '')
  return characterImagesKey(speaker.playerId, cid)
}

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
 * Merge rolls, chat and system markers into one oldest-first timeline.
 *
 * Identical consecutive system markers are folded together with a count
 * — but the fold is computed on the *full* timeline, before the view
 * filter is applied, so a roll or chat hidden by the current filter can
 * never make two separate markers look like one repeated marker.
 *
 * The filter then hides the kinds a view does not want: `rolls` drops
 * chat, `chat` drops rolls, and `files` is a focused gallery of just the
 * chat messages that carry an attachment. Entries are de-duplicated by
 * id, since paged-in older history overlaps the live window.
 */
export function buildFeed(
  history: RollResult[],
  chat: ChatMessage[],
  markers: SystemMarker[],
  filter: FeedFilter,
): FeedItem[] {
  // The full timeline — every roll, chat and marker — so a marker run is
  // judged adjacent only when nothing really sits between its entries.
  const all: FeedItem[] = []
  for (const roll of history) {
    all.push({ kind: 'roll', id: roll.id, at: roll.timestamp, roll })
  }
  for (const message of chat) {
    all.push({ kind: 'chat', id: message.id, at: message.timestamp, message })
  }
  for (const marker of markers) {
    all.push({ kind: 'system', id: marker.id, at: marker.timestamp, marker, count: 1 })
  }
  // Paged-in older history overlaps the live window — show each entry once.
  const seen = new Set<string>()
  const unique = all.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
  unique.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  // Fold adjacent identical markers on the real timeline, then drop the
  // entry kinds the current view hides.
  return collapseSystemRuns(unique).filter((item) => {
    if (item.kind === 'roll') return filter === 'all' || filter === 'rolls'
    if (item.kind === 'chat') {
      if (filter === 'rolls') return false
      if (filter === 'files') return item.message.file !== undefined
      return true
    }
    return filter !== 'files'
  })
}
