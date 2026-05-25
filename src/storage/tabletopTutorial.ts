import { loadString, saveString } from './local'

const SEEN_KEY = 'trpg-dice.tabletopTutorialSeen'

/** Whether the first-run tabletop tutorial has already been shown.
 *  Tracked separately from the main `tutorialSeen` flag because the
 *  tabletop is a distinct mode users may discover long after their
 *  initial onboarding (or never, if they only join non-map sessions). */
export function isTabletopTutorialSeen(): boolean {
  return loadString(SEEN_KEY, '') === '1'
}

export function markTabletopTutorialSeen(): void {
  saveString(SEEN_KEY, '1')
}
