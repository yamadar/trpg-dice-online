/**
 * Package a room's full durable history into a downloadable ZIP archive.
 *
 * The archive holds a `room.json` manifest — room identity, the player
 * roster, every roll / chat / marker (each with the player and
 * character snapshot it was created with), and the per-(player,
 * character) records (name / background / isGM / portrait) needed to
 * render past entries — plus an `attachments/` folder with the binary
 * content of every chat attachment and character portrait. Storing
 * binaries as real files keeps base64 out of the JSON and lets the
 * archive compress them. The manifest is versioned and typed so a
 * future importer can restore the whole room from the one file.
 */

import { strToU8, zipSync } from 'fflate'
import type { LogEntry, SessionCharacterRecord } from './roomLog'
import type { ChatMessage, Player } from '../net/protocol'
import type { Lang } from '../i18n/translations'
import type {
  DrawStroke,
  FogState,
  Grid,
  MapText,
  NpcDef,
  TabletopState,
  Token,
} from '../tabletop/types'

/** Marks our room-export archives. */
const FILE_TYPE = 'trpg-dice-room-log'
/** v6: tabletop state (map + grid + tokens + NPC library + annotation
 *  layers: texts / strokes / fog of war) rides along with the archive.
 *  Map image bytes are extracted to `attachments/maps/` alongside
 *  chat attachments; the rest of the state stays inline in the
 *  manifest.
 *
 *  v5: per-(player, character) records (name / background / isGM /
 *  portrait) ride along so room history can render past entries
 *  without the live session. */
const FILE_VERSION = 6

/** Room identity stored in the manifest. */
interface ExportRoom {
  code: string
  name: string
}

/**
 * A cached chat translation carried in the export so a re-import shows
 * the same translations without re-translating. `text` with `from` /
 * `to` is the translation cache key.
 */
