/**
 * Pure helpers for token "vitals" — an optional HP pool and a set of
 * status-condition markers.
 *
 * Both are optional token fields (absent = nothing drawn): `hp` is a
 * `{ current, max }` pair rendered as a small bar under the token, and
 * `statuses` is a list of condition keys from `STATUS_CATALOG` rendered
 * as emoji badges above it. Like the rest of the table they sync
 * host-authoritative; editing follows the same `canMoveToken` permission
 * as move / resize (a PC token's owner, or the GM).
 *
 * The numeric clamping, the bar colour thresholds and the status-list
 * sanitisation live here so they can be unit-tested without Konva, and
 * so the host validator, the reload sanitiser and the renderer all share
 * one definition.
 */

export interface TokenHp {
  current: number
  max: number
}

/** Upper bound accepted for an HP value (keeps the bar / inputs sane). */
export const MAX_HP_VALUE = 99999

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(value)
  if (n < min) return min
  if (n > max) return max
  return n
}

/** A usable HP pair is two finite numbers. */
export function isValidHp(hp: unknown): hp is TokenHp {
  if (typeof hp !== 'object' || hp === null) return false
  const h = hp as Record<string, unknown>
  return (
    typeof h.current === 'number' &&
    typeof h.max === 'number' &&
    Number.isFinite(h.current) &&
    Number.isFinite(h.max)
  )
}

/**
 * Coerce an HP pair into the canonical form: integer `max` in
 * [0, MAX_HP_VALUE] and integer `current` clamped to [0, max]. (Temp-HP
 * over max is intentionally not modelled — current never exceeds max.)
 */
export function clampHp(hp: TokenHp): TokenHp {
  const max = clampInt(hp.max, 0, MAX_HP_VALUE)
  const current = clampInt(hp.current, 0, max)
  return { current, max }
}

/** Fraction of HP remaining in [0, 1]. A non-positive max reads as 0. */
export function hpRatio(hp: TokenHp): number {
  if (hp.max <= 0) return 0
  const r = hp.current / hp.max
  if (r < 0) return 0
  if (r > 1) return 1
  return r
}

/**
 * Bar colour for a remaining-HP ratio: green when healthy, amber when
 * wounded, red when badly hurt. Returns a hex string the renderer fills
 * the bar with.
 */
export function hpBarColor(ratio: number): string {
  if (ratio > 0.5) return '#4ade80' // green
  if (ratio > 0.25) return '#facc15' // amber
  return '#ef4444' // red
}

/**
 * The fixed catalog of status conditions. Each entry pairs a stable
 * `key` (what is stored / synced) with an emoji `glyph` (what is drawn).
 * Emoji avoids an image-asset pipeline and renders on the Konva text
 * layer. The human-readable label is resolved via i18n
 * (`tabletop.status.<key>`), not stored here.
 */
export const STATUS_CATALOG: ReadonlyArray<{ key: string; glyph: string }> = [
  { key: 'poison', glyph: '🤢' },
  { key: 'stun', glyph: '💫' },
  { key: 'sleep', glyph: '💤' },
  { key: 'fear', glyph: '😱' },
  { key: 'charm', glyph: '💗' },
  { key: 'burn', glyph: '🔥' },
  { key: 'freeze', glyph: '❄️' },
  { key: 'bless', glyph: '✨' },
  { key: 'shield', glyph: '🛡️' },
  { key: 'haste', glyph: '⚡' },
  { key: 'bleed', glyph: '🩸' },
  { key: 'down', glyph: '💀' },
]

/** Stable set of catalog keys, for validation. */
export const STATUS_KEYS: ReadonlyArray<string> = STATUS_CATALOG.map((s) => s.key)

/** O(1) membership set for `sanitizeStatuses`. */
const STATUS_KEY_SET = new Set(STATUS_KEYS)

/** Largest number of status badges kept on a token (avoids clutter). */
export const MAX_STATUSES = STATUS_CATALOG.length

/** Hard cap on how many input elements `sanitizeStatuses` will scan, so
 *  a hostile / corrupt array of mostly-invalid values cannot force
 *  unbounded work before the (much smaller) output cap is reached. */
const STATUS_SCAN_CAP = 256

/** The emoji for a status key, or undefined when the key is unknown. */
export function statusGlyph(key: string): string | undefined {
  return STATUS_CATALOG.find((s) => s.key === key)?.glyph
}

/**
 * Sanitise an arbitrary value into a valid status list: keep only known
 * catalog keys, drop duplicates (preserving first-seen order) and cap
 * the count. Used by the host validator, the reload sanitiser and any
 * inbound wire message so a bad client cannot inject unknown / unbounded
 * statuses.
 */
export function sanitizeStatuses(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  // Scan at most STATUS_SCAN_CAP elements: O(1) membership via the Set,
  // and a bounded loop so a giant mostly-invalid array is cheap to reject.
  const limit = Math.min(raw.length, STATUS_SCAN_CAP)
  for (let i = 0; i < limit; i++) {
    const v = raw[i]
    if (typeof v !== 'string') continue
    if (!STATUS_KEY_SET.has(v)) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
    if (out.length >= MAX_STATUSES) break
  }
  return out
}
