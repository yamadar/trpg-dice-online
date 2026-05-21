import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { Session } from '../hooks/useSession'
import { buildFeed, isRoomExitMarker, type FeedFilter, type SystemMarker } from '../feed/feed'
import { isImageType } from '../chat/attachment'
import type { ChatFile, ChatMessage } from '../net/protocol'
import type { RollResult } from '../dice/types'
import { loadFullLog } from '../storage/roomLog'
import { Sheet } from './Sheet'
import { PlayerDetailCard } from './PlayerDetailCard'
import { Lightbox } from './Lightbox'
import { FeedList, type FeedDetailTarget } from './FeedList'
import { ChatComposer } from './ChatComposer'
import { BrandIcon, TrashIcon } from './icons'

const FILTERS: FeedFilter[] = ['all', 'rolls', 'chat', 'files']

/** Room history paged in on demand from the durable log. */
interface OlderEntries {
  history: RollResult[]
  chat: ChatMessage[]
  markers: SystemMarker[]
}
const EMPTY_OLDER: OlderEntries = { history: [], chat: [], markers: [] }

/** Only offer "load older" once the live window is plausibly full. */
const FEED_WINDOW = 200

interface Props {
  session: Session
  /** Denser feed layout; the toggle for it lives in the settings menu. */
  compact: boolean
  /** Surfaces attachment errors as a toast. */
  onNotice: (message: string, kind?: 'success' | 'error') => void
  /** Opens the Room sheet; surfaced from the empty-feed CTA when offline. */
  onOpenRoom: () => void
}

/**
 * The dominant view: filter controls, the roll + chat feed, the typing
 * line and the chat composer, plus the on-demand player-detail card and
 * image lightbox. Older history (beyond the live window) is paged in from
 * the durable log on demand.
 */
export function ActivityPanel({ session, compact, onNotice, onOpenRoom }: Props) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<FeedFilter>('all')
  // The feed entry whose name was tapped, opening the player-detail card.
  const [detail, setDetail] = useState<FeedDetailTarget | null>(null)
  // Index (within `images`) of the picture open in the lightbox.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  // Room history paged in from the durable log on demand. It overlaps the
  // live window; buildFeed de-duplicates the two by entry id.
  const [older, setOlder] = useState<OlderEntries>(EMPTY_OLDER)
  const [reachedOldest, setReachedOldest] = useState(false)

  // A room change (enter / leave) resets the paged-in history. Keyed by the
  // session id, so a mid-room code change keeps the paged-in log. This
  // adjusts state during render — the pattern React recommends over an
  // effect for "reset some state when a prop changes".
  const [olderSession, setOlderSession] = useState(session.sessionId)
  if (olderSession !== session.sessionId) {
    setOlderSession(session.sessionId)
    setOlder(EMPTY_OLDER)
    setReachedOldest(false)
  }

  const feed = useMemo(
    () =>
      buildFeed(
        [...older.history, ...session.history],
        [...older.chat, ...session.chat],
        [...older.markers, ...session.markers],
        filter,
      ),
    [older, session.history, session.chat, session.markers, filter],
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
  const lastExitAt = useMemo(() => {
    let max = 0
    for (const m of [...older.markers, ...session.markers]) {
      if (isRoomExitMarker(m.type)) max = Math.max(max, m.timestamp)
    }
    return max
  }, [older.markers, session.markers])

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

  // Page the full room history in from the durable log. The live window
  // caps rolls / chat / markers separately, so it is not a clean tail — a
  // marker can outlive the chat around it, leaving internal gaps an
  // "older than X" cursor cannot fill. Rooms hold at most ~1000 entries,
  // so loading the whole log in one go is both simple and exact.
  const loadOlder = useCallback(async () => {
    const sid = session.sessionId
    if (!sid) return
    const entries = await loadFullLog(sid)
    setOlder({
      history: entries.filter((e) => e.kind === 'roll').map((e) => e.data as RollResult),
      chat: entries.filter((e) => e.kind === 'chat').map((e) => e.data as ChatMessage),
      markers: entries.filter((e) => e.kind === 'marker').map((e) => e.data as SystemMarker),
    })
    setReachedOldest(true)
  }, [session.sessionId])

  // Clearing the feed is destructive, so require a deliberate confirmation.
  const clearFeed = () => {
    if (window.confirm(t('feed.clearConfirm'))) {
      session.clearFeed()
      setOlder(EMPTY_OLDER)
      setReachedOldest(false)
    }
  }

  const typing = session.typingNames
  const typingLine =
    typing.length === 0
      ? ''
      : t(typing.length === 1 ? 'typing.one' : 'typing.many', { names: typing.join(', ') })

  // Older history can only come from a room's durable log, and only once
  // the live window is full enough to plausibly have dropped entries.
  const hasOlder = session.sessionId !== null && !reachedOldest && feed.length >= FEED_WINDOW

  // Messages queued for an offline GM belong with chat — hidden in rolls view.
  const pending = filter === 'all' || filter === 'chat' ? session.outbox : []

  // When the player is not in a room and the feed is empty, replace the
  // default hint with a card that nudges them toward "Room". In a room or
  // when filtering hides existing entries, keep the plain default hint.
  const offlineEmpty = session.role === 'offline' && filter === 'all'
  const emptyState = offlineEmpty ? (
    <div className="feed-empty-card">
      <p className="feed-empty-brand brand-heading gradient-heading">
        <BrandIcon className="brand-mark" />
        <span>{t('app.title')}</span>
      </p>
      <p className="feed-empty-title">{t('feed.empty')}</p>
      <p className="feed-empty-hint">{t('feed.emptyRollHint')}</p>
      <p className="feed-empty-hint">{t('feed.emptyShareHint')}</p>
      <button type="button" className="primary feed-empty-cta" onClick={onOpenRoom}>
        {t('feed.emptyOpenRoom')}
      </button>
    </div>
  ) : undefined

  return (
    <section className={`panel activity${compact ? ' compact' : ''}`}>
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
            <button
              type="button"
              className="icon-btn feed-clear"
              onClick={clearFeed}
              aria-label={t('feed.clear')}
              title={t('feed.clear')}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      <FeedList
        feed={feed}
        lastExitAt={lastExitAt}
        playerId={session.playerId}
        isGM={session.isGM}
        compact={compact}
        hasOlder={hasOlder}
        onLoadOlder={loadOlder}
        pending={pending}
        onOpenDetail={setDetail}
        onOpenImage={openLightbox}
        emptyState={emptyState}
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
            image={session.playerImages[detail.playerId]}
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
