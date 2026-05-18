/**
 * Colour themes. Each theme is a `[data-theme="<id>"]` block in index.css
 * that overrides the CSS custom properties; `applyTheme` just sets the
 * attribute on <html>. `midnight` is the default and lives in `:root`.
 */
export const THEME_IDS = ['midnight', 'forest', 'ember', 'rose', 'daylight', 'parchment'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export const DEFAULT_THEME: ThemeId = 'midnight'

/** Type guard for a stored / unknown value. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

/** Apply a theme by setting `data-theme` on the document root. */
export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id
}
