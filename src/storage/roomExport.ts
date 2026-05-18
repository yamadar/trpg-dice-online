/**
 * Serialize a room's full durable history to a downloadable JSON file.
 *
 * The export is a self-contained record of one room: every roll, chat
 * message (including inline file attachments) and system marker, each
 * carrying the player / character snapshot it was created with. The
 * payload is versioned and typed so a future importer can recognize it,
 * mirroring the character export in `characters/io.ts`.
 */

import type { LogEntry } from './roomLog'

/** Marks our room-log export files. */
const FILE_TYPE = 'trpg-dice-room-log'
const FILE_VERSION = 1

/** Room identity stored alongside the log in an export. */
interface ExportRoom {
  code: string
  name: string
}

/**
 * Build the versioned JSON text for a room export. `entries` is the
 * durable log oldest-first; `exportedAt` is injectable so the output is
 * deterministic in tests.
 */
export function exportRoomLogJSON(
  room: ExportRoom,
  entries: LogEntry[],
  exportedAt: number = Date.now(),
): string {
  return JSON.stringify(
    {
      type: FILE_TYPE,
      version: FILE_VERSION,
      exportedAt,
      room,
      entries,
    },
    null,
    2,
  )
}

/** A dated, room-scoped download name, e.g. `room-ABC123-2026-05-18.json`. */
export function roomLogFilename(roomCode: string, date: Date = new Date()): string {
  return `room-${roomCode}-${date.toISOString().slice(0, 10)}.json`
}
