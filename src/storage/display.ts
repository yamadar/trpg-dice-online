import { loadString, saveString } from './local'

const COMPACT_FEED_KEY = 'trpg-dice.compactFeed'

/** Whether the player chose the compact dice & chat layout. */
export function loadCompactFeed(): boolean {
  return loadString(COMPACT_FEED_KEY, '') === '1'
}

export function saveCompactFeed(on: boolean): void {
  saveString(COMPACT_FEED_KEY, on ? '1' : '0')
}
