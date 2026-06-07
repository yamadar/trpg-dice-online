import { describe, it, expect } from 'vitest'
import {
  arrowDelta,
  isEditableTarget,
  selectStepForKey,
  toolForKey,
  zoomActionForKey,
} from './keymap'

describe('toolForKey', () => {
  it('maps digits 1-5 to the five tools in palette order', () => {
    expect(toolForKey('1')).toBe('select')
    expect(toolForKey('2')).toBe('text')
    expect(toolForKey('3')).toBe('pen')
    expect(toolForKey('4')).toBe('eraser')
    expect(toolForKey('5')).toBe('ping')
  })
  it('accepts letter aliases case-insensitively', () => {
    expect(toolForKey('V')).toBe('select')
    expect(toolForKey('t')).toBe('text')
    expect(toolForKey('P')).toBe('pen')
    expect(toolForKey('e')).toBe('eraser')
    expect(toolForKey('G')).toBe('ping')
  })
  it('returns null for unmapped keys', () => {
    expect(toolForKey('9')).toBeNull()
    expect(toolForKey('z')).toBeNull()
    expect(toolForKey('Enter')).toBeNull()
  })
})

describe('arrowDelta', () => {
  it('maps arrows to a world delta (up is -y)', () => {
    expect(arrowDelta('ArrowLeft', 50)).toEqual({ dx: -50, dy: 0 })
    expect(arrowDelta('ArrowRight', 50)).toEqual({ dx: 50, dy: 0 })
    expect(arrowDelta('ArrowUp', 50)).toEqual({ dx: 0, dy: -50 })
    expect(arrowDelta('ArrowDown', 50)).toEqual({ dx: 0, dy: 50 })
  })
  it('scales with the step and ignores non-arrows', () => {
    expect(arrowDelta('ArrowRight', 12)).toEqual({ dx: 12, dy: 0 })
    expect(arrowDelta('a', 50)).toBeNull()
  })
})

describe('zoomActionForKey', () => {
  it('maps +/-/0 (and aliases) to zoom intents', () => {
    expect(zoomActionForKey('+')).toBe('in')
    expect(zoomActionForKey('=')).toBe('in')
    expect(zoomActionForKey('-')).toBe('out')
    expect(zoomActionForKey('_')).toBe('out')
    expect(zoomActionForKey('0')).toBe('reset')
    expect(zoomActionForKey('1')).toBeNull()
  })
})

describe('selectStepForKey', () => {
  it('maps brackets to prev/next', () => {
    expect(selectStepForKey('[')).toBe(-1)
    expect(selectStepForKey(']')).toBe(1)
    expect(selectStepForKey('p')).toBeNull()
  })
})

describe('isEditableTarget', () => {
  it('treats inputs / textareas / selects / contentEditable as editable', () => {
    expect(isEditableTarget('INPUT', false)).toBe(true)
    expect(isEditableTarget('textarea', false)).toBe(true)
    expect(isEditableTarget('SELECT', false)).toBe(true)
    expect(isEditableTarget('DIV', true)).toBe(true)
  })
  it('treats other elements as non-editable', () => {
    expect(isEditableTarget('DIV', false)).toBe(false)
    expect(isEditableTarget('BUTTON', false)).toBe(false)
    expect(isEditableTarget(undefined, false)).toBe(false)
  })
})
