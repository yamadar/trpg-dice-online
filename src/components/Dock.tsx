import { useI18n } from '../i18n/useI18n'

/** The on-demand panels reachable from the bottom dock. */
export type SheetId = 'room' | 'character' | 'dice' | 'patterns'

const ITEMS: { id: SheetId; icon: string; labelKey: string }[] = [
  { id: 'room', icon: '👥', labelKey: 'dock.room' },
  { id: 'character', icon: '🎭', labelKey: 'dock.character' },
  { id: 'dice', icon: '🎲', labelKey: 'dock.dice' },
  { id: 'patterns', icon: '⭐', labelKey: 'dock.patterns' },
]

interface Props {
  active: SheetId | null
  onOpen: (id: SheetId) => void
}

/** Bottom navigation: each button opens (or closes) one panel as a sheet. */
export function Dock({ active, onOpen }: Props) {
  const { t } = useI18n()
  return (
    <nav className="dock" aria-label={t('settings.title')}>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === active ? 'dock-btn active' : 'dock-btn'}
          aria-pressed={item.id === active}
          onClick={() => onOpen(item.id)}
        >
          <span className="dock-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="dock-label">{t(item.labelKey)}</span>
        </button>
      ))}
    </nav>
  )
}
