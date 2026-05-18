import { describe, it, expect } from 'vitest'
import { buildIceServers } from './ice'

/** A TURN entry's urls as an array, regardless of how it was provided. */
function urlsOf(server: RTCIceServer): string[] {
  return Array.isArray(server.urls) ? server.urls : [server.urls]
}

describe('buildIceServers', () => {
  it('always includes a STUN server', () => {
    const [stun] = buildIceServers({})
    expect(urlsOf(stun).some((u) => u.startsWith('stun:'))).toBe(true)
  })

  it('falls back to the free Open Relay TURN when no env vars are set', () => {
    const [, turn] = buildIceServers({})
    expect(urlsOf(turn).every((u) => u.startsWith('turn:'))).toBe(true)
    expect(turn.username).toBe('openrelayproject')
  })

  it('uses a custom TURN server from env vars when provided', () => {
    const [, turn] = buildIceServers({
      VITE_TURN_URLS: 'turn:my.host:3478, turns:my.host:443',
      VITE_TURN_USERNAME: 'alice',
      VITE_TURN_CREDENTIAL: 'secret',
    })
    expect(urlsOf(turn)).toEqual(['turn:my.host:3478', 'turns:my.host:443'])
    expect(turn.username).toBe('alice')
    expect(turn.credential).toBe('secret')
  })

  it('ignores a blank VITE_TURN_URLS and keeps the default', () => {
    const [, turn] = buildIceServers({ VITE_TURN_URLS: '   ' })
    expect(turn.username).toBe('openrelayproject')
  })
})
