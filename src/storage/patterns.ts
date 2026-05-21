/** Generate a unique id for a saved roll pattern. The random suffix is
 *  padded to a stable six-character length: `Math.random()` is a float,
 *  so its base-36 expansion can be shorter than six characters when the
 *  draw lands on a value with a short representation (e.g. `0.5` →
 *  `"0.i"` → `"i"`). Padding keeps every id the same shape, which
 *  matters both for log-line alignment in dev and for the unit tests
 *  that pin the format. */
export function newPatternId(): string {
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0')
  return `pat-${Date.now().toString(36)}-${suffix}`
}
