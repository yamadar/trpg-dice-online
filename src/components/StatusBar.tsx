import { useI18n } from '../i18n/useI18n'

interface Props {
  roomCode: string | null
  playerCount: number
  characterName: string
}

/**
 * The minimal always-visible status: which room you are in, how many
 * players are present, and which character you are acting as.
 */
export function StatusBar({ roomCode, playerCount, characterName }: Props) {
  const { t } = useI18n()
  return (
    <div className="statusbar">
      <span className="stat">
        <span className="stat-key">{t('room.section')}</span>
        <span className="stat-value">
          {roomCode ?? t('status.offline')}
          {roomCode && ` · ${t('room.players')} ${playerCount}`}
        </span>
      </span>
      <span className="stat">
        <span className="stat-key">{t('character.section')}</span>
        <span className="stat-value">{characterName || t('status.noCharacter')}</span>
      </span>
    </div>
  )
}
