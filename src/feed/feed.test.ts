import { describe, it, expect } from 'vitest'
import { buildFeed, isRoomExitMarker, type SystemMarker } from './feed'
import type { RollResult } from '../dice/types'
import type { ChatMessage } from '../net/protocol'

function roll(id: string, at: number): RollResult {
  return {
    id,
    patternName: 'p',
    kind: 'damage',
    diceType: 'D6',
    diceCount: 1,
    faces: [3],
    modifier: 0,
    value: 3,
    playerId: 'p1',
    playerName: 'A',
    characterName: '',
    background: '',
    hidden: false,
    timestamp: at,
  }
}

function chat(id: string, at: number): ChatMessage {
  return {
    id,
    playerId: 'p1',
    playerName: 'A',
    characterName: '',
    background: '',
    text: 'hi',
    timestamp: at,
    lang: 'ja',
  }
}

function chatWithFile(id: string, at: number): ChatMessage {
  return {
    ...chat(id, at),
    file: { name: 'pic.png', type: 'image/png', size: 100, dataUrl: 'data:image/png;base64,AAAA' },
  }
}

function marker(id: string, at: number): SystemMarker {
  return { id, timestamp: at, type: 'joined', roomCode: 'ABC123' }
}

describe('buildFeed', () => {
  it('merges rolls, chat and markers ordered oldest-first', () => {
    const feed = buildFeed([roll('r', 30)], [chat('c', 10)], [marker('m', 20)], 'all')
    expect(feed.map((i) => i.kind)).toEqual(['chat', 'system', 'roll'])
  })

  it('the rolls filter hides chat but keeps rolls and markers', () => {
    const feed = buildFeed([roll('r', 30)], [chat('c', 10)], [marker('m', 20)], 'rolls')
    expect(feed.map((i) => i.kind)).toEqual(['system', 'roll'])
  })

  it('the chat filter hides rolls but keeps chat and markers', () => {
    const feed = buildFeed([roll('r', 30)], [chat('c', 10)], [marker('m', 20)], 'chat')
    expect(feed.map((i) => i.kind)).toEqual(['chat', 'system'])
  })

  it('the files filter keeps only chat messages with an attachment', () => {
    const feed = buildFeed(
      [roll('r', 30)],
      [chat('c', 10), chatWithFile('cf', 15)],
      [marker('m', 20)],
      'files',
    )
    expect(feed.map((i) => i.id)).toEqual(['cf'])
  })

  it('orders deterministically when timestamps tie', () => {
    const a = buildFeed([roll('r2', 5), roll('r1', 5)], [], [], 'all')
    const b = buildFeed([roll('r1', 5), roll('r2', 5)], [], [], 'all')
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id))
  })

  it('returns an empty feed for empty inputs', () => {
    expect(buildFeed([], [], [], 'all')).toEqual([])
  })
})

describe('isRoomExitMarker', () => {
  it('flags the room-exit marker types', () => {
    expect(isRoomExitMarker('youLeft')).toBe(true)
    expect(isRoomExitMarker('youClosed')).toBe(true)
    expect(isRoomExitMarker('gmClosed')).toBe(true)
    expect(isRoomExitMarker('hostLost')).toBe(true)
  })

  it('does not flag entry or player markers', () => {
    expect(isRoomExitMarker('created')).toBe(false)
    expect(isRoomExitMarker('joined')).toBe(false)
    expect(isRoomExitMarker('playerJoined')).toBe(false)
    expect(isRoomExitMarker('playerLeft')).toBe(false)
  })
})
