import { memo, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useTranslatedText } from '../i18n/useTranslatedText'
import type { TFn } from '../i18n/context'
import type { FeedItem, SystemMarker } from '../feed/feed'
import type { ChatFile, ChatMessage } from '../net/protocol'
import type { RollResult } from '../dice/types'
import { playerColor } from '../players/colors'
import { feedName } from '../players/identity'
import { formatDiceSummary, formatRollText } from '../dice/format'
import { ChatAttachment } from './ChatAttachment'

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
  archived,
}: {
  marker: SystemMarker
  archived: boolean
}) {
  const { t } = useI18n()
  return (
    <li className={`feed-system${archived ? ' archived' : ''}`}>
      <span>{markerText(t, marker)}</span>
    </li>
  )
})

const FeedChatItem = memo(function FeedChatItem({
  message: m,
  archived,
  pending,
  compact,
  playerId,
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
  onOpenDetail: (target: FeedDetailTarget) => void
  onOpenImage: (file: ChatFile) => void
}) {
  const { t, lang, autoTranslate } = useI18n()
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
        {autoTranslate && translated !== null && (
          <button
            type="button"
            className="link chat-trans-toggle"
            onClick={() => setShowOriginal((v) => !v)}
          >
            {showOriginal ? t('chat.viewTranslation') : t('chat.viewOriginal')}
          </button>
        )}
        {pending ? (
          <span className="pending-tag">{t('chat.pending')}</span>
        ) : (
          <time>{new Date(m.timestamp).toLocaleTimeString(lang)}</time>
        )}
      </div>
      {m.text && (
        <p className={`chat-text${translating ? ' translating' : ''}`}>
          {showTranslation ? translated : m.text}
        </p>
      )}
      {m.file && <ChatAttachment file={m.file} onOpenImage={onOpenImage} />}
    </li>
  )
})

const FeedRollItem = memo(function FeedRollItem({
  roll: r,
  archived,
  isGM,
  compact,
  onOpenDetail,
}: {
  roll: RollResult
  archived: boolean
  isGM: boolean
  /** The compact feed shows just the character name, no player-color dot. */
  compact: boolean
  onOpenDetail: (target: FeedDetailTarget) => void
}) {
  const { t, lang } = useI18n()
  const canSee = isGM || !r.hidden
  const isHidden = r.hidden && !canSee
  const color = playerColor(r.playerId)
  const fullName = r.playerName || t('player.anon')
  return (
    <li className={`feed-roll roll ${isHidden ? 'hidden' : r.kind}${archived ? ' archived' : ''}`}>
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
        <time>{new Date(r.timestamp).toLocaleTimeString(lang)}</time>
      </div>
      <p className="roll-text">{formatRollText(t, r, canSee)}</p>
      {!isHidden && (
        <p className="roll-detail">
          {formatDiceSummary(r.diceCount, r.diceType, r.modifier)}
          {' · '}
          {t('result.faces')}: [{r.faces.join(', ')}]
          {r.hidden && isGM && ' 🔒'}
        </p>
      )}
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
  onOpenDetail: (target: FeedDetailTarget) => void
  onOpenImage: (file: ChatFile) => void
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
  onOpenDetail,
  onOpenImage,
}: Props) {
  const { t } = useI18n()
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
      {feed.length === 0 && <li className="hint feed-empty">{t('feed.empty')}</li>}
      {hasOlder && (
        <li className="feed-load-older">
          <button type="button" className="link" onClick={onLoadOlder}>
            {t('feed.loadOlder')}
          </button>
        </li>
      )}
      {feed.map((item) => {
        const archived = item.at < lastExitAt
        if (item.kind === 'system') {
          return <FeedSystemItem key={item.id} marker={item.marker} archived={archived} />
        }
        if (item.kind === 'chat') {
          return (
            <FeedChatItem
              key={item.id}
              message={item.message}
              archived={archived}
              compact={compact}
              playerId={playerId}
              onOpenDetail={onOpenDetail}
              onOpenImage={onOpenImage}
            />
          )
        }
        return (
          <FeedRollItem
            key={item.id}
            roll={item.roll}
            archived={archived}
            isGM={isGM}
            compact={compact}
            onOpenDetail={onOpenDetail}
          />
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
          onOpenDetail={onOpenDetail}
          onOpenImage={onOpenImage}
        />
      ))}
    </ul>
  )
}
