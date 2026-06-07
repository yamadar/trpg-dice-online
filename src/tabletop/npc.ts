/**
 * Pure helper for editing an NPC library entry.
 *
 * Split out of `useSession.updateNpcDef` so the edit rule is unit-tested:
 * it caused a real bug where changing the image (or note) of a freshly
 * added, still-unnamed NPC was silently dropped because the guard
 * required a non-empty name even when the name was not being edited.
 */

import type { NpcDef } from './types'

export interface NpcDefUpdate {
  name?: string
  image?: string
  note?: string
}

/**
 * Apply `updates` to an existing NpcDef, returning the new def — or
 * `null` when the edit must be rejected.
 *
 * The only rejected case is an *explicit* attempt to blank the name
 * (`updates.name` given but empty/whitespace): an NPC must keep a name
 * once it has one. An image- or note-only update (no `name` key) always
 * goes through, even while the entry is still unnamed (the "+" add flow
 * creates a blank entry and names it later) — that is the fix.
 */
export function nextNpcDef(
  existing: NpcDef,
  updates: NpcDefUpdate,
): NpcDef | null {
  const nextName =
    updates.name === undefined ? existing.name : updates.name.trim()
  if (updates.name !== undefined && !nextName) return null
  const nextNote =
    updates.note === undefined ? existing.note : updates.note.trim()
  const next: NpcDef = {
    ...existing,
    name: nextName,
    ...(updates.image !== undefined ? { image: updates.image } : {}),
    ...(nextNote ? { note: nextNote } : {}),
  }
  // An explicit empty note clears the field entirely (the renderer / UI
  // key off "field is present").
  if (updates.note !== undefined && !nextNote && 'note' in next) {
    delete (next as { note?: string }).note
  }
  return next
}
