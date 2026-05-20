import { describe, it, expect } from 'vitest'
import { pickReusableSessionId, type SessionRecord } from './roomLog'

const session = (over: Partial<SessionRecord>): SessionRecord => ({
  sessionId: 's1',
  code: 'ABCD',
  name: '',
  role: 'host',
  firstAt: 0,
  lastAt: 0,
  ...over,
})

describe('pickReusableSessionId', () => {
  it('returns null when no records exist', () => {
    expect(pickReusableSessionId([], 'ABCD', 'host')).toBeNull()
  })

  it('returns null when the code is empty', () => {
    expect(pickReusableSessionId([session({})], '', 'host')).toBeNull()
  })

  it('returns the matching session id when code and role line up', () => {
    const records = [session({ sessionId: 's-host', code: 'ABCD', role: 'host', lastAt: 10 })]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBe('s-host')
  })

  it('ignores sessions tagged as closed', () => {
    const records = [
      session({ sessionId: 's-old', code: 'ABCD', role: 'host', lastAt: 10, closed: true }),
    ]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBeNull()
  })

  it('ignores sessions for a different room code', () => {
    const records = [session({ sessionId: 's-other', code: 'WXYZ', role: 'host', lastAt: 10 })]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBeNull()
  })

  it('ignores sessions for the other role', () => {
    const records = [session({ sessionId: 's-client', code: 'ABCD', role: 'client', lastAt: 10 })]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBeNull()
  })

  it('picks the most recently active candidate', () => {
    const records = [
      session({ sessionId: 's-older', code: 'ABCD', role: 'host', lastAt: 100 }),
      session({ sessionId: 's-newer', code: 'ABCD', role: 'host', lastAt: 500 }),
      session({ sessionId: 's-mid', code: 'ABCD', role: 'host', lastAt: 300 }),
    ]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBe('s-newer')
  })

  it('skips a closed candidate even when it is the most recent', () => {
    const records = [
      session({ sessionId: 's-old-open', code: 'ABCD', role: 'host', lastAt: 100 }),
      session({
        sessionId: 's-new-closed',
        code: 'ABCD',
        role: 'host',
        lastAt: 500,
        closed: true,
      }),
    ]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBe('s-old-open')
  })

  it('does not cross host and client roles for the same code', () => {
    const records = [
      session({ sessionId: 's-host', code: 'ABCD', role: 'host', lastAt: 10 }),
      session({ sessionId: 's-client', code: 'ABCD', role: 'client', lastAt: 20 }),
    ]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBe('s-host')
    expect(pickReusableSessionId(records, 'ABCD', 'client')).toBe('s-client')
  })
})
