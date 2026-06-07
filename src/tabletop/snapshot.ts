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

import { DEFAULT_FOG, type TabletopState, type Token } from './types'

/**
 * Strip the GM-only `privateNote` field from a token before it leaves
 * the host. Every broadcast path that sends a `tokenUpsert` or includes
 * tokens in a `tabletopState` / welcome snapshot must pass the token
 * through this helper so non-host clients never receive private notes.
 * The input is never mutated; returns the same reference if no stripping
 * is needed.
 */
export function tokenForWire(token: Token): Token {
  if (!('privateNote' in token) || token.privateNote === undefined)
    return token
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { privateNote: _, ...rest } = token as Token & { privateNote?: string }
  return rest as Token
}

/**
 * Produce the version of a tabletop state that goes onto the wire as
 * part of a welcome or `tabletopState` message. Three pieces of
 * host-only data are removed:
 *   - the current map's `dataUrl` (a separate chunked transfer carries
 *     the bytes);
 *   - every token's GM-private `privateNote` (via `tokenForWire`);
 *   - the entire `scenes` array — scenes are a host-only concept, so a
 *     client only ever mirrors the *current* scene (the top-level
 *     fields). The scene *metadata* (`scenes`, `sceneName`, `sceneOrd`)
 *     is all GM-only too: it is dropped so a rename that is not
 *     re-broadcast cannot leave a stale name on a client. `sceneId` is
 *     kept as a harmless identity.
 * The input is never mutated.
 */
export function stripMapBytesForWire(state: TabletopState): TabletopState {
  const strippedTokens = state.tokens.map(tokenForWire)
  const tokensChanged = strippedTokens.some((t, i) => t !== state.tokens[i])
  let base = tokensChanged ? { ...state, tokens: strippedTokens } : state
  if (base.scenes?.length || base.sceneName || base.sceneOrd !== undefined) {
    base = { ...base }
    base.scenes = []
    delete base.sceneName
    delete base.sceneOrd
  }
  if (!base.map) return base
  return { ...base, map: { ...base.map, dataUrl: '' } }
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
    // Clients never receive inactive scenes (stripped before broadcast);
    // default to an empty list so the shape stays consistent.
    scenes: state.scenes ?? [],
  }
}
