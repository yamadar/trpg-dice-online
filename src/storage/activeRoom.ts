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
  /** Durable-log session id, so a resumed room keeps one continuous log.
   *  Absent only for a pointer written before the session-id change. */
  sessionId?: string
  /** The room name, so a reload can restore it before any sync arrives —
   *  the GM otherwise has no peer to receive it back from. */
  roomName?: string
}

/** The room this tab was in before a reload, or null. */
export function loadActiveRoom(): ActiveRoom | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<ActiveRoom>
    if (typeof value.code === 'string' && (value.role === 'host' || value.role === 'client')) {
      return {
        code: value.code,
        role: value.role,
        ...(typeof value.sessionId === 'string' ? { sessionId: value.sessionId } : {}),
        ...(typeof value.roomName === 'string' ? { roomName: value.roomName } : {}),
      }
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

/** Patch just the room name on the stored pointer (a no-op when none). */
export function updateActiveRoomName(roomName: string): void {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return
    const value = JSON.parse(raw) as ActiveRoom
    sessionStorage.setItem(KEY, JSON.stringify({ ...value, roomName }))
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
