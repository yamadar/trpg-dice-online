/**
 * Pure helpers for the transient "look here" ping marker.
 *
 * A ping is intentionally *not* part of `TabletopState`: it is a
 * short-lived attention cue that any participant can drop on the table,
 * broadcast once and animated for a couple of seconds before it
 * disappears. Because it is ephemeral it never persists to IndexedDB,
 * never rides in the welcome snapshot, and a late joiner simply does
 * not see pings that fired before they arrived.
 *
 * Sync mirrors the host-authoritative token path: a client sends a
 * `pingRequest`, the host stamps the sender's id and re-broadcasts a
 * `ping` to everyone (the host renders its own pings locally). The
 * coordinate is world-space pixels, so it pans / zooms with the rest of
 * the table.
 *
 * The math here (validation + the expanding-ring animation curve) is
 * split out so it can be unit-tested without Konva or PeerJS.
 */

/** How long a ping stays on the table before it fades out (ms). */
export const PING_TTL_MS = 2600

/** Number of concentric rings in the ripple effect. */
export const PING_RING_COUNT = 3

/** A ping as it travels on the wire / renders on the table. */
export interface Ping {
  /** Unique id, used as the React key and for de-duplication. */
  id: string
  /** World-space pixel coordinates of the ping centre. */
  x: number
  y: number
  /** Player who dropped the ping (drives the ring colour + name label). */
  playerId: string
}

export function newPingId(): string {
  return `png-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Validate ping coordinates received over the wire. A ping is untrusted
 * input, so reject anything that is not a pair of finite numbers before
 * it is broadcast or rendered (a NaN / Infinity would corrupt the Konva
 * transform). Returns true only for a usable point.
 */
export function isValidPingPoint(x: unknown, y: unknown): boolean {
  return (
    typeof x === 'number' &&
    typeof y === 'number' &&
    Number.isFinite(x) &&
    Number.isFinite(y)
  )
}

/**
 * Animation progress 0..1 (clamped) for a ping of age `elapsedMs`.
 * `0` at birth, `1` once it has lived its full TTL. A non-positive TTL
 * collapses to `1` (immediately done) so a degenerate config cannot
 * leave a ping stuck on screen.
 */
export function pingProgress(elapsedMs: number, ttl = PING_TTL_MS): number {
  if (ttl <= 0) return 1
  if (elapsedMs <= 0) return 0
  return Math.min(1, elapsedMs / ttl)
}

/**
 * Radius (as a multiple of the base ping radius) and opacity for ring
 * `i` at overall animation `progress`. The rings are staggered so they
 * ripple outward, and the stagger is normalised so even the last ring
 * finishes its expansion by `progress === 1`. A ring that has not
 * started yet, or has fully faded, returns opacity `0`.
 */
export function pingRingStyle(
  progress: number,
  i: number,
): { radius: number; opacity: number } {
  const stagger = 0.18
  // Normalise so ring (PING_RING_COUNT - 1) reaches local=1 exactly at
  // progress=1 rather than overshooting past the TTL.
  const span = 1 - (PING_RING_COUNT - 1) * stagger
  const local = (progress - i * stagger) / span
  if (local <= 0 || local >= 1) return { radius: 1, opacity: 0 }
  return { radius: 1 + local * 1.6, opacity: (1 - local) * 0.85 }
}

/**
 * Opacity for the steady centre dot. Holds full strength for most of
 * the ping's life, then fades over the final fifth so the marker leaves
 * cleanly instead of popping out.
 */
export function pingDotOpacity(progress: number): number {
  if (progress <= 0) return 1
  if (progress >= 1) return 0
  const fadeStart = 0.8
  if (progress <= fadeStart) return 1
  return 1 - (progress - fadeStart) / (1 - fadeStart)
}
