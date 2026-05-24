/**
 * Pure host-side validators for the annotation-layer ClientMessage
 * requests (text labels, pen strokes, fog).
 *
 * Each function takes the raw inbound message plus enough context to
 * authorise it (the resolved sender record, any existing record) and
 * returns either a sanitized result ready to apply / broadcast, or
 * null when the message must be silently dropped. Pulled out of
 * `useSession`'s `handleClientMessage` so the validation rules can be
 * unit-tested without React, PeerJS or IndexedDB getting in the way.
 *
 * The host calls these and treats the returned value as authoritative
 * — `ownerPlayerId` in particular is always re-stamped from the
 * connection identity here so a client cannot spoof another player's
 * ownership.
 */

import { canEditMapText, canEraseStroke } from './annotations'
import {
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_WIDTH,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  MAX_PEN_WIDTH,
  MAX_TEXT_FONT_SIZE,
  MAX_TEXT_LENGTH,
  MIN_PEN_WIDTH,
  MIN_TEXT_FONT_SIZE,
  type DrawStroke,
  type MapText,
} from './types'

/** Minimal sender identity passed to validators. */
export interface SenderRef {
  id: string
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Validate a `mapTextAddRequest`. The client supplies a draft label;
 * the host re-stamps `ownerPlayerId` from the trusted connection
 * identity, caps the text length, and falls back to defaults for any
 * field the client filled with garbage. Returns null when the request
 * lacks an id or a usable (non-empty) text — the wire format requires
 * those.
 */
export function validateMapTextAddRequest(
  msg: { text: unknown },
  sender: SenderRef,
): MapText | null {
  if (!sender.id) return null
  const raw = msg.text
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id : ''
  if (!id) return null
  const rawText = typeof r.text === 'string' ? r.text : ''
  const cleaned = rawText.trim().slice(0, MAX_TEXT_LENGTH)
  if (!cleaned) return null
  return {
    id,
    x: typeof r.x === 'number' && Number.isFinite(r.x) ? r.x : 0,
    y: typeof r.y === 'number' && Number.isFinite(r.y) ? r.y : 0,
    text: cleaned,
    color: typeof r.color === 'string' && r.color ? r.color : DEFAULT_TEXT_COLOR,
    fontSize:
      typeof r.fontSize === 'number' && Number.isFinite(r.fontSize)
        ? clamp(r.fontSize, MIN_TEXT_FONT_SIZE, MAX_TEXT_FONT_SIZE)
        : DEFAULT_TEXT_FONT_SIZE,
    ownerPlayerId: sender.id,
  }
}

/**
 * Validate a `mapTextUpdateRequest`. The sender must own the label
 * (or be the host) per `canEditMapText`. Returns the merged record on
 * success, null when the sender is not authorised, the label is
 * missing, or the resulting text would be empty.
 *
 * `senderIsHost` is wired separately from the message because the
 * host's local-edit path also flows through here in tests; in the
 * useSession runtime it is always `false` (client request).
 */
export function validateMapTextUpdateRequest(
  msg: {
    id: string
    text?: string
    x?: number
    y?: number
    color?: string
    fontSize?: number
  },
  sender: SenderRef,
  existing: MapText | undefined,
  senderIsHost = false,
): MapText | null {
  if (!sender.id || !existing) return null
  if (!canEditMapText(existing, { playerId: sender.id, isHost: senderIsHost })) {
    return null
  }
  const next: MapText = {
    ...existing,
    ...(typeof msg.text === 'string'
      ? { text: msg.text.slice(0, MAX_TEXT_LENGTH) }
      : {}),
    ...(typeof msg.x === 'number' && Number.isFinite(msg.x) ? { x: msg.x } : {}),
    ...(typeof msg.y === 'number' && Number.isFinite(msg.y) ? { y: msg.y } : {}),
    ...(typeof msg.color === 'string' && msg.color ? { color: msg.color } : {}),
    ...(typeof msg.fontSize === 'number' && Number.isFinite(msg.fontSize)
      ? {
          fontSize: clamp(msg.fontSize, MIN_TEXT_FONT_SIZE, MAX_TEXT_FONT_SIZE),
        }
      : {}),
  }
  if (!next.text.trim()) return null
  return next
}

/**
 * Validate a `mapTextRemoveRequest`. Returns the label id on success,
 * null when the sender is not the owner / host.
 */
export function validateMapTextRemoveRequest(
  msg: { id: string },
  sender: SenderRef,
  existing: MapText | undefined,
  senderIsHost = false,
): string | null {
  if (!sender.id || !msg.id || !existing) return null
  if (!canEditMapText(existing, { playerId: sender.id, isHost: senderIsHost })) {
    return null
  }
  return msg.id
}

/**
 * Validate a `drawStrokeAddRequest`. Re-stamps `ownerPlayerId`,
 * filters non-finite point coordinates and clamps the width to the
 * configured range. Returns null when the stroke would render to
 * fewer than one segment (two points).
 */
export function validateDrawStrokeAddRequest(
  msg: { stroke: unknown },
  sender: SenderRef,
): DrawStroke | null {
  if (!sender.id) return null
  const raw = msg.stroke
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id : ''
  if (!id) return null
  const rawPoints = r.points
  if (!Array.isArray(rawPoints)) return null
  const points: number[] = []
  for (const p of rawPoints) {
    if (typeof p === 'number' && Number.isFinite(p)) points.push(p)
  }
  if (points.length < 4) return null // need at least 2 (x, y) pairs
  return {
    id,
    points,
    color: typeof r.color === 'string' && r.color ? r.color : DEFAULT_PEN_COLOR,
    width:
      typeof r.width === 'number' && Number.isFinite(r.width)
        ? clamp(r.width, MIN_PEN_WIDTH, MAX_PEN_WIDTH)
        : DEFAULT_PEN_WIDTH,
    ownerPlayerId: sender.id,
  }
}

/**
 * Validate a `drawStrokeRemoveRequest`. Returns the stroke id on
 * success, null when the sender is not the owner / host.
 */
export function validateDrawStrokeRemoveRequest(
  msg: { id: string },
  sender: SenderRef,
  existing: DrawStroke | undefined,
  senderIsHost = false,
): string | null {
  if (!sender.id || !msg.id || !existing) return null
  if (!canEraseStroke(existing, { playerId: sender.id, isHost: senderIsHost })) {
    return null
  }
  return msg.id
}
