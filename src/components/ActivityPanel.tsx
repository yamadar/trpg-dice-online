import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { Session } from '../hooks/useSession'
import { buildFeed, isRoomExitMarker, type FeedFilter } from '../feed/feed'
import { isImageType } from '../chat/attachment'
import type { ChatFile } from '../net/protocol'
import { Sheet } from './Sheet'
import { PlayerDetailCard } from './PlayerDetailCard'
import { Lightbox } from './Lightbox'
import { FeedList, type FeedDetailTarget } from './FeedList'
import { ChatComposer } from './ChatComposer'

const FILTERS: FeedFilter[] = ['all', 'rolls', 'chat', 'files']

interface Props {
  session: Session
  /** Surfaces attachment errors as a toast. */
  onNotice: (message: string, kind?: 'success' | 'error') => void
}

/**
 * The dominant view: filter controls, the roll + chat feed, the typing
 * line and the chat composer, plus the on-demand player-detail card and
 * image lightbox.
 */
export function ActivityPanel({ session, onNotice }: Props) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<FeedFilter>('all')
  // The feed entry whose name was tapped, opening the player-detail card.
  const [detail, setDetail] = useState<FeedDetailTarget | null>(null)
  // Index (within `images`) of the picture open in the lightbox.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const feed = useMemo(
    () => buildFeed(session.history, session.chat, session.markers, filter),
    [session.history, session.chat, session.markers, filter],
  )

  // Image attachments in the feed, in order — the lightbox steps through these.
  const images = useMemo(() => {
    const list: ChatFile[] = []
    for (const item of feed) {
      if (item.kind === 'chat' && item.message.file && isImageType(item.message.file.type)) {
        list.push(item.message.file)
      }
    }
    return list
  }, [feed])

  // Items older than the most recent room exit belong to a room left behind.
  const lastExitAt = useMemo(
    () =>
      session.markers
        .filter((m) => isRoomExitMarker(m.type))
        .reduce((max, m) => Math.max(max, m.timestamp), 0),
    [session.markers],
  )

  // openLightbox only changes when the image set does (i.e. when the feed
  // changes anyway), so memoized feed items are not re-rendered needlessly.
  const openLightbox = useCallback(
    (file: ChatFile) => {
      const i = images.indexOf(file)
      setLightboxIndex(i >= 0 ? i : 0)
    },
    [images],
  )
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  // Clearing the feed is destructive, so require a deliberate confirmation.
  const clearFeed = () => {
    if (window.confirm(t('feed.clearConfirm'))) session.clearFeed()
  }

  const typing = session.typingNames
  const typingLine =
    typing.length === 0
      ? ''
      : t(typing.length === 1 ? 'typing.one' : 'typing.many', { names: typing.join(', ') })

  return (
    <section className="panel activity">
      <div className="panel-head">
        <h2>{t('feed.section')}</h2>
        <div className="feed-tools">
          <div className="feed-filter" role="group" aria-label={t('feed.section')}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={f === filter ? 'filter-btn active' : 'filter-btn'}
                aria-pressed={f === filter}
                onClick={() => setFilter(f)}
              >
                {t(`feed.${f}`)}
              </button>
            ))}
          </div>
          {feed.length > 0 && (
            <button type="button" className="link feed-clear" onClick={clearFeed}>
              {t('feed.clear')}
            </button>
          )}
        </div>
      </div>

      <FeedList
        feed={feed}
        lastExitAt={lastExitAt}
        playerId={session.playerId}
        isGM={session.isGM}
        onOpenDetail={setDetail}
        onOpenImage={openLightbox}
      />

      <p className="typing-line" aria-live="polite">
        {typingLine}
      </p>

      {filter !== 'rolls' && <ChatComposer session={session} onNotice={onNotice} />}

      {detail && (
        <Sheet onClose={() => setDetail(null)}>
          <PlayerDetailCard
            player={session.players.find((p) => p.id === detail.playerId) ?? null}
            playerId={detail.playerId}
            displayName={detail.name}
            characterName={detail.characterName}
            background={detail.background}
            isSelf={detail.playerId === session.playerId}
          />
        </Sheet>
      )}

      {lightboxIndex !== null && images[lightboxIndex] && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </section>
  )
}
