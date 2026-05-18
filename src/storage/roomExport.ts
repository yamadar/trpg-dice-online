/**
 * Package a room's full durable history into a downloadable ZIP archive.
 *
 * The archive holds a `room.json` manifest — room identity, the player
 * roster and every roll / chat / marker (each with the player and
 * character snapshot it was created with) — plus an `attachments/`
 * folder with the binary content of every chat attachment. Storing
 * attachments as real files keeps base64 out of the JSON and lets the
 * archive compress them. The manifest is versioned and typed so a
 * future importer can restore the whole room from the one file.
 */

import { strToU8, zipSync } from 'fflate'
import type { LogEntry } from './roomLog'
import type { ChatMessage, Player } from '../net/protocol'

/** Marks our room-export archives. */
const FILE_TYPE = 'trpg-dice-room-log'
/** v2: ZIP archive with a player roster and attachments stored as files. */
const FILE_VERSION = 2

/** Room identity stored in the manifest. */
interface ExportRoom {
  code: string
  name: string
}

/**
 * A chat attachment as it appears in the manifest: the bytes live in the
 * archive at `path`, replacing the inline base64 data URL.
 */
interface ExportFile {
  name: string
  type: string
  size: number
  path: string
}

/** Decode a `data:<type>;base64,<data>` URL to its raw bytes. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const binary = atob(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** A filesystem-safe extension for an attachment, from its name or type. */
function fileExt(file: { name: string; type: string }): string {
  const fromName = /\.([a-z0-9]+)$/i.exec(file.name)
  if (fromName) return fromName[1].toLowerCase()
  const slash = file.type.lastIndexOf('/')
  return slash >= 0 ? file.type.slice(slash + 1) : 'bin'
}

/**
 * Split chat attachments out of the log: each becomes a file in the
 * archive, and its log entry is rewritten to reference that path. The
 * input entries are cloned where changed, never mutated.
 */
function extractAttachments(entries: LogEntry[]): {
  entries: LogEntry[]
  files: Record<string, Uint8Array>
} {
  const files: Record<string, Uint8Array> = {}
  const rewritten = entries.map((entry): LogEntry => {
    if (entry.kind !== 'chat') return entry
    const chat = entry.data as ChatMessage
    if (!chat.file?.dataUrl) return entry
    const path = `attachments/${chat.id}.${fileExt(chat.file)}`
    files[path] = dataUrlToBytes(chat.file.dataUrl)
    const file: ExportFile = {
      name: chat.file.name,
      type: chat.file.type,
      size: chat.file.size,
      path,
    }
    return { ...entry, data: { ...chat, file } }
  })
  return { entries: rewritten, files }
}

/**
 * Build the ZIP archive bytes for a room export. `entries` is the
 * durable log oldest-first; `exportedAt` is injectable so the manifest
 * is deterministic in tests.
 */
export function buildRoomExport(
  room: ExportRoom,
  players: Player[],
  entries: LogEntry[],
  exportedAt: number = Date.now(),
): Uint8Array<ArrayBuffer> {
  const split = extractAttachments(entries)
  const manifest = {
    type: FILE_TYPE,
    version: FILE_VERSION,
    exportedAt,
    room,
    players,
    entries: split.entries,
  }
  const zip = zipSync({
    'room.json': strToU8(JSON.stringify(manifest, null, 2)),
    ...split.files,
  })
  // fflate types its output buffer loosely; it is always a plain
  // ArrayBuffer, which a Blob download needs.
  return zip as Uint8Array<ArrayBuffer>
}

/** A dated, room-scoped archive name, e.g. `room-ABC123-2026-05-18.zip`. */
export function roomExportFilename(roomCode: string, date: Date = new Date()): string {
  return `room-${roomCode}-${date.toISOString().slice(0, 10)}.zip`
}
