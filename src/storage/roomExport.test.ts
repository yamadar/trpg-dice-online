import { describe, it, expect } from 'vitest'
import { exportRoomLogJSON, roomLogFilename } from './roomExport'
import type { LogEntry } from './roomLog'

const entries: LogEntry[] = [
  { kind: 'marker', at: 10, data: { id: 'm1', timestamp: 10, type: 'created', roomCode: 'ABC123' } },
  { kind: 'roll', at: 20, data: { id: 'r1', timestamp: 20, value: 7 } },
  { kind: 'chat', at: 30, data: { id: 'c1', timestamp: 30, text: 'hi' } },
]

describe('exportRoomLogJSON', () => {
  it('produces a versioned, self-describing payload', () => {
    const parsed = JSON.parse(exportRoomLogJSON({ code: 'ABC123', name: 'Session 1' }, entries, 999))
    expect(parsed.type).toBe('trpg-dice-room-log')
    expect(parsed.version).toBe(1)
    expect(parsed.exportedAt).toBe(999)
    expect(parsed.room).toEqual({ code: 'ABC123', name: 'Session 1' })
  })

  it('keeps every entry in order with its kind and payload', () => {
    const parsed = JSON.parse(exportRoomLogJSON({ code: 'ABC123', name: '' }, entries, 1))
    expect(parsed.entries.map((e: LogEntry) => e.kind)).toEqual(['marker', 'roll', 'chat'])
    expect(parsed.entries[2].data.text).toBe('hi')
  })

  it('handles an empty log', () => {
    const parsed = JSON.parse(exportRoomLogJSON({ code: 'X', name: '' }, [], 1))
    expect(parsed.entries).toEqual([])
  })
})

describe('roomLogFilename', () => {
  it('builds a dated, room-scoped json name', () => {
    expect(roomLogFilename('ABC123', new Date('2026-05-18T09:00:00Z'))).toBe(
      'room-ABC123-2026-05-18.json',
    )
  })
})
