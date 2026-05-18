/**
 * Parse a room-export ZIP archive (see `roomExport.ts`) back into the
 * data needed to restore the room. Chat attachments, stored in the
 * archive as separate files, are re-inlined as base64 data URLs so the
 * entries match the shape the durable log and feed expect — the inverse
 * of `buildRoomExport`.
 */

import { strFromU8, unzipSync } from 'fflate'
import { normalizeRoomCode } from '../net/protocol'
import type { LogEntry, LogKind } from './roomLog'

/** A room export parsed and ready to restore. */
export interface RoomImport {
  roomCode: string
  roomName: string
  entries: LogEntry[]
}

function isLogKind(value: unknown): value is LogKind {
  return value === 'roll' || value === 'chat' || value === 'marker'
}

/** Encode raw bytes as a `data:` URL, chunked to avoid arg-count limits. */
function bytesToDataUrl(bytes: Uint8Array, type: string): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:${type || 'application/octet-stream'};base64,${btoa(binary)}`
}

/**
 * Validate one manifest entry and, for a chat attachment, swap its
 * archive `path` back for an inline `dataUrl`. Returns null if the entry
 * is not a usable log entry.
 */
function parseEntry(raw: unknown, files: Record<string, Uint8Array>): LogEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  if (!isLogKind(e.kind)) return null
  if (!e.data || typeof e.data !== 'object') return null
  const data = e.data as Record<string, unknown>
  if (typeof data.id !== 'string' || typeof data.timestamp !== 'number') return null
  const at = typeof e.at === 'number' ? e.at : data.timestamp
  // Re-inline a chat attachment that was stored as a separate archive file.
  if (e.kind === 'chat' && data.file && typeof data.file === 'object') {
    const file = data.file as Record<string, unknown>
    if (typeof file.path === 'string') {
      const bytes = files[file.path]
      const restored: Record<string, unknown> = { ...data }
      const type = typeof file.type === 'string' ? file.type : ''
      if (bytes) {
        restored.file = {
          name: typeof file.name === 'string' ? file.name : '',
          type,
          size: typeof file.size === 'number' ? file.size : bytes.length,
          dataUrl: bytesToDataUrl(bytes, type),
        }
      } else {
        // The referenced file is missing — drop the attachment rather
        // than keep a dangling path.
        delete restored.file
      }
      return { kind: 'chat', at, data: restored }
    }
  }
  return { kind: e.kind, at, data: e.data }
}

/**
 * Parse a room-export ZIP. Returns the room identity and its durable-log
 * entries (attachments re-inlined), or null if the bytes are not a
 * recognizable room export.
 */
export function parseRoomImport(zipBytes: Uint8Array): RoomImport | null {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(zipBytes)
  } catch {
    return null
  }
  const manifestBytes = files['room.json']
  if (!manifestBytes) return null
  let manifest: unknown
  try {
    manifest = JSON.parse(strFromU8(manifestBytes))
  } catch {
    return null
  }
  if (!manifest || typeof manifest !== 'object') return null
  const m = manifest as Record<string, unknown>
  if (m.type !== 'trpg-dice-room-log') return null
  const room = (m.room && typeof m.room === 'object' ? m.room : {}) as Record<string, unknown>
  const roomCode = typeof room.code === 'string' ? normalizeRoomCode(room.code) : ''
  if (roomCode.length < 4) return null
  const rawEntries = Array.isArray(m.entries) ? m.entries : []
  const entries: LogEntry[] = []
  for (const raw of rawEntries) {
    const entry = parseEntry(raw, files)
    if (entry) entries.push(entry)
  }
  return {
    roomCode,
    roomName: typeof room.name === 'string' ? room.name : '',
    entries,
  }
}
