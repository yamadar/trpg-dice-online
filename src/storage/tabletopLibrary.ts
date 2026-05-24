/**
 * GM-curated library of named tabletops (templates + saves).
 *
 * Stored globally in IndexedDB (`tabletopLibrary` store, DB v8+) — not
 * per-session — so a GM can prepare scenes ahead of time and load
 * them into any room. Two flavours coexist in the same store, keyed
 * apart by `kind`:
 *
 *   - 'template': initial layout (no PC tokens, optional `pcSpawn`).
 *     Loading resets the table while keeping the room's PCs alive
 *     (caller re-places them at the spawn point).
 *   - 'save':     mid-session snapshot (full state). Loading restores
 *     everything including token positions.
 *
 * All calls degrade gracefully (resolve to a no-op / empty list / null)
 * when IndexedDB is unavailable, so the app keeps working without the
 * library.
 */

import { openRoomDb } from './roomLog'
import type { SavedTabletop } from '../tabletop/types'

const STORE = 'tabletopLibrary'

/** Insert or replace one library entry. Resolves once the transaction
 *  commits (or gives up). */
export async function saveLibraryEntry(entry: SavedTabletop): Promise<void> {
  const db = await openRoomDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * List every library entry, most-recently-updated first. The result is
 * always an array — IndexedDB unavailability becomes an empty list.
 */
export async function listLibrary(): Promise<SavedTabletop[]> {
  const db = await openRoomDb()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => {
        const records = (req.result as SavedTabletop[]) ?? []
        records.sort((a, b) => b.updatedAt - a.updatedAt)
        resolve(records)
      }
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/** Fetch one entry by id, or null when missing / unavailable. */
export async function getLibraryEntry(
  id: string,
): Promise<SavedTabletop | null> {
  if (!id) return null
  const db = await openRoomDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => resolve((req.result as SavedTabletop) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Drop one entry by id. Idempotent; an unknown id is a no-op. */
export async function deleteLibraryEntry(id: string): Promise<void> {
  if (!id) return
  const db = await openRoomDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
