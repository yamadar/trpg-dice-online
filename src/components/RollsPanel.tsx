import type { Pattern } from '../dice/types'
import { useI18n } from '../i18n/useI18n'
import { DiceRoller, type Draft } from './DiceRoller'
import { PatternList } from './PatternList'

interface Props {
  /** Current dice-roller draft (the in-progress combination). */
  draft: Draft
  onDraftChange: (draft: Draft) => void
  /** Whether the local player is the GM — drives the hidden-roll flag
   *  and the "show 🔒 on hidden patterns" rendering. */
  isGM: boolean
  onRoll: (hidden: boolean) => void
  onSave: () => void
  /** Whether a character is active (patterns belong to a character). */
  hasCharacter: boolean
  characterName: string
  patterns: Pattern[]
  onLoad: (pattern: Pattern) => void
  onQuickRoll: (pattern: Pattern) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
}

/**
 * Combined "Dice + Patterns" panel — the dice roller stays at the top
 * (the primary action: "what am I about to roll?"), the saved-pattern
 * list sits beneath as a flat dense list (one row per pattern, action
 * buttons icon-only). Splitting them across two dock entries forced
 * the user to bounce between sheets to save / reuse a roll; merging
 * them keeps the whole flow on one surface.
 */
export function RollsPanel({
  draft,
  onDraftChange,
  isGM,
  onRoll,
  onSave,
  hasCharacter,
  characterName,
  patterns,
  onLoad,
  onQuickRoll,
  onDelete,
  onMove,
}: Props) {
  const { t } = useI18n()
  return (
    <div className="rolls-panel">
      <DiceRoller
        draft={draft}
        onChange={onDraftChange}
        isGM={isGM}
        onRoll={onRoll}
        onSave={onSave}
      />
      <PatternList
        heading={t('pattern.section')}
        hasCharacter={hasCharacter}
        characterName={characterName}
        patterns={patterns}
        isGM={isGM}
        onLoad={onLoad}
        onQuickRoll={onQuickRoll}
        onDelete={onDelete}
        onMove={onMove}
      />
    </div>
  )
}
