/**
 * Pure keyboard-shortcut mapping for the tabletop.
 *
 * `TablePanel` owns the actual keydown listener (it needs the live
 * selection, camera and session actions); this module just maps a key to
 * an intent so the mapping can be unit-tested and kept in one place. It
 * deliberately knows nothing about React or Konva.
 */

/** Tools reachable from the keyboard — a subset of `TableTool`. Kept as
 *  its own union so this module does not import from `components/`; the
 *  literals are assignable to `TableTool`. */
export type KeyTool = 'select' | 'text' | 'pen' | 'eraser' | 'ping'

/**
 * Map a keydown `key` to a tool, or null. Digits 1–5 cover all five
 * tools in palette order; the obvious letters are aliases. Case
 * insensitive.
 */
export function toolForKey(key: string): KeyTool | null {
  switch (key.toLowerCase()) {
    case '1':
    case 'v':
      return 'select'
    case '2':
    case 't':
      return 'text'
    case '3':
    case 'p':
      return 'pen'
    case '4':
    case 'e':
      return 'eraser'
    case '5':
    case 'g':
      return 'ping'
    default:
      return null
  }
}

/**
 * World-space delta for an arrow key, moving `step` pixels per press, or
 * null for a non-arrow key. Up is negative-y (screen convention).
 */
export function arrowDelta(
  key: string,
  step: number,
): { dx: number; dy: number } | null {
  switch (key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 }
    case 'ArrowRight':
      return { dx: step, dy: 0 }
    case 'ArrowUp':
      return { dx: 0, dy: -step }
    case 'ArrowDown':
      return { dx: 0, dy: step }
    default:
      return null
  }
}

export type ZoomAction = 'in' | 'out' | 'reset'

/** Map a key to a zoom intent (`+` / `-` / `0`), or null. */
export function zoomActionForKey(key: string): ZoomAction | null {
  switch (key) {
    case '+':
    case '=':
      return 'in'
    case '-':
    case '_':
      return 'out'
    case '0':
      return 'reset'
    default:
      return null
  }
}

export type SelectStep = -1 | 1

/** Map `[` / `]` to a select-previous / select-next intent, or null. */
export function selectStepForKey(key: string): SelectStep | null {
  if (key === '[') return -1
  if (key === ']') return 1
  return null
}

/**
 * Whether keyboard focus is in a field where typing should take
 * precedence over tabletop shortcuts (so pressing "t" in a note types a
 * "t" instead of switching to the text tool). The caller passes the
 * active element's tag name and contentEditable flag so this stays pure.
 */
export function isEditableTarget(
  tagName: string | undefined,
  isContentEditable: boolean,
): boolean {
  if (isContentEditable) return true
  if (!tagName) return false
  const t = tagName.toUpperCase()
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT'
}
