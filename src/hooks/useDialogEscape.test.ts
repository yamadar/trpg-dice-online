import { describe, it, expect } from 'vitest'
import { shouldYieldEscape } from './useDialogEscape'

// `shouldYieldEscape` decides whether an ancestor dialog's Escape handler
// must step aside for a nested one. It needs only `contains`, so these
// tests model the DOM with tiny parent-chained stand-ins — no jsdom (Vitest
// runs in `node`). `contains` mirrors the DOM: a node contains itself and
// every descendant.
interface FakeNode {
  parent: FakeNode | null
  contains(other: FakeNode): boolean
}
function node(parent: FakeNode | null = null): FakeNode {
  const self: FakeNode = {
    parent,
    contains(other) {
      for (let cur: FakeNode | null = other; cur; cur = cur.parent) {
        if (cur === self) return true
      }
      return false
    },
  }
  return self
}

describe('shouldYieldEscape', () => {
  it('yields when a nested dialog owns the focus', () => {
    const outer = node()
    const inner = node(outer)
    // A Lightbox / crop dialog opened inside a token character modal.
    expect(shouldYieldEscape(outer, inner)).toBe(true)
  })

  it('does not yield to itself (this dialog owns the focus)', () => {
    const dialog = node()
    expect(shouldYieldEscape(dialog, dialog)).toBe(false)
  })

  it('does not yield to a sibling / unrelated dialog', () => {
    const a = node()
    const b = node() // e.g. MapGalleryDialog's card vs its sibling Lightbox preview
    expect(shouldYieldEscape(a, b)).toBe(false)
  })

  it('yields across deeper nesting (a grandchild owns the focus)', () => {
    const outer = node()
    const mid = node(outer)
    const inner = node(mid)
    expect(shouldYieldEscape(outer, inner)).toBe(true)
  })

  it('does not yield when no dialog owns the focus', () => {
    expect(shouldYieldEscape(node(), null)).toBe(false)
  })

  it('never yields without a container, so the handler acts', () => {
    expect(shouldYieldEscape(null, node())).toBe(false)
  })
})
