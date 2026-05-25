import { useI18n } from '../i18n/useI18n'
import {
  ArrowLeftIcon,
  CharacterIcon,
  ChatIcon,
  DiceIcon,
} from './icons'

/** Buttons rendered along the bottom of the tabletop layer. Distinct
 *  from the main app `<Dock>` because in the tabletop the per-button
 *  meanings shift: "Room" becomes a chat toggle, "Map" becomes the
 *  "return to room" exit, etc. Keeping the visual style identical
 *  (icon + label, same sizes) means muscle memory carries over and
 *  the user does not have to relearn the bottom row. */
export type TabletopDockId = 'chat' | 'character' | 'dice' | 'returnToRoom'
/** Subset of dock IDs that have a "currently showing a panel" state.
 *  `character` opens an App-level sheet (state lives elsewhere) and
 *  `returnToRoom` is a one-shot action, so neither participates in the
 *  active-pip indicator. */
type TabletopDockActiveId = 'chat' | 'dice'

interface Props {
  /** Which toggle button currently shows its panel above the dock.
   *  `null` when the canvas is the foreground. */
  active: TabletopDockActiveId | null
  onSelect: (id: TabletopDockId) => void
}

const ICON_SIZE = 22

/** Bottom navigation while the tabletop is the foreground view. */
export function TabletopDock({ active, onSelect }: Props) {
  const { t } = useI18n()
  const items: Array<{
    id: TabletopDockId
    label: string
    Icon: typeof ChatIcon
  }> = [
    { id: 'chat', label: t('tabletop.dock.chat'), Icon: ChatIcon },
    { id: 'character', label: t('tabletop.dock.character'), Icon: CharacterIcon },
    { id: 'dice', label: t('tabletop.dock.dice'), Icon: DiceIcon },
    { id: 'returnToRoom', label: t('tabletop.dock.returnToRoom'), Icon: ArrowLeftIcon },
  ]
  return (
    <nav className="dock tabletop-dock" aria-label={t('tabletop.dock.nav')}>
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={id === active ? 'dock-btn active' : 'dock-btn'}
          aria-pressed={id === active}
          onClick={() => onSelect(id)}
        >
          <span className="dock-icon" aria-hidden="true">
            <Icon size={ICON_SIZE} />
          </span>
          <span className="dock-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
