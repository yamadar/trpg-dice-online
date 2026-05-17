import { describe, it, expect } from 'vitest'
import { composeName } from './identity'

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
