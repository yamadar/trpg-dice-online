import type { Pattern } from '../dice/types'
import type { Lang } from '../i18n/translations'

/**
 * A player character. Distinct from the Player (the person): one person
 * can keep several characters and switch between them.
 */
export interface Character {
  id: string
  /** Character name (shown to everyone). */
  name: string
  /** Background / public notes — shared with the room. */
  background: string
  /** Private memo — kept locally, never sent over the network. */
  memo: string
  /** This character's saved roll patterns. */
  patterns: Pattern[]
  /**
   * Language the free-text fields were written in. Carried so a future
   * translation layer (see docs/TRANSLATION_API_RESEARCH.md) knows the
   * source language; it has no effect on behaviour yet.
   */
  lang: Lang
  /**
   * Optional portrait, as an `image/*` data URL — the character's look.
   * Downscaled on the way in (see `characters/image.ts`); absent when no
   * picture has been attached.
   */
  image?: string
}

/** The fields of a character the user can edit directly. */
export type CharacterEdits = Pick<Character, 'name' | 'background' | 'memo' | 'lang' | 'image'>
