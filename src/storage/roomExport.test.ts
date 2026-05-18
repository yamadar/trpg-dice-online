import { describe, it, expect } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { buildRoomExport, roomExportFilename, type TranslationRecord } from './roomExport'
import type { LogEntry } from './roomLog'
import type { Player } from '../net/protocol'

const players: Player[] = [
  { id: 'p1', name: 'Alice', isGM: true, characterName: 'Mage', background: 'wise', lang: 'ja' },
  { id: 'p2', name: 'Bob', isGM: false, characterName: '', background: '', lang: 'en' },
]

// A data URL whose base64 decodes to the ASCII bytes for "hello".
const HELLO_URL = 'data:image/png;base64,aGVsbG8='

const entries: LogEntry[] = [
  { kind: 'marker', at: 10, data: { id: 'm1', timestamp: 10, type: 'created', roomCode: 'ABC' } },
  { kind: 'roll', at: 20, data: { id: 'r1', timestamp: 20, value: 7 } },
  { kind: 'chat', at: 30, data: { id: 'c1', timestamp: 30, text: 'hi' } },
  {
    kind: 'chat',
    at: 40,
    data: {
      id: 'c2',
      timestamp: 40,
      text: 'pic',
      file: { name: 'pic.png', type: 'image/png', size: 5, dataUrl: HELLO_URL },
    },
  },
]

const translations: TranslationRecord[] = [
  { text: 'hi', from: 'en', to: 'ja', backend: 'mymemory', translated: 'やあ' },
]

function manifestOf(zip: Uint8Array) {
  return JSON.parse(strFromU8(unzipSync(zip)['room.json']))
}

describe('buildRoomExport', () => {
  it('packs a room.json manifest and the attachments into a zip', () => {
    const files = unzipSync(
      buildRoomExport({ code: 'ABC', name: 'Session' }, players, entries, [], 999),
    )
    expect(Object.keys(files).sort()).toEqual(['attachments/c2.png', 'room.json'])
  })

  it('writes a versioned manifest carrying the player roster', () => {
    const manifest = manifestOf(
      buildRoomExport({ code: 'ABC', name: 'Session' }, players, entries, [], 999),
    )
    expect(manifest.type).toBe('trpg-dice-room-log')
    expect(manifest.version).toBe(3)
    expect(manifest.exportedAt).toBe(999)
    expect(manifest.room).toEqual({ code: 'ABC', name: 'Session' })
    expect(manifest.players).toEqual(players)
    expect(manifest.entries.map((e: LogEntry) => e.kind)).toEqual(['marker', 'roll', 'chat', 'chat'])
  })

  it('carries cached chat translations in the manifest', () => {
    const manifest = manifestOf(
      buildRoomExport({ code: 'ABC', name: 'Session' }, players, entries, translations, 999),
    )
    expect(manifest.translations).toEqual(translations)
  })

  it('moves attachment bytes into the archive, leaving a path reference', () => {
    const files = unzipSync(buildRoomExport({ code: 'ABC', name: '' }, players, entries, [], 1))
    const manifest = JSON.parse(strFromU8(files['room.json']))
    const withFile = manifest.entries.find((e: LogEntry) => (e.data as { id: string }).id === 'c2')
    expect(withFile.data.file).toEqual({
      name: 'pic.png',
      type: 'image/png',
      size: 5,
      path: 'attachments/c2.png',
    })
    expect(strFromU8(files['attachments/c2.png'])).toBe('hello')
  })

  it('does not mutate the input entries', () => {
    const before = JSON.parse(JSON.stringify(entries))
    buildRoomExport({ code: 'ABC', name: '' }, players, entries, [], 1)
    expect(entries).toEqual(before)
  })

  it('handles a room with no attachments', () => {
    const files = unzipSync(
      buildRoomExport({ code: 'X', name: '' }, players, entries.slice(0, 3), [], 1),
    )
    expect(Object.keys(files)).toEqual(['room.json'])
  })
})

describe('roomExportFilename', () => {
  it('builds a dated, room-scoped zip name', () => {
    expect(roomExportFilename('ABC123', new Date('2026-05-18T09:00:00Z'))).toBe(
      'room-ABC123-2026-05-18.zip',
    )
  })
})
