import { describe, it, expect } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { buildRoomExport, type TranslationRecord } from './roomExport'
import { parseRoomImport } from './roomImport'
import type { LogEntry } from './roomLog'
import type { Player } from '../net/protocol'

const players: Player[] = [
  { id: 'p1', name: 'Alice', isGM: true, characterName: 'Mage', background: 'wise', lang: 'ja' },
]

// A data URL whose base64 decodes to the ASCII bytes for "hello".
const HELLO_URL = 'data:image/png;base64,aGVsbG8='

const entries: LogEntry[] = [
  { kind: 'marker', at: 10, data: { id: 'm1', timestamp: 10, type: 'created', roomCode: 'ABCDEF' } },
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

const translations: TranslationRecord[] = [{ text: 'hi', from: 'en', to: 'ja', translated: 'やあ' }]

/** Parse and assert success, so tests work with a non-null result. */
function parsed(zip: Uint8Array) {
  const result = parseRoomImport(zip)
  if (!result) throw new Error('expected a valid room import')
  return result
}

describe('parseRoomImport', () => {
  it('round-trips a built export back to its room and entries', () => {
    const result = parsed(
      buildRoomExport({ code: 'ABCDEF', name: 'Session' }, players, entries, [], 1),
    )
    expect(result.roomCode).toBe('ABCDEF')
    expect(result.roomName).toBe('Session')
    expect(result.entries.map((e) => e.kind)).toEqual(['marker', 'roll', 'chat', 'chat'])
    expect(result.translations).toEqual([])
  })

  it('re-inlines a chat attachment from the archive as its original data URL', () => {
    const result = parsed(buildRoomExport({ code: 'ABCDEF', name: '' }, players, entries, [], 1))
    const chat = result.entries.find((e) => (e.data as { id: string }).id === 'c2')
    const file = (chat?.data as { file: { dataUrl?: string; path?: string } }).file
    expect(file.dataUrl).toBe(HELLO_URL)
    expect(file.path).toBeUndefined()
  })

  it('round-trips cached chat translations', () => {
    const result = parsed(
      buildRoomExport({ code: 'ABCDEF', name: '' }, players, entries, translations, 1),
    )
    expect(result.translations).toEqual(translations)
  })

  it('drops malformed translation records', () => {
    const manifest = {
      type: 'trpg-dice-room-log',
      version: 4,
      room: { code: 'ABCDEF', name: '' },
      entries: [],
      translations: [
        { text: 'ok', from: 'en', to: 'ja', translated: 'よし' },
        { text: 'bad-lang', from: 'fr', to: 'ja', translated: 'x' },
        { text: 'no-translated', from: 'en', to: 'ja' },
        { text: '', from: 'en', to: 'ja', translated: 'x' },
        { from: 'en', to: 'ja', translated: 'x' },
      ],
    }
    const zip = zipSync({ 'room.json': strToU8(JSON.stringify(manifest)) })
    expect(parsed(zip).translations).toEqual([{ text: 'ok', from: 'en', to: 'ja', translated: 'よし' }])
  })

  it('imports an older v3 archive, ignoring the per-record backend tag', () => {
    const manifest = {
      type: 'trpg-dice-room-log',
      version: 3,
      room: { code: 'ABCDEF', name: '' },
      entries: [],
      translations: [{ text: 'hi', from: 'en', to: 'ja', backend: 'mymemory', translated: 'やあ' }],
    }
    const zip = zipSync({ 'room.json': strToU8(JSON.stringify(manifest)) })
    expect(parsed(zip).translations).toEqual([{ text: 'hi', from: 'en', to: 'ja', translated: 'やあ' }])
  })

  it('treats an older export without translations as having none', () => {
    const manifest = {
      type: 'trpg-dice-room-log',
      version: 2,
      room: { code: 'ABCDEF', name: '' },
      entries: [],
    }
    const zip = zipSync({ 'room.json': strToU8(JSON.stringify(manifest)) })
    expect(parsed(zip).translations).toEqual([])
  })

  it('returns null for bytes that are not a zip', () => {
    expect(parseRoomImport(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })

  it('returns null for a zip without a room manifest', () => {
    expect(parseRoomImport(zipSync({ 'other.txt': strToU8('hi') }))).toBeNull()
  })

  it('returns null when the manifest type does not match', () => {
    const bad = zipSync({ 'room.json': strToU8(JSON.stringify({ type: 'something-else' })) })
    expect(parseRoomImport(bad)).toBeNull()
  })
})
