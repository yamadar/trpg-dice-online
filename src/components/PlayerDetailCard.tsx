import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { Player } from '../net/protocol'
import { playerColor } from '../players/colors'
import { Lightbox } from './Lightbox'

interface Props {
  /** The live participant, used for the GM badge and current player name. */
  player: Player | null
  /** The player id of the tapped feed entry (used for the color swatch). */
  playerId: string
  /** Composed display name captured on the tapped feed entry. */
  displayName: string
  /** Character name active when the entry was created (the snapshot). */
  characterName: string
  /** Character background at that time (the snapshot). */
  background: string
  /** The player's current character portrait, synced from the room, if any. */
  image?: string
  /** Whether the tapped entry belongs to the local player. */
  isSelf: boolean
}

/**
 * Read-only profile shown when a name in the feed is tapped. Character
 * details come from the tapped entry, not the live player, so a name
 * sent under an old character still shows that old character — even
 * after the player has switched characters. The portrait, by contrast,
 * is the player's current one (synced live, not part of the snapshot).
 */
export function PlayerDetailCard({
  player,
  playerId,
  displayName,
  characterName,
  background,
  image,
  isSelf,
}: Props) {
  const { t } = useI18n()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const color = playerColor(playerId)
  const character = characterName.trim()
  const bg = background.trim()
  // The person name is not part of the snapshot; show the live one when
  // the player is still present.
  const playerName = player?.name.trim() ?? ''

  return (
    <section className="panel player-card">
      <h2>{t('feed.playerDetail')}</h2>

      <div className="player-card-head">
        <span className="player-dot" style={{ background: color }} />
        <span className="player-card-name" style={{ color }}>
          {character || displayName || t('player.anon')}
        </span>
        {player?.isGM && <span className="badge gm">{t('room.gmBadge')}</span>}
        {isSelf && <span className="badge you">{t('room.youBadge')}</span>}
      </div>

      {image && (
        <button
          type="button"
          className="char-image-thumb player-card-image"
          aria-label={t('character.imageView')}
          onClick={() => setLightboxOpen(true)}
        >
          <img src={image} alt={character || displayName} />
        </button>
      )}

      <dl className="player-card-fields">
        {character && (
          <div>
            <dt>{t('character.name')}</dt>
            <dd>{character}</dd>
          </div>
        )}
        {playerName && (
          <div>
            <dt>{t('player.name')}</dt>
            <dd>{playerName}</dd>
          </div>
        )}
      </dl>

      {bg ? (
        <p className="player-card-bg">{bg}</p>
      ) : (
        <p className="hint">{t('feed.noBackground')}</p>
      )}

      {!player && <p className="hint">{t('feed.playerLeft')}</p>}

      {lightboxOpen && image && (
        <Lightbox
          images={[{ name: character || displayName || t('player.anon'), dataUrl: image }]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </section>
  )
}
