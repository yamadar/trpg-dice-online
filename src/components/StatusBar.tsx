import { useI18n } from '../i18n/useI18n'

interface Props {
  roomCode: string | null
  roomName: string
  playerCount: number
  characterName: string
}

/**
 * The minimal always-visible status: which room you are in, how many
 * players are present, and which character you are acting as. Long room
 * and character names are truncated so they never break the layout.
 */
export function StatusBar({ roomCode, roomName, playerCount, characterName }: Props) {
  const { t } = useI18n()
  const roomLabel = roomCode ? roomName.trim() || roomCode : t('status.offline')
  return (
    <div className="statusbar">
      <span className="stat">
        <span className="stat-key">{t('room.section')}</span>
        <span className="stat-value">{roomLabel}</span>
        {roomCode && (
          <span className="stat-players" aria-label={t('room.players')}>
            <span aria-hidden="true">👥</span> {playerCount}
          </span>
        )}
      </span>
      <span className="stat">
        <span className="stat-key">{t('character.section')}</span>
        <span className="stat-value">{characterName || t('status.noCharacter')}</span>
      </span>
    </div>
  )
}
