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
  /** Composed display name ("Character（Player）" or just the player)
   *  captured on the tapped feed entry — matches the speaker name shown
   *  in the non-compact feed. */
  displayName: string
  /** Character name active when the entry was created (the snapshot). */
  characterName: string
  /** Character background at that time (the snapshot). */
  background: string
  /** Portrait for that specific (player, character) pair — the same image
   *  the feed avatar shows for the tapped entry, even after the speaker
   *  has switched characters. */
  image?: string
  /** Whether the tapped entry belongs to the local player. */
  isSelf: boolean
}

/**
 * Read-only profile shown when a name in the feed is tapped. Both the
 * name and the portrait are taken from the tapped feed entry, so a name
 * sent under an old character still shows that old character even after
 * the player has switched.
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
  // The same composed speaker name the non-compact feed shows.
  const title = displayName.trim() || t('player.anon')

  return (
    <section className="panel player-card">
      <h2 className="player-card-title" style={{ color }}>
        <span className="player-card-title-text">{title}</span>
        {player?.isGM && <span className="badge gm">{t('room.gmBadge')}</span>}
        {isSelf && <span className="badge you">{t('room.youBadge')}</span>}
      </h2>

      {image && (
        <button
          type="button"
          className="player-card-image"
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
          images={[{ name: title, dataUrl: image }]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </section>
  )
}
