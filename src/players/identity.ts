/**
 * Display-name composition.
 *
 * When a player acts as a character, their name reads "Character（Player）"
 * so everyone can see both the character and the person behind it. Acting
 * as the player directly just shows the player name.
 */
export function composeName(playerName: string, characterName?: string): string {
  const pl = playerName.trim()
  const character = characterName?.trim() ?? ''
  if (!character) return pl
  // Drop the empty parentheses when the player has not set a name yet.
  if (!pl) return character
  return `${character}（${pl}）`
}

/**
 * The name to show on a feed entry (roll or chat). The compact feed trades
 * the full "Character（Player）" form for just the character name to keep
 * each line short; when the actor has no character the plain player name
 * (`composedName`) is kept either way.
 */
export function feedName(composedName: string, characterName: string, compact: boolean): string {
  const character = characterName.trim()
  if (compact && character) return character
  return composedName
}
