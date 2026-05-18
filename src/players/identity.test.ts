import { describe, it, expect } from 'vitest'
import { composeName, feedName } from './identity'

describe('composeName', () => {
  it('returns the player name when there is no character', () => {
    expect(composeName('Alice')).toBe('Alice')
    expect(composeName('Alice', '')).toBe('Alice')
    expect(composeName('Alice', '   ')).toBe('Alice')
  })

  it('wraps the player name in parentheses after the character name', () => {
    expect(composeName('Alice', 'Garon')).toBe('Garon（Alice）')
  })

  it('trims surrounding whitespace from both names', () => {
    expect(composeName('  Alice  ', '  Garon  ')).toBe('Garon（Alice）')
  })

  it('shows just the character name when the player name is empty', () => {
    expect(composeName('', 'Garon')).toBe('Garon')
    expect(composeName('   ', 'Garon')).toBe('Garon')
    expect(composeName('', '')).toBe('')
  })
})

describe('feedName', () => {
  it('keeps the full composed name when not compact', () => {
    expect(feedName('Garon（Alice）', 'Garon', false)).toBe('Garon（Alice）')
  })

  it('drops the player half, leaving the character, when compact', () => {
    expect(feedName('Garon（Alice）', 'Garon', true)).toBe('Garon')
  })

  it('keeps the plain player name when there is no character', () => {
    expect(feedName('Alice', '', false)).toBe('Alice')
    expect(feedName('Alice', '', true)).toBe('Alice')
    expect(feedName('Alice', '   ', true)).toBe('Alice')
  })
})
