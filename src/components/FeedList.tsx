import { Fragment, memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useTranslatedText } from '../i18n/useTranslatedText'
import type { TFn } from '../i18n/context'
import type { FeedItem, SystemMarker } from '../feed/feed'
import { formatClock, formatFeedDate, sameDay } from '../feed/datetime'
import type { ChatFile, ChatMessage } from '../net/protocol'
import type { RollResult } from '../dice/types'
import { playerColor } from '../players/colors'
import { feedName } from '../players/identity'
import { formatDiceSummary, formatRollText } from '../dice/format'
import { ChatAttachment } from './ChatAttachment'
import { DiceFaceIcon } from './DiceFaceIcon'

/** Identity snapshot opened in the player-detail card when a name is tapped. */
export interface FeedDetailTarget {
  playerId: string
  name: string
  characterName: string
  background: string
}

/** A new entry within this many px of the bottom still auto-scrolls. */
const STICK_THRESHOLD = 64

function markerText(t: TFn, marker: SystemMarker): string {
  return t(`marker.${marker.type}`, {
    code: marker.roomCode ?? '',
    name: marker.playerName ?? '',
  })
}

const FeedSystemItem = memo(function FeedSystemItem({
  marker,
  count,
  archived,
}: {
  marker: SystemMarker
  /** How many identical consecutive markers this row stands for (≥1). */
  count: number
  archived: boolean
}) {
  const { t } = useI18n()
  const text = markerText(t, marker)
  return (
    <li className={`feed-system${archived ? ' archived' : ''}`}>
      <span>{count > 1 ? `${text} (${count})` : text}</span>
    </li>
  )
})

/**
 * Circular avatar shown next to each feed item — the character portrait
 * when one is set, otherwise a flat player-color disc. Memoized so a
 * stable image / color does not invalidate the parent item.
 */
const FeedAvatar = memo(function FeedAvatar({
  image,
  color,
  name,
}: {
  image: string | undefined
  color: string
  name: string
}) {
  if (image) {
    return (
      <span className="feed-avatar" aria-hidden="true">
        <img src={image} alt="" />
      </span>
    )
  }
  return (
    <span className="feed-avatar feed-avatar-dot" style={{ background: color }} aria-hidden="true">
      <span className="visually-hidden">{name}</span>
    </span>
  )
})

const FeedChatItem = memo(function FeedChatItem({
  message: m,
  archived,
  pending,
  compact,
  playerId,
  characterImages,
  onOpenDetail,
  onOpenImage,
}: {
  message: ChatMessage
  archived: boolean
  /** A message still queued for an offline GM — shown but not yet sent. */
  pending?: boolean
  /** The compact feed shows just the character name, no player-color dot. */
  compact: boolean
  playerId: string
  /** Map of `${playerId}|${characterName}` → latest image observed for
   *  that character. Lets a feed item keep the right avatar after the
   *  speaking player has switched away from that character. */
  characterImages: Record<string, string>
  onOpenDetail: (target: FeedDetailTarget) => void
  onOpenImage: (file: ChatFile) => void
}) {
  const { t, autoTranslate } = useI18n()
  const own = m.playerId === playerId
  const color = playerColor(m.playerId)
  // Highlight the message for a player it @mentions (or for everyone when it
  // is an @all). Id-based, so the highlight survives a rename.
  const mentionsMe = (m.mentionsAll ?? false) || (m.mentions ?? []).includes(playerId)
  // Auto-translation: show the original, swap in the translation when it is
  // ready, and let the reader flip back to the original.
  const { translated, translating } = useTranslatedText(m.text, m.lang)
  const [showOriginal, setShowOriginal] = useState(false)
  const showTranslation = autoTranslate && translated !== null && !showOriginal
  return (
    <li
      className={`feed-chat${own ? ' own' : ''}${mentionsMe ? ' mentioned' : ''}${
        archived ? ' archived' : ''
      }${pending ? ' pending' : ''}`}
    >
      <FeedAvatar
        image={characterImages[`${m.playerId}|${m.characterName ?? ''}`]}
        color={color}
        name={m.playerName}
      />
      <div className="feed-bubble">
        <div className="feed-line">
          <span className="player-dot" style={{ background: color }} />
          <button
            type="button"
            className="feed-name"
            style={{ color }}
            onClick={() =>
              onOpenDetail({
                playerId: m.playerId,
                name: m.playerName,
                characterName: m.characterName ?? '',
                background: m.background ?? '',
              })
            }
          >
            {feedName(m.playerName, m.characterName ?? '', compact)}
          </button>
          {m.isGM && <span className="badge gm">{t('room.gmBadge')}</span>}
          {pending ? (
            <span className="pending-tag">{t('chat.pending')}</span>
          ) : (
            <time>{formatClock(new Date(m.timestamp))}</time>
          )}
        </div>
        {m.text && (
          <p className={`chat-text${translating ? ' translating' : ''}`}>
            {showTranslation ? translated : m.text}
          </p>
        )}
        {/* The original / translation toggle sits with the message it flips. */}
        {autoTranslate && translated !== null && (
          <button
            type="button"
            className="link chat-trans-toggle"
            onClick={() => setShowOriginal((v) => !v)}
          >
            {showOriginal ? t('chat.viewTranslation') : t('chat.viewOriginal')}
          </button>
        )}
        {m.file && <ChatAttachment file={m.file} onOpenImage={onOpenImage} />}
      </div>
    </li>
  )
})

