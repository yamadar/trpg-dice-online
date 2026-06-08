import { describe, it, expect } from 'vitest'
import { getTrapFocusTarget } from './useDialogFocus'

// `getTrapFocusTarget` is the pure heart of the focus trap. It is
// generic over the element type, so these tests stand in plain string
// tokens for DOM nodes — no jsdom needed (Vitest runs in `node`).
// Convention: it returns the element focus should WRAP to, or `null`
// when the browser's default Tab walk already keeps focus in the dialog.
const FOCUSABLES = ['first', 'mid', 'last'] as const

describe('getTrapFocusTarget — forward Tab', () => {
  it('wraps from the last element to the first', () => {
    expect(getTrapFocusTarget(FOCUSABLES, 'last', false)).toBe('first')
  })

  it('lets the browser advance from a middle element', () => {
    expect(getTrapFocusTarget(FOCUSABLES, 'mid', false)).toBeNull()
  })

  it('lets the browser advance from the first element', () => {
    expect(getTrapFocusTarget(FOCUSABLES, 'first', false)).toBeNull()
  })
})

describe('getTrapFocusTarget — backward (Shift+Tab)', () => {
  it('wraps from the first element to the last', () => {
    expect(getTrapFocusTarget(FOCUSABLES, 'first', true)).toBe('last')
  })

  it('lets the browser retreat from a middle element', () => {
    expect(getTrapFocusTarget(FOCUSABLES, 'mid', true)).toBeNull()
  })

  it('lets the browser retreat from the last element', () => {
    expect(getTrapFocusTarget(FOCUSABLES, 'last', true)).toBeNull()
  })
})

describe('getTrapFocusTarget — focus outside the known focusables', () => {
  // Happens right after open when the dialog container itself (with
  // tabindex="-1", so excluded from FOCUSABLES) holds focus, or if a
  // stray click pushed focus elsewhere. Either way the next Tab must be
  // pulled back to a real control inside the dialog.
  it('forward Tab lands on the first element', () => {
    expect(getTrapFocusTarget(FOCUSABLES, 'container', false)).toBe('first')
  })

  it('Shift+Tab lands on the last element', () => {
    expect(getTrapFocusTarget(FOCUSABLES, 'container', true)).toBe('last')
  })

  it('treats a null active element as outside', () => {
    expect(getTrapFocusTarget(FOCUSABLES, null, false)).toBe('first')
    expect(getTrapFocusTarget(FOCUSABLES, null, true)).toBe('last')
  })
})

describe('getTrapFocusTarget — single focusable element', () => {
  // first === last, so both directions must keep focus pinned to it
  // (preventing the browser from tabbing out of a one-control dialog).
  const ONE = ['only'] as const

  it('pins forward Tab to the sole element', () => {
    expect(getTrapFocusTarget(ONE, 'only', false)).toBe('only')
  })

  it('pins Shift+Tab to the sole element', () => {
    expect(getTrapFocusTarget(ONE, 'only', true)).toBe('only')
  })

  it('pulls outside focus onto the sole element either way', () => {
    expect(getTrapFocusTarget(ONE, 'elsewhere', false)).toBe('only')
    expect(getTrapFocusTarget(ONE, 'elsewhere', true)).toBe('only')
  })
})

describe('getTrapFocusTarget — empty dialog', () => {
  // No focusable controls: nothing to trap, so the hook leaves focus on
  // the container and never calls preventDefault.
  it('returns null in both directions', () => {
    expect(getTrapFocusTarget([], 'x', false)).toBeNull()
    expect(getTrapFocusTarget([], null, true)).toBeNull()
  })
})

describe('getTrapFocusTarget — two elements', () => {
  // Edge of the "middle" logic: every element is either first or last.
  const TWO = ['a', 'b'] as const

  it('forward Tab wraps last→first and advances first→(browser)', () => {
    expect(getTrapFocusTarget(TWO, 'b', false)).toBe('a')
    expect(getTrapFocusTarget(TWO, 'a', false)).toBeNull()
  })

  it('Shift+Tab wraps first→last and retreats last→(browser)', () => {
    expect(getTrapFocusTarget(TWO, 'a', true)).toBe('b')
    expect(getTrapFocusTarget(TWO, 'b', true)).toBeNull()
  })
})
