import type { RollResult } from '../dice/types'
import type { Lang } from '../i18n/translations'

export interface Player {
  id: string
  /** Player (person) name. */
  name: string
  isGM: boolean
  /** Active character name, or '' when acting as the player directly. */
  characterName: string
  /** Active character's public background, or '' when none. */
  background: string
  /** The player's current UI language (for future translation). */
  lang: Lang
}

/**
 * A file attached to a chat message. The content travels inline as a
 * base64 data URL because the app has no backend — there is nowhere to
 * upload to, so attachments are sent over the same P2P channel as chat.
 */
export interface ChatFile {
  /** Original file name, shown on the download chip. */
  name: string
  /** MIME type, e.g. "image/png"; an empty string when unknown. */
  type: string
  /** Original file size in bytes (before any image downscaling). */
  size: number
  /** File content as a base64 data URL. */
  dataUrl: string
}

export interface ChatMessage {
  id: string
  playerId: string
  /** Composed display name ("Character（Player）" or just the player). */
  playerName: string
  /** Whether the sender was the GM — a snapshot, shown as a mark in the feed. */
  isGM: boolean
  /** Active character name when the message was sent ('' if none). A
   *  snapshot, so tapping the name later shows that character, not the
   *  sender's current one. */
  characterName: string
  /** Active character's public background at that time ('' if none). */
  background: string
  text: string
  timestamp: number
  /** Language the message was written in (for future translation). */
  lang: Lang
  /** Optional attachment (image preview or downloadable file). */
  file?: ChatFile
  /** Ids of @mentioned players (id-based, so renames do not break it). */
  mentions: string[]
  /** True when the message mentions everyone (`@all`). */
  mentionsAll: boolean
}

/** Shared state a host sends to a newly joined client. */
export interface Snapshot {
  players: Player[]
  history: RollResult[]
  chat: ChatMessage[]
  /** GM-chosen room name ('' if the room is unnamed). */
  roomName: string
}

/** A "someone is typing" signal carrying who is typing. */
export interface TypingSignal {
  playerId: string
  playerName: string
}

/** A player's mutable identity: player name, active character, language. */
export interface Identity {
  name: string
  characterName: string
  background: string
  lang: Lang
}

/** Messages a client sends to the host. */
export type ClientMessage =
  | { t: 'hello'; player: Player }
  | { t: 'roll'; result: RollResult }
  | { t: 'chat'; message: ChatMessage }
  | { t: 'identity'; identity: Identity }
  | { t: 'typing'; signal: TypingSignal }
  /** Periodic liveness signal so the host can detect dropped clients. */
  | { t: 'ping' }

/** Messages a host sends to clients. */
export type HostMessage =
  | { t: 'welcome'; snapshot: Snapshot }
  | { t: 'players'; players: Player[] }
  | { t: 'roll'; result: RollResult }
  | { t: 'chat'; message: ChatMessage }
  | { t: 'typing'; signal: TypingSignal }
  | { t: 'notice'; event: 'playerJoined' | 'playerLeft'; playerName: string; timestamp: number }
  | { t: 'roomName'; name: string }
  /** The GM changed the room code; clients must re-join under the new one. */
  | { t: 'roomCodeChanged'; code: string }
  /** Periodic keepalive so a client can tell a quiet GM from an absent one. */
  | { t: 'alive' }
  | { t: 'roomClosed' }

export type NetMessage = ClientMessage | HostMessage

/**
 * Strip the value of a hidden roll so non-GM players cannot see it.
 * The roll still appears in the history as a hidden entry.
 */
export function redactRoll(result: RollResult): RollResult {
  if (!result.hidden) return result
  return { ...result, faces: [], modifier: 0, value: 0 }
}

/**
 * peerIds in `roster` that belong to the same player as `playerId` but
 * under a connection other than `keepPeerId` — i.e. stale ghost entries
 * left by an earlier connection of a player who is (re)joining now.
 */
export function staleGhostPeerIds(
  roster: Map<string, Player>,
  playerId: string,
  keepPeerId: string,
): string[] {
  const ghosts: string[] = []
  for (const [peerId, player] of roster) {
    if (player.id === playerId && peerId !== keepPeerId) ghosts.push(peerId)
  }
  return ghosts
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PEER_PREFIX = 'trpgdice-'

/** Generate a human-friendly 6-character room code (no ambiguous chars). */
export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

/** Map a room code to the namespaced PeerJS id used on the public broker. */
export function peerIdForCode(code: string): string {
  return PEER_PREFIX + code.toUpperCase()
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function newChatId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
