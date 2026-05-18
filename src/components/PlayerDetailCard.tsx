import { useI18n } from '../i18n/useI18n'
import type { Player } from '../net/protocol'
import { playerColor } from '../players/colors'

interface Props {
  /** The live participant, or null when they have left the room. */
  player: Player | null
  /** The player id of the tapped feed entry (used for the color swatch). */
  playerId: string
  /** Display name captured on the feed entry, shown when the player has left. */
  fallbackName: string
  /** Whether the tapped entry belongs to the local player. */
  isSelf: boolean
}

/**
 * Read-only profile shown when a name in the feed is tapped. Live details
 * (character name, background) come from the current participant list; for
 * a player who has since left, only the name captured on the entry remains.
 */
export function PlayerDetailCard({ player, playerId, fallbackName, isSelf }: Props) {
  const { t } = useI18n()
  const color = playerColor(playerId)
  const characterName = player?.characterName.trim() ?? ''
  const playerName = (player?.name ?? fallbackName).trim()
  const background = player?.background.trim() ?? ''

  return (
    <section className="panel player-card">
      <h2>{t('feed.playerDetail')}</h2>

      <div className="player-card-head">
        <span className="player-dot" style={{ background: color }} />
        <span className="player-card-name" style={{ color }}>
          {characterName || playerName || t('player.anon')}
        </span>
        {player?.isGM && <span className="badge gm">{t('room.gmBadge')}</span>}
        {isSelf && <span className="badge you">{t('room.youBadge')}</span>}
      </div>

      <dl className="player-card-fields">
        {characterName && (
          <div>
            <dt>{t('character.name')}</dt>
            <dd>{characterName}</dd>
          </div>
        )}
        <div>
          <dt>{t('player.name')}</dt>
          <dd>{playerName || t('player.anon')}</dd>
        </div>
      </dl>

      {background ? (
        <p className="player-card-bg">{background}</p>
      ) : (
        <p className="hint">{t('feed.noBackground')}</p>
      )}

      {!player && <p className="hint">{t('feed.playerLeft')}</p>}
    </section>
  )
}
