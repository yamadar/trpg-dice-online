/**
 * Helpers that bridge in-memory `TabletopState` and the welcome /
 * tabletopState wire envelopes.
 *
 * Both directions exist because the snapshot path has two pieces of
 * special handling:
 *
 *  - Outgoing: strip the map's potentially-megabyte `dataUrl` from
 *    the welcome message so the snapshot fits comfortably on a single
 *    data-channel frame. The bytes follow separately through the
 *    chunked `mapMeta` / `mapChunk` path.
 *  - Incoming: a pre-PR-12 host may omit the annotation-layer fields
 *    (`texts`, `strokes`, `fog`) or the `npcLibrary`. Default them so
 *    the renderer's `.map` / `.length` calls never trip.
 *
 * Lifted out of `useSession.ts` so the round-trip logic — including
 * "fog painted → disconnect → reconnect → snapshot delivered" — can
 * be unit-tested without React or PeerJS in the loop.
 */

import { DEFAULT_FOG, type TabletopState } from './types'

/**
 * Produce the version of a tabletop state that goes onto the wire as
 * part of a welcome or `tabletopState` message. The map's `dataUrl`
 * is replaced with an empty string because a separate chunked
 * transfer is responsible for the actual bytes. The input is never
 * mutated.
 */
export function stripMapBytesForWire(state: TabletopState): TabletopState {
  if (!state.map) return state
  return {
    ...state,
    map: { ...state.map, dataUrl: '' },
  }
}

/**
 * Normalise a `TabletopState` received from a peer. A pre-PR-12 host
 * may not carry the new annotation fields; default them so the rest
 * of the app can assume every field is present.
 */
export function fillTabletopDefaults(state: TabletopState): TabletopState {
  return {
    ...state,
    npcLibrary: state.npcLibrary ?? [],
    texts: state.texts ?? [],
    strokes: state.strokes ?? [],
    fog: state.fog ?? { ...DEFAULT_FOG },
  }
}
