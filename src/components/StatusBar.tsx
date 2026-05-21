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
          <span className="stat-players" aria-label={t('room.players')}>
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
