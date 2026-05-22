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
    characterId: '',
    hidden: false,
    timestamp: at,
  }
}

function chat(id: string, at: number): ChatMessage {
  return {
    id,
    playerId: 'p1',
    characterId: '',
    text: 'hi',
    timestamp: at,
    lang: 'ja',
    mentions: [],
    mentionsAll: false,
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

  it('de-duplicates entries that appear in both inputs by id', () => {
    // Paged-in older history overlaps the live window — the same entry
    // can arrive from both arrays and must be shown only once.
    const feed = buildFeed(
      [roll('r', 10), roll('r', 10)],
      [chat('c', 20), chat('c', 20)],
      [marker('m', 30), marker('m', 30)],
      'all',
    )
    expect(feed.map((i) => i.id)).toEqual(['r', 'c', 'm'])
  })

  it('returns an empty feed for empty inputs', () => {
    expect(buildFeed([], [], [], 'all')).toEqual([])
  })

  it('folds consecutive identical system markers into one with a count', () => {
    const joins: SystemMarker[] = [
      { id: 'j1', timestamp: 10, type: 'playerJoined', playerName: 'Alice' },
      { id: 'j2', timestamp: 11, type: 'playerJoined', playerName: 'Alice' },
      { id: 'j3', timestamp: 12, type: 'playerJoined', playerName: 'Alice' },
    ]
    const feed = buildFeed([], [], joins, 'all')
    expect(feed).toHaveLength(1)
    expect(feed[0]).toMatchObject({ kind: 'system', count: 3 })
  })

  it('does not fold markers for different players', () => {
    const joins: SystemMarker[] = [
      { id: 'j1', timestamp: 10, type: 'playerJoined', playerName: 'Alice' },
      { id: 'j2', timestamp: 11, type: 'playerJoined', playerName: 'Bob' },
    ]
    const feed = buildFeed([], [], joins, 'all')
    expect(feed).toHaveLength(2)
    expect(feed.every((i) => i.kind === 'system' && i.count === 1)).toBe(true)
  })

  it('does not fold a run broken by a non-system entry', () => {
    const joins: SystemMarker[] = [
      { id: 'j1', timestamp: 10, type: 'playerJoined', playerName: 'Alice' },
      { id: 'j3', timestamp: 30, type: 'playerJoined', playerName: 'Alice' },
    ]
    const feed = buildFeed([], [chat('c', 20)], joins, 'all')
    expect(feed.map((i) => i.kind)).toEqual(['system', 'chat', 'system'])
  })

  it('does not fold a run broken by an entry the filter hides', () => {
    // Two joins with a roll between them. In the chat view the roll is
    // hidden, but the markers were not truly adjacent, so they must not
    // fold into one "(2)" entry.
    const joins: SystemMarker[] = [
      { id: 'j1', timestamp: 10, type: 'playerJoined', playerName: 'Alice' },
      { id: 'j2', timestamp: 30, type: 'playerJoined', playerName: 'Alice' },
    ]
    const feed = buildFeed([roll('r', 20)], [], joins, 'chat')
    expect(feed.map((i) => i.kind)).toEqual(['system', 'system'])
    expect(feed.every((i) => i.kind === 'system' && i.count === 1)).toBe(true)
  })

  it('does not fold a run broken by a chat hidden in the rolls view', () => {
    const joins: SystemMarker[] = [
      { id: 'j1', timestamp: 10, type: 'playerJoined', playerName: 'Alice' },
      { id: 'j2', timestamp: 30, type: 'playerJoined', playerName: 'Alice' },
    ]
    const feed = buildFeed([], [chat('c', 20)], joins, 'rolls')
    expect(feed.map((i) => i.kind)).toEqual(['system', 'system'])
  })

  it('still folds truly adjacent markers in a filtered view', () => {
    // A roll exists, but not between the two joins — the joins are still
    // adjacent, so the fold applies even in the chat view.
    const joins: SystemMarker[] = [
      { id: 'j1', timestamp: 10, type: 'playerJoined', playerName: 'Alice' },
      { id: 'j2', timestamp: 11, type: 'playerJoined', playerName: 'Alice' },
    ]
    const feed = buildFeed([roll('r', 50)], [], joins, 'chat')
    expect(feed).toHaveLength(1)
    expect(feed[0]).toMatchObject({ kind: 'system', count: 2 })
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
