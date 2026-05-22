import { loadString, saveString } from './local'
import { DEFAULT_FONT_SCALE, isFontScale, type FontScale } from '../theme/fontScale'

const COMPACT_FEED_KEY = 'trpg-dice.compactFeed'
const FONT_SCALE_KEY = 'trpg-dice.fontScale'
const SHOW_TYPING_KEY = 'trpg-dice.showTyping'
const BROADCAST_TYPING_KEY = 'trpg-dice.broadcastTyping'

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

/**
 * Whether the player wants to *see* other participants' "typing…"
 * indicator. Default `true` for the existing behaviour; a player who
 * finds the indicator pressuring (e.g. HSP) can turn it off locally
 * without affecting what the other end sees.
 */
export function loadShowTyping(): boolean {
  // The stored values are '1' / '0'; an empty string (never set) means
  // "use the default", which is on.
  const stored = loadString(SHOW_TYPING_KEY, '')
  return stored !== '0'
}

export function saveShowTyping(on: boolean): void {
  saveString(SHOW_TYPING_KEY, on ? '1' : '0')
}

/**
 * Whether the local player *broadcasts* a "typing…" signal to others.
 * Default `true`. Splitting this from `showTyping` lets a sensitive
 * user opt out of either side independently — see / be seen as
 * typing are two separate calls to make.
 */
export function loadBroadcastTyping(): boolean {
  const stored = loadString(BROADCAST_TYPING_KEY, '')
  return stored !== '0'
}

export function saveBroadcastTyping(on: boolean): void {
  saveString(BROADCAST_TYPING_KEY, on ? '1' : '0')
}
