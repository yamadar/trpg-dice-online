import type { RollResult } from '../dice/types'

export interface Player {
  id: string
  name: string
  isGM: boolean
}

export interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  text: string
  timestamp: number
}

/** Shared state a host sends to a newly joined client. */
export interface Snapshot {
  players: Player[]
  history: RollResult[]
  chat: ChatMessage[]
}

/** A "someone is typing" signal carrying who is typing. */
export interface TypingSignal {
  playerId: string
  playerName: string
}

/** Messages a client sends to the host. */
export type ClientMessage =
  | { t: 'hello'; player: Player }
  | { t: 'roll'; result: RollResult }
  | { t: 'chat'; message: ChatMessage }
  | { t: 'rename'; name: string }
  | { t: 'typing'; signal: TypingSignal }

/** Messages a host sends to clients. */
export type HostMessage =
  | { t: 'welcome'; snapshot: Snapshot }
  | { t: 'players'; players: Player[] }
  | { t: 'roll'; result: RollResult }
  | { t: 'chat'; message: ChatMessage }
  | { t: 'typing'; signal: TypingSignal }
  | { t: 'notice'; event: 'playerJoined' | 'playerLeft'; playerName: string; timestamp: number }
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
