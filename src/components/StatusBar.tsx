import { useI18n } from '../i18n/useI18n'
import type { RoomStatus } from '../net/room'
import { RoomIcon } from './icons'

interface Props {
  status: RoomStatus
  roomCode: string | null
  roomName: string
  playerCount: number
  characterName: string
  onOpenRoom: () => void
  onOpenCharacter: () => void
}

/**
 * The minimal always-visible status: which room you are in (or that a
 * connection is in progress), how many players are present, and which
 * character you are acting as. Each item opens its panel when tapped.
 */
export function StatusBar({
  status,
  roomCode,
  roomName,
  playerCount,
  characterName,
  onOpenRoom,
  onOpenCharacter,
}: Props) {
  const { t } = useI18n()
  const roomLabel =
    status === 'connecting'
      ? t('room.connecting')
      : roomCode
        ? roomName.trim() || roomCode
        : t('status.offline')
  return (
    <div className="statusbar">
      <button type="button" className="stat" onClick={onOpenRoom}>
        <span className="stat-key">{t('room.section')}</span>
        <span className="stat-value">{roomLabel}</span>
        {roomCode && (
          // The label-with-count is composed into a single `aria-label` so
          // screen readers announce "Players: 3" rather than just "3" or
          // just the label. Visually the row still reads as "[icon] 3";
          // the icon is `aria-hidden` (set inside `RoomIcon`) so it does
          // not duplicate the label.
          <span
            className="stat-players"
            aria-label={`${t('room.players')}: ${playerCount}`}
          >
            <RoomIcon size={14} /> {playerCount}
          </span>
        )}
      </button>
      <button type="button" className="stat" onClick={onOpenCharacter}>
        <span className="stat-key">{t('character.section')}</span>
        <span className="stat-value">{characterName || t('status.noCharacter')}</span>
      </button>
    </div>
  )
}
