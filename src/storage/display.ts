import { loadString, saveString } from './local'
import { DEFAULT_FONT_SCALE, isFontScale, type FontScale } from '../theme/fontScale'

const COMPACT_FEED_KEY = 'trpg-dice.compactFeed'
const FONT_SCALE_KEY = 'trpg-dice.fontScale'

/** Whether the player chose the compact dice & chat layout. */
export function loadCompactFeed(): boolean {
  return loadString(COMPACT_FEED_KEY, '') === '1'
}

export function saveCompactFeed(on: boolean): void {
  saveString(COMPACT_FEED_KEY, on ? '1' : '0')
}

/** The text-size the player last chose, or the default. */
export function loadFontScale(): FontScale {
  const stored = loadString(FONT_SCALE_KEY, '')
  return isFontScale(stored) ? stored : DEFAULT_FONT_SCALE
}

export function saveFontScale(scale: FontScale): void {
  saveString(FONT_SCALE_KEY, scale)
}