const FeedRollItem = memo(function FeedRollItem({
  roll: r,
  archived,
  isGM,
  compact,
  playerId,
  characterImages,
  onOpenDetail,
}: {
  roll: RollResult
  archived: boolean
  isGM: boolean
  /** The compact feed shows just the character name, no player-color dot. */
  compact: boolean
  playerId: string
  characterImages: Record<string, string>
  onOpenDetail: (target: FeedDetailTarget) => void
}) {
  const { t } = useI18n()
  const canSee = isGM || !r.hidden
  const isHidden = r.hidden && !canSee
  const own = r.playerId === playerId
  const color = playerColor(r.playerId)
  const fullName = r.playerName || t('player.anon')
  return (
    <li
      className={`feed-roll roll ${isHidden ? 'hidden' : r.kind}${own ? ' own' : ''}${archived ? ' archived' : ''}`}
    >
      <FeedAvatar
        image={characterImages[`${r.playerId}|${r.characterName ?? ''}`]}
        color={color}
        name={fullName}
      />
      <div className="feed-bubble">
        <div className="feed-line">
          <span className="player-dot" style={{ background: color }} />
          <button
            type="button"
            className="feed-name"
            style={{ color }}
            onClick={() =>
              onOpenDetail({
                playerId: r.playerId,
                name: fullName,
                characterName: r.characterName ?? '',
                background: r.background ?? '',
              })
            }
          >
            {feedName(fullName, r.characterName ?? '', compact)}
          </button>
          {r.isGM && <span className="badge gm">{t('room.gmBadge')}</span>}
          <time>{formatClock(new Date(r.timestamp))}</time>
        </div>
        <p className="roll-text">{formatRollText(t, r, canSee)}</p>
        {!isHidden && (
          <p className="roll-detail">
            {formatDiceSummary(r.diceCount, r.diceType, r.modifier)}
            {' · '}
            {t('result.faces')}:{' '}
            <span className="face-list" aria-hidden="true">
              {r.faces.map((v, i) => (
                <DiceFaceIcon key={i} diceType={r.diceType} value={v} />
              ))}
            </span>
            {/* The icons are decorative; this readable summary is what AT
                actually announces. */}
            <span className="visually-hidden">{r.faces.join(', ')}</span>
            {r.hidden && isGM && ' 🔒'}
          </p>
        )}
      </div>
    </li>
  )
})

interface Props {
  feed: FeedItem[]
  /** Entries before this timestamp belong to a room the player has left. */
  lastExitAt: number
  playerId: string
  isGM: boolean
  /** Denser layout: one-line entries, no player-color dot, character name only. */
  compact: boolean
  /** Whether more history can be paged in above the current oldest entry. */
  hasOlder: boolean
  onLoadOlder: () => void
  /** Chat queued for an offline GM, shown as pending below the feed. */
  pending: ChatMessage[]
  /** Character portraits keyed by `${playerId}|${characterName}` — used
   *  for the per-message avatar so a feed entry keeps the right portrait
   *  after the speaker has switched to a different character. */
  characterImages: Record<string, string>
  onOpenDetail: (target: FeedDetailTarget) => void
  onOpenImage: (file: ChatFile) => void
  /** Overrides the default "nothing here yet" hint when the feed is empty. */
  emptyState?: ReactNode
}

/** The scrollable roll + chat timeline. */
export function FeedList({
  feed,
  lastExitAt,
  playerId,
  isGM,
  compact,
  hasOlder,
  onLoadOlder,
  pending,
  characterImages,
  onOpenDetail,
  onOpenImage,
  emptyState,
}: Props) {
  const { t, lang } = useI18n()
  const listRef = useRef<HTMLUListElement>(null)
  // Whether the player is at the bottom — only then does a new entry scroll.
  const stuckToBottom = useRef(true)

  useEffect(() => {
    const el = listRef.current
    if (el && stuckToBottom.current) el.scrollTop = el.scrollHeight
  }, [feed.length, pending.length])

  const onScroll = () => {
    const el = listRef.current
    if (el) {
      stuckToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
    }
  }

  return (
    <ul className="feed" ref={listRef} onScroll={onScroll}>
      {feed.length === 0 &&
        (emptyState != null ? (
          <li className="feed-empty">{emptyState}</li>
        ) : (
          <li className="hint feed-empty">{t('feed.empty')}</li>
        ))}
      {hasOlder && (
        <li className="feed-load-older">
          <button type="button" className="link" onClick={onLoadOlder}>
            {t('feed.loadOlder')}
          </button>
        </li>
      )}
      {feed.map((item, i) => {
        const archived = item.at < lastExitAt
        // A divider carrying the date opens the feed and marks each day change.
        const prev = i > 0 ? feed[i - 1] : null
        const newDay = !prev || !sameDay(new Date(prev.at), new Date(item.at))
        let node
        if (item.kind === 'system') {
          node = <FeedSystemItem marker={item.marker} count={item.count} archived={archived} />
        } else if (item.kind === 'chat') {
          node = (
            <FeedChatItem
              message={item.message}
              archived={archived}
              compact={compact}
              playerId={playerId}
              characterImages={characterImages}
              onOpenDetail={onOpenDetail}
              onOpenImage={onOpenImage}
            />
          )
        } else {
          node = (
            <FeedRollItem
              roll={item.roll}
              archived={archived}
              isGM={isGM}
              compact={compact}
              playerId={playerId}
              characterImages={characterImages}
              onOpenDetail={onOpenDetail}
            />
          )
        }
        return (
          <Fragment key={item.id}>
            {newDay && (
              <li className="feed-date">
                <span>{formatFeedDate(new Date(item.at), lang)}</span>
              </li>
            )}
            {node}
          </Fragment>
        )
      })}
      {pending.map((m) => (
        <FeedChatItem
          key={`pending-${m.id}`}
          message={m}
          archived={false}
          pending
          compact={compact}
          playerId={playerId}
          characterImages={characterImages}
          onOpenDetail={onOpenDetail}
          onOpenImage={onOpenImage}
        />
      ))}
    </ul>
  )
}
