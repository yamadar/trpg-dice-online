/**
 * Parse a room-export ZIP archive (see `roomExport.ts`) back into the
 * data needed to restore the room. Chat attachments, stored in the
 * archive as separate files, are re-inlined as base64 data URLs so the
 * entries match the shape the durable log and feed expect — the inverse
 * of `buildRoomExport`.
 */

import { strFromU8, unzipSync } from 'fflate'
import { normalizeRoomCode } from '../net/protocol'
import { sanitizeStoredTabletop } from './tabletop'
import type { LogEntry, LogKind, SessionCharacterDraft } from './roomLog'
import type { TranslationRecord } from './roomExport'
import type { MapBackground, TabletopState } from '../tabletop/types'

/** A room export parsed and ready to restore. */
export interface RoomImport {
  roomCode: string
  roomName: string
  entries: LogEntry[]
  /** Cached chat translations carried in the archive (v3+), if any. */
  translations: TranslationRecord[]
  /** Per-(player, character) records (v5+), reconstructed with their
   *  portrait data URL inlined. Empty when reading a v4-or-older
   *  archive. */
  characters: SessionCharacterDraft[]
  /** Tabletop state (v6+), with the background-map image re-inlined as
   *  a data URL from the archive. Null when the archive is older than
   *  v6, when the source room had no tabletop state, or when the
   *  manifest's tabletop section was unrecognisable. */
  tabletop: TabletopState | null
}

function isLogKind(value: unknown): value is LogKind {
  return value === 'roll' || value === 'chat' || value === 'marker'
}

/**
 * Validate one cached-translation record from the manifest. Returns null
 * if any field is missing or has an unexpected value, so a malformed
 * record is dropped rather than seeded into the translation cache. A
 * `backend` tag from an older (v3) archive is simply ignored.
 */
function parseTranslation(raw: unknown): TranslationRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const langOk = (v: unknown): v is TranslationRecord['from'] => v === 'ja' || v === 'en'
  if (typeof r.text !== 'string' || r.text === '') return null
  if (typeof r.translated !== 'string') return null
  if (!langOk(r.from) || !langOk(r.to)) return null
  return { text: r.text, from: r.from, to: r.to, translated: r.translated }
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
 * Validate one per-(player, character) record from the manifest. The
 * archive stores the portrait as a separate file at `imagePath`; this
 * re-inlines it as a base64 data URL so the result matches the live
 * `SessionCharacterDraft` shape. Returns null when the record is too
 * malformed to render.
 */
function parseCharacter(
  raw: unknown,
  files: Record<string, Uint8Array>,
): SessionCharacterDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.playerId !== 'string' || r.playerId === '') return null
  const characterId = typeof r.characterId === 'string' ? r.characterId : ''
  let image = ''
  if (typeof r.imagePath === 'string' && r.imagePath !== '') {
    const bytes = files[r.imagePath]
    if (bytes) {
      const type = typeof r.imageType === 'string' ? r.imageType : 'image/png'
      // Defend against a manifest that names a non-image type at this slot.
      image = type.startsWith('image/') ? bytesToDataUrl(bytes, type) : ''
    }
  }
  return {
    playerId: r.playerId,
    characterId,
    playerName: typeof r.playerName === 'string' ? r.playerName : '',
    characterName: typeof r.characterName === 'string' ? r.characterName : '',
    background: typeof r.background === 'string' ? r.background : '',
    isGM: r.isGM === true,
    image,
  }
}

/**
 * Validate the manifest's `tabletop` section, re-inlining the
 * background-map image from the archive's `attachments/maps/` file.
 * Everything else is normalised through `sanitizeStoredTabletop` so
 * the same defence-in-depth used for IndexedDB-loaded state catches
 * malformed wire data here too. Returns null when the section is
 * absent / unrecognisable so the caller can default to "no tabletop".
 */
/** Re-inline a manifest map record's bytes from the archive, or
 *  undefined when the path / bytes are missing (so the sanitizer drops
 *  it rather than keep an undrawable empty dataUrl). */
function reinlineMap(
  raw: unknown,
  files: Record<string, Uint8Array>,
): MapBackground | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const m = raw as Record<string, unknown>
  const id = typeof m.id === 'string' ? m.id : ''
  const imagePath = typeof m.imagePath === 'string' ? m.imagePath : ''
  if (!id || !imagePath) return undefined
  const bytes = files[imagePath]
  const type = typeof m.imageType === 'string' ? m.imageType : 'image/png'
  if (!bytes || !type.startsWith('image/')) return undefined
  return {
    id,
    name: typeof m.name === 'string' ? m.name : '',
    width: typeof m.width === 'number' ? m.width : 0,
    height: typeof m.height === 'number' ? m.height : 0,
    dataUrl: bytesToDataUrl(bytes, type),
  }
}

function parseTabletop(
  raw: unknown,
  files: Record<string, Uint8Array>,
): TabletopState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  // Re-inline the current map's bytes, and each inactive scene's map.
  const map = reinlineMap(r.map, files)
  let scenes: unknown = r.scenes
  if (Array.isArray(r.scenes)) {
    scenes = r.scenes.map((sc) => {
      if (!sc || typeof sc !== 'object') return sc
      const sceneMap = reinlineMap((sc as Record<string, unknown>).map, files)
      return { ...(sc as Record<string, unknown>), map: sceneMap }
    })
  }
  // Hand the rest to the existing sanitizer. It re-derives texts /
  // strokes / fog / tokens / npcLibrary / scenes defensively, so a
  // v6-or-newer archive that gained fields still round-trips the bits
  // the current code understands.
  return sanitizeStoredTabletop({
    ...r,
    ...(map ? { map } : { map: undefined }),
    ...(scenes !== undefined ? { scenes } : {}),
  })
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
  const rawTranslations = Array.isArray(m.translations) ? m.translations : []
  const translations: TranslationRecord[] = []
  for (const raw of rawTranslations) {
    const tr = parseTranslation(raw)
    if (tr) translations.push(tr)
  }
  const rawCharacters = Array.isArray(m.characters) ? m.characters : []
  const characters: SessionCharacterDraft[] = []
  for (const raw of rawCharacters) {
    const c = parseCharacter(raw, files)
    if (c) characters.push(c)
  }
  const tabletop = parseTabletop(m.tabletop, files)
  return {
    roomCode,
    roomName: typeof room.name === 'string' ? room.name : '',
    entries,
    translations,
    characters,
    tabletop,
  }
}
