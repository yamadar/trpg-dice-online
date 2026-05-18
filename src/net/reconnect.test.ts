import { describe, it, expect } from 'vitest'
import { MAX_RECONNECT_ATTEMPTS, reconnectDelay } from './reconnect'

describe('reconnectDelay', () => {
  it('grows with the attempt number', () => {
    expect(reconnectDelay(1)).toBe(2000)
    expect(reconnectDelay(2)).toBe(3000)
    expect(reconnectDelay(3)).toBe(4000)
  })

  it('caps the backoff so it never exceeds 5s', () => {
    expect(reconnectDelay(10)).toBe(5000)
    expect(reconnectDelay(100)).toBe(5000)
  })

  it('treats a non-positive attempt as the minimum delay', () => {
    expect(reconnectDelay(0)).toBe(1000)
    expect(reconnectDelay(-5)).toBe(1000)
  })
})

describe('MAX_RECONNECT_ATTEMPTS', () => {
  it('allows persistent retrying before giving up', () => {
    expect(MAX_RECONNECT_ATTEMPTS).toBeGreaterThanOrEqual(10)
    expect(MAX_RECONNECT_ATTEMPTS).toBeLessThanOrEqual(60)
  })
})
