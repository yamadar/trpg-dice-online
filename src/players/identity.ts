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
