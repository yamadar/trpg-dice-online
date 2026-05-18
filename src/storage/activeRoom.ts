/**
 * A per-tab pointer to the room this tab is currently in, kept in
 * sessionStorage so it survives a reload but not a tab close or a fresh
 * tab. On reload it lets the app re-host (GM) or re-join (player) the
 * same room instead of waiting for a manual action.
 */

const KEY = 'trpg-dice.activeRoom'

export interface ActiveRoom {
  code: string
  role: 'host' | 'client'
}

/** The room this tab was in before a reload, or null. */
export function loadActiveRoom(): ActiveRoom | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<ActiveRoom>
    if (typeof value.code === 'string' && (value.role === 'host' || value.role === 'client')) {
      return { code: value.code, role: value.role }
    }
  } catch {
    /* sessionStorage unavailable or malformed */
  }
  return null
}

export function saveActiveRoom(room: ActiveRoom): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(room))
  } catch {
    /* ignore */
  }
}

export function clearActiveRoom(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
