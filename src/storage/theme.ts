import { loadString, saveString } from './local'
import { DEFAULT_THEME, isThemeId, type ThemeId } from '../theme/themes'

const THEME_KEY = 'trpg-dice.theme'

/** The colour theme the player last chose, or the default. */
export function loadTheme(): ThemeId {
  const stored = loadString(THEME_KEY, '')
  return isThemeId(stored) ? stored : DEFAULT_THEME
}

export function saveTheme(id: ThemeId): void {
  saveString(THEME_KEY, id)
}
