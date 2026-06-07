import { describe, it, expect } from 'vitest'
import { nextNpcDef } from './npc'
import type { NpcDef } from './types'

const named: NpcDef = { id: 'n1', name: 'Goblin', image: 'old' }
const unnamed: NpcDef = { id: 'n2', name: '', image: '' }

describe('nextNpcDef', () => {
  it('applies an image-only update to a still-UNNAMED entry (the bug fix)', () => {
    // Regression: changing the image before typing the name used to be
    // dropped because the guard required a non-empty name.
    const next = nextNpcDef(unnamed, { image: 'data:image/png;base64,AAA' })
    expect(next).not.toBeNull()
    expect(next!.image).toBe('data:image/png;base64,AAA')
    expect(next!.name).toBe('') // still provisional, named later
  })

  it('applies a note-only update to a still-unnamed entry', () => {
    const next = nextNpcDef(unnamed, { note: 'hidden' })
    expect(next!.note).toBe('hidden')
    expect(next!.name).toBe('')
  })

  it('rejects an explicit attempt to blank an existing name', () => {
    expect(nextNpcDef(named, { name: '   ' })).toBeNull()
    expect(nextNpcDef(named, { name: '' })).toBeNull()
  })

  it('trims and sets a new name', () => {
    expect(nextNpcDef(unnamed, { name: '  Orc  ' })!.name).toBe('Orc')
  })

  it('keeps the existing name when the update omits it', () => {
    const next = nextNpcDef(named, { image: 'new' })
    expect(next!.name).toBe('Goblin')
    expect(next!.image).toBe('new')
  })

  it('clears the note when explicitly set to blank', () => {
    const next = nextNpcDef({ ...named, note: 'x' }, { note: '  ' })
    expect(next).not.toBeNull()
    expect('note' in next!).toBe(false)
  })

  it('leaves unrelated fields untouched on a partial update', () => {
    const next = nextNpcDef({ ...named, note: 'keep' }, { image: 'new' })
    expect(next!.note).toBe('keep')
    expect(next!.id).toBe('n1')
  })
})
