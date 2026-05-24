import type { ComponentType } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  CharacterIcon,
  DiceIcon,
  RoomIcon,
  TabletopIcon,
  type IconProps,
} from './icons'

/**
 * Buttons reachable from the bottom dock. Most open as a sheet, but
 * `tabletop` opens a full-screen mode handled separately in `App.tsx`
 * — App passes a no-op `active` for it because the Dock active-pip
 * convention is for the sheet panels only.
 *
 * `dice` opens the combined dice + patterns panel (the dice roller at
 * the top, the saved-pattern list beneath) — they used to be two
 * separate dock entries but were merged so the dock stays compact and
 * the user does not bounce between them.
 */
export type DockId = 'room' | 'character' | 'dice' | 'tabletop'
/** Subset of DockId that opens as a Sheet — preserved for callers that
 *  only care about the sheet panels (toggle / title / icon switches). */
export type SheetId = 'room' | 'character' | 'dice'

// Sized once so every dock icon matches the height the dock chrome
// was originally tuned for (a touch larger than the inline `icon-svg`
// default so the row's visual weight balances against the label).
const DOCK_ICON_SIZE = 22

/** Layout slot for a dock button: 'leading' fills from the left, 'trailing'
 *  is pushed to the right edge with an auto-margin. Used so the
 *  tabletop button sits visually apart from the session-state buttons
 *  (room / character / dice). */
type DockSlot = 'leading' | 'trailing'

const ITEMS: {
  id: DockId
  Icon: ComponentType<IconProps>
  labelKey: string
  slot?: DockSlot
}[] = [
  { id: 'room', Icon: RoomIcon, labelKey: 'dock.room' },
  { id: 'character', Icon: CharacterIcon, labelKey: 'dock.character' },
  { id: 'dice', Icon: DiceIcon, labelKey: 'dock.dice' },
  { id: 'tabletop', Icon: TabletopIcon, labelKey: 'dock.tabletop', slot: 'trailing' },
]

interface Props {
  active: DockId | null
  onOpen: (id: DockId) => void
}

/** Bottom navigation: each button opens (or closes) one panel as a sheet. */
export function Dock({ active, onOpen }: Props) {
  const { t } = useI18n()
  return (
    <nav className="dock" aria-label={t('dock.nav')}>
      {ITEMS.map(({ id, Icon, labelKey, slot }) => (
        <button
          key={id}
          type="button"
          className={`dock-btn${id === active ? ' active' : ''}${slot === 'trailing' ? ' dock-btn-trailing' : ''}`}
          aria-pressed={id === active}
          onClick={() => onOpen(id)}
        >
          <span className="dock-icon" aria-hidden="true">
            <Icon size={DOCK_ICON_SIZE} />
          </span>
          <span className="dock-label">{t(labelKey)}</span>
        </button>
      ))}
    </nav>
  )
}
