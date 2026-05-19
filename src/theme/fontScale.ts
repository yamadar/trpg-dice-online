/**
 * Text-size preference. Each scale maps to a root font-size; because the
 * whole UI is sized in `rem`, changing the root rescales every element.
 * `applyFontScale` just sets the size on `<html>`, mirroring `applyTheme`.
 */
export const FONT_SCALES = ['small', 'medium', 'large'] as const

export type FontScale = (typeof FONT_SCALES)[number]

export const DEFAULT_FONT_SCALE: FontScale = 'medium'

/** Root font-size per scale. `medium` matches the stylesheet default. */
const SCALE_PX: Record<FontScale, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

/** Type guard for a stored / unknown value. */
export function isFontScale(value: unknown): value is FontScale {
  return typeof value === 'string' && (FONT_SCALES as readonly string[]).includes(value)
}

/** Apply a text size by setting the root font-size the `rem` unit derives from. */
export function applyFontScale(scale: FontScale): void {
  document.documentElement.style.fontSize = SCALE_PX[scale]
}
