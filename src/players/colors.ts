/**
 * Deterministic per-player colors.
 *
 * The color is derived from the player id by hashing, so every client
 * computes the same color for the same player with no coordination —
 * which is what makes participants easy to tell apart in the shared feed.
 */

/** Distinct, reasonably accessible hues on the app's dark background. */
export const PLAYER_PALETTE = [
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // amber
  '#a3e635', // lime
  '#34d399', // emerald
  '#2dd4bf', // teal
  '#38bdf8', // sky
  '#818cf8', // indigo
  '#c084fc', // purple
  '#e879f9', // fuchsia
  '#f472b6', // pink
  '#fb7185', // rose
] as const

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Pick a stable palette color for a player id. */
export function playerColor(playerId: string): string {
  return PLAYER_PALETTE[hashString(playerId) % PLAYER_PALETTE.length]
}
