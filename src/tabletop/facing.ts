/**
 * Pure helpers for token facing — the direction a token is "looking".
 *
 * Facing is stored on a token as **degrees clockwise from up (north)**:
 *   0 = up (N), 90 = right (E), 180 = down (S), 270 = left (W).
 * It is kept as a free number so a future free-angle dial stays
 * wire-compatible, but the token popover offers the eight compass points.
 * An absent `facing` means "no indicator" — the token renders without an
 * arrow, exactly as before this feature.
 *
 * Split out from rendering / sync so the angle math (normalisation,
 * the screen-space direction vector, the arrowhead geometry) can be
 * unit-tested without Konva.
 */

/** Angular step between adjacent compass points (degrees). */
export const FACING_STEP = 45

/** The eight compass directions as degrees clockwise from north. */
export const FACING_DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315] as const

/** Fold any angle into the canonical [0, 360) range. The double-mod form
 *  also collapses a `-0` result (e.g. `-360 % 360`) back to `+0`. */
export function normalizeFacing(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * Validate a facing value from an untrusted source (wire / storage).
 * Only a finite number is a usable angle; anything else (NaN, Infinity,
 * a string) is rejected so it cannot corrupt a Konva rotation.
 */
export function isValidFacing(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Snap a free angle to the nearest compass point (0 / 45 / … / 315). */
export function snapFacingToStep(deg: number): number {
  const steps = Math.round(normalizeFacing(deg) / FACING_STEP)
  return normalizeFacing(steps * FACING_STEP)
}

/**
 * Unit direction vector for a facing angle in **screen space**, where y
 * grows downward. 0° (north) → (0, -1); 90° (east) → (1, 0); 180° → (0,
 * 1); 270° → (-1, 0).
 */
export function facingVector(deg: number): { dx: number; dy: number } {
  const r = (normalizeFacing(deg) * Math.PI) / 180
  return { dx: Math.sin(r), dy: -Math.cos(r) }
}

/**
 * Flattened triangle points `[tipX, tipY, b1X, b1Y, b2X, b2Y]` for an
 * arrowhead that sits just outside a token of the given `radius` and
 * points in the facing direction. Coordinates are token-local (the token
 * centre is the origin), so the caller drops them straight into a Konva
 * `Line` with `closed`. `gap` is the clearance between the ring and the
 * arrow base; `size` is the arrowhead length.
 */
export function facingArrowPoints(
  deg: number,
  radius: number,
  size: number,
  gap: number,
): number[] {
  const f = facingVector(deg)
  // Perpendicular (rotate the forward vector 90°) for the base width.
  const px = -f.dy
  const py = f.dx
  const baseDist = radius + gap
  const tipDist = baseDist + size
  const halfWidth = size * 0.62
  const tipX = f.dx * tipDist
  const tipY = f.dy * tipDist
  const baseX = f.dx * baseDist
  const baseY = f.dy * baseDist
  return [
    tipX,
    tipY,
    baseX + px * halfWidth,
    baseY + py * halfWidth,
    baseX - px * halfWidth,
    baseY - py * halfWidth,
  ]
}
