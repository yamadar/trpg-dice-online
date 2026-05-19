/**
 * Date and time formatting for the feed. The clock is a fixed 24-hour
 * `H:mm`; the date divider is localized to the player's UI language.
 * Pure functions over `Date`, so they are deterministic to test.
 */

import type { Lang } from '../i18n/translations'

/** Clock time as `H:mm` — 24-hour, no leading zero on the hour. */
export function formatClock(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * A full calendar date in the player's language — e.g. `2026年5月19日`
 * for `ja`, `May 19, 2026` for `en`. Used by the feed's date dividers.
 */
export function formatFeedDate(date: Date, lang: Lang): string {
  return date.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Whether two instants fall on the same calendar day in local time. */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
