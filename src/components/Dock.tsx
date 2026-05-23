import type { ComponentType } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  CharacterIcon,
  DiceIcon,
  PatternsIcon,
  RoomIcon,
  TabletopIcon,
  type IconProps,
} from './icons'

/**
 * Buttons reachable from the bottom dock. Most open as a sheet, but
 * `tabletop` opens a full-screen mode handled separately in `App.tsx`
 * — App passes a no-op `active` for it because the Dock active-pip
 * convention is for the sheet panels only.
 */
export type DockId = 'room' | 'character' | 'dice' | 'patterns' | 'tabletop'
/** Subset of DockId that opens as a Sheet — preserved for callers that
 *  only care about the sheet panels (toggle / title / icon switches). */
export type SheetId = 'room' | 'character' | 'dice' | 'patterns'

// Sized once so every dock icon matches the height the dock chrome
// was originally tuned for (a touch larger than the inline `icon-svg`
// default so the row's visual weight balances against the label).
const DOCK_ICON_SIZE = 22

const ITEMS: {
  id: DockId
  Icon: ComponentType<IconProps>
  labelKey: string
}[] = [
  { id: 'room', Icon: RoomIcon, labelKey: 'dock.room' },
  { id: 'character', Icon: CharacterIcon, labelKey: 'dock.character' },
  { id: 'tabletop', Icon: TabletopIcon, labelKey: 'dock.tabletop' },
  { id: 'dice', Icon: DiceIcon, labelKey: 'dock.dice' },
  { id: 'patterns', Icon: PatternsIcon, labelKey: 'dock.patterns' },
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
      {ITEMS.map(({ id, Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          className={id === active ? 'dock-btn active' : 'dock-btn'}
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