export interface TranslationRecord {
  text: string
  from: Lang
  to: Lang
  translated: string
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

/**
 * One per-(player, character) record as it appears in the manifest. The
 * portrait, when present, is stored as a file at `imagePath` and re-inlined
 * to a data URL on import — same trick as chat attachments.
 */
export interface ExportCharacter {
  playerId: string
  characterId: string
  playerName: string
  characterName: string
  background: string
  isGM: boolean
  /** Path in the archive of the portrait image; absent when there is no
   *  portrait or the data URL could not be decoded. */
  imagePath?: string
  imageType?: string
  updatedAt: number
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

/** A filesystem-safe extension for a portrait, from its image data URL
 *  type fragment (`image/png` → `png`). */
function imageExt(type: string): string {
  const slash = type.lastIndexOf('/')
  const ext = slash >= 0 ? type.slice(slash + 1).toLowerCase() : ''
  // Strip a `+xml` etc. suffix and fall back to a generic byte ext if
  // the type is missing or unknown.
  return ext.replace(/\+.*$/, '') || 'bin'
}

/** Parse a `data:<type>;base64,<data>` URL into (type, bytes). Returns
 *  null for any other shape — the caller drops the portrait rather
 *  than embed an unrecognised URL. */
function parseImageDataUrl(
  dataUrl: string,
): { type: string; bytes: Uint8Array } | null {
  if (!dataUrl.startsWith('data:')) return null
  const semi = dataUrl.indexOf(';')
  const comma = dataUrl.indexOf(',', semi)
  if (semi < 0 || comma < 0) return null
  const type = dataUrl.slice(5, semi)
  if (!type.startsWith('image/')) return null
  // The implementation accepts `;base64,` only — any other encoding
  // (rare for `image/*`) is dropped rather than guessed.
  const enc = dataUrl.slice(semi + 1, comma)
  if (enc !== 'base64') return null
  return { type, bytes: dataUrlToBytes(dataUrl) }
}

/** Sanitise the characterId for use as a filesystem path component.
 *  The id is either a generated `chr-...` slug (see `newCharacterId`),
 *  a synthesised `@n:<encoded name>`, or empty — `encodeURIComponent`
 *  turns any of them into a path-safe form. */
function safeCharacterIdPath(characterId: string): string {
  return encodeURIComponent(characterId)
}

/**
 * Split each character's portrait out of the records: each becomes a
 * file in the archive, and its record is rewritten to reference that
 * path. The input is cloned where changed, never mutated.
 */
function extractCharacters(records: ReadonlyArray<SessionCharacterRecord>): {
  characters: ExportCharacter[]
  files: Record<string, Uint8Array>
} {
  const files: Record<string, Uint8Array> = {}
  const characters: ExportCharacter[] = []
  for (const r of records) {
    const exported: ExportCharacter = {
      playerId: r.playerId,
      characterId: r.characterId,
      playerName: r.playerName,
      characterName: r.characterName,
      background: r.background,
      isGM: r.isGM,
      updatedAt: r.updatedAt,
    }
    if (r.image) {
      const parsed = parseImageDataUrl(r.image)
      if (parsed) {
        const path = `attachments/portraits/${safeCharacterIdPath(r.playerId)}-${safeCharacterIdPath(r.characterId)}.${imageExt(parsed.type)}`
        files[path] = parsed.bytes
        exported.imagePath = path
        exported.imageType = parsed.type
      }
    }
    characters.push(exported)
  }
  return { characters, files }
}

/**
 * The map background as it lives in the manifest. The image bytes are
 * extracted to `attachments/maps/{id}.{ext}` (like chat attachments) and
 * re-inlined on import. `imagePath` is absent when the source map had
 * no usable data URL — the importer drops the map in that case rather
 * than restore a broken record.
 */
export interface ExportTabletopMap {
  id: string
  name: string
  width: number
  height: number
  imagePath?: string
  imageType?: string
}

/**
 * Tabletop state as it appears in the manifest. The shape mirrors
 * `TabletopState` except the map's `dataUrl` is replaced by an
 * `imagePath` / `imageType` pair pointing at a file in the archive.
 * NPC and GM-token images stay inline because they are already capped
 * at ~200 KB by the upload pipeline; only the multi-megabyte map
 * background is worth splitting out.
 */
export interface ExportTabletop {
  map?: ExportTabletopMap
  grid: Grid
  tokens: Token[]
  npcLibrary: NpcDef[]
  pcSpawn?: { x: number; y: number }
  texts: MapText[]
  strokes: DrawStroke[]
  fog: FogState
}

/**
 * Split the tabletop's background-map image out of the manifest into a
 * separate archive file (mirroring `extractAttachments` for chat
 * files). The remaining fields are forwarded verbatim. When the source
 * map has no parseable data URL (e.g., it was somehow cleared mid-way
 * through a sync) the export drops the map entirely instead of writing
 * a record that points at a missing path.
 */
function extractTabletop(state: TabletopState): {
  tabletop: ExportTabletop
  files: Record<string, Uint8Array>
} {
  const files: Record<string, Uint8Array> = {}
  let map: ExportTabletopMap | undefined
  if (state.map) {
    const parsed = state.map.dataUrl
      ? parseImageDataUrl(state.map.dataUrl)
      : null
    if (parsed) {
      const path = `attachments/maps/${encodeURIComponent(state.map.id)}.${imageExt(parsed.type)}`
      files[path] = parsed.bytes
      map = {
        id: state.map.id,
        name: state.map.name,
        width: state.map.width,
        height: state.map.height,
        imagePath: path,
        imageType: parsed.type,
      }
    }
  }
  return {
    tabletop: {
      ...(map ? { map } : {}),
      grid: state.grid,
      tokens: state.tokens,
      npcLibrary: state.npcLibrary,
      ...(state.pcSpawn ? { pcSpawn: state.pcSpawn } : {}),
      texts: state.texts,
      strokes: state.strokes,
      fog: state.fog,
    },
    files,
  }
}

/**
 * Build the ZIP archive bytes for a room export. `entries` is the
 * durable log oldest-first; `characters` is the per-(player,
 * character) record set (with portraits); `tabletop` is the optional
 * shared map state (map + grid + tokens + annotation layers);
 * `exportedAt` is injectable so the manifest is deterministic in
 * tests.
 */
export function buildRoomExport(
  room: ExportRoom,
  players: Player[],
  entries: LogEntry[],
  translations: TranslationRecord[],
  characters: ReadonlyArray<SessionCharacterRecord> = [],
  exportedAt: number = Date.now(),
  tabletop: TabletopState | null = null,
): Uint8Array<ArrayBuffer> {
  const splitEntries = extractAttachments(entries)
  const splitCharacters = extractCharacters(characters)
  const splitTabletop = tabletop ? extractTabletop(tabletop) : null
  const manifest = {
    type: FILE_TYPE,
    version: FILE_VERSION,
    exportedAt,
    room,
    players,
    entries: splitEntries.entries,
    translations,
    characters: splitCharacters.characters,
    ...(splitTabletop ? { tabletop: splitTabletop.tabletop } : {}),
  }
  const zip = zipSync({
    'room.json': strToU8(JSON.stringify(manifest, null, 2)),
    ...splitEntries.files,
    ...splitCharacters.files,
    ...(splitTabletop?.files ?? {}),
  })
  // fflate types its output buffer loosely; it is always a plain
  // ArrayBuffer, which a Blob download needs.
  return zip as Uint8Array<ArrayBuffer>
}

/** A dated, room-scoped archive name, e.g. `room-ABC123-2026-05-18.zip`. */
export function roomExportFilename(roomCode: string, date: Date = new Date()): string {
  return `room-${roomCode}-${date.toISOString().slice(0, 10)}.zip`
}
