import { describe, it, expect } from 'vitest'
import { applyMention, mentionQuery, resolveMentions } from './mentions'

const players = [
  { id: 'u1', name: 'Alice' },
  { id: 'u2', name: 'Bob' },
  { id: 'u3', name: 'Bob' }, // a duplicate name
  { id: 'u4', name: '' }, // anonymous — not mentionable
]

describe('resolveMentions', () => {
  it('resolves a name mention to the player id', () => {
    expect(resolveMentions('hi @Alice', players).ids).toEqual(['u1'])
  })

  it('matches every player sharing a mentioned name', () => {
    expect(resolveMentions('@Bob look', players).ids.sort()).toEqual(['u2', 'u3'])
  })

  it('finds no mention when there is none', () => {
    const r = resolveMentions('just talking', players)
    expect(r.ids).toEqual([])
    expect(r.all).toBe(false)
  })

  it('flags @all and @ALL regardless of case', () => {
    expect(resolveMentions('listen @all', players).all).toBe(true)
    expect(resolveMentions('@ALL now', players).all).toBe(true)
  })

  it('does not flag @all when glued to more letters', () => {
    expect(resolveMentions('@alliance meeting', players).all).toBe(false)
  })
})

describe('mentionQuery', () => {
  it('detects an @token the caret sits in', () => {
    const text = 'hi @Al'
    expect(mentionQuery(text, text.length)).toEqual({ query: 'Al', start: 3 })
  })

  it('detects a bare @ with an empty query', () => {
    expect(mentionQuery('say @', 5)).toEqual({ query: '', start: 4 })
  })

  it('returns null when the caret is not in an @token', () => {
    expect(mentionQuery('plain text', 10)).toBeNull()
    expect(mentionQuery('mail@host typed', 9)).toBeNull() // @ not after whitespace
  })
})

describe('applyMention', () => {
  it('replaces the in-progress token with @label and a trailing space', () => {
    const result = applyMention('hi @Al', 3, 'Al', 'Alice')
    expect(result.text).toBe('hi @Alice ')
    expect(result.cursor).toBe(result.text.length)
  })

  it('keeps text that follows the token', () => {
    const result = applyMention('@Bo there', 0, 'Bo', 'Bob')
    expect(result.text).toBe('@Bob  there')
  })
})
