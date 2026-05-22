import { Fragment, memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useTranslatedText } from '../i18n/useTranslatedText'
import type { TFn } from '../i18n/context'
import { speakerImageKey, type FeedItem, type SystemMarker } from '../feed/feed'
import { formatClock, formatFeedDate, sameDay } from '../feed/datetime'
import type { ChatFile, ChatMessage } from '../net/protocol'
import type { RollResult } from '../dice/types'
import { playerColor } from '../players/colors'
import { feedName } from '../players/identity'
import { formatDiceSummary, formatRollText } from '../dice/format'
import type { SessionCharacterDraft } from '../storage/roomLog'
import { ChatAttachment } from './ChatAttachment'
import { ChevronDownIcon } from './icons'
import { DiceFaceIcon } from './DiceFaceIcon'

/** The pair tapped in the feed when a name is clicked. The player-detail
 *  card joins it back to the per-(player, character) record in
 *  `sessionCharacters` to render the name / background / portrait. */
export interface FeedDetailTarget {
  playerId: string
  /** Active character id at the time of the entry. Empty when the
   *  speaker was acting as the player directly. */
  characterId: string
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
 * when one is set, otherwise a flat player-color disc. The avatar is
 * purely decorative (the speaker-name button right next to it is the
 * announced source), so the wrappers stay `aria-hidden` without any
 * hidden text inside that AT would never reach. Memoized so a stable
 * image / color does not invalidate the parent item.
 */
/** First user-perceived character of a name — Unicode-aware so a
 *  surrogate-pair emoji or a combining-mark glyph stays intact. Used
 *  as the fallback avatar label when no portrait has been set. */
function avatarInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  return [...trimmed][0] ?? ''
}

const FeedAvatar = memo(function FeedAvatar({
  image,
  color,
  initial,
  isGM,
}: {
  image: string | undefined
  color: string
  /** Single-character fallback drawn over the colour dot when no
   *  portrait has been set. Empty string falls back to a blank dot. */
  initial: string
  /** GM-flagged speakers get a `--gm`-coloured ring around the avatar
   *  so the role reads at a glance even when the badge text scrolls
   *  off screen (compact view) or competes for attention with the
   *  bubble's own kind-coloured top border. */
  isGM: boolean
}) {
  const className = `feed-avatar${isGM ? ' feed-avatar-gm' : ''}`
  if (image) {
    return (
      <span className={className} aria-hidden="true">
        <img src={image} alt="" />
      </span>
    )
  }
  return (
    <span
      className={`${className} feed-avatar-dot`}
      style={{ background: color }}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
})

const FeedChatItem = memo(function FeedChatItem({
  message: m,
  speaker,
  archived,
  pending,
  compact,
  playerId,
  onOpenDetail,
  onOpenImage,
}: {
  message: ChatMessage
  /** Per-(player, character) record resolved by the parent. Undefined
   *  when the session has not observed this (player, character) pair
   *  yet (a brand-new entry, or a record pruned out). */
  speaker: SessionCharacterDraft | undefined
  archived: boolean
  /** A message still queued for an offline GM — shown but not yet sent. */
  pending?: boolean
  /** The compact feed shows just the character name, no player-color dot. */
  compact: boolean
  playerId: string
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
  // Fall back to the localized anon label when no per-character record
  // has been observed yet (a brand-new entry, a pruned row, or a
  // legacy entry that normalize couldn't pin to a row) so the
  // speaker-name button never renders blank.
  const displayName = speaker?.playerName || t('player.anon')
  const characterName = speaker?.characterName ?? ''
  const speakerIsGM = speaker?.isGM ?? false
  const image = speaker?.image || undefined
  // Fallback initial — prefer character name (the in-character voice
  // shown in the feed); fall back to player name when the speaker is
  // acting as themselves; fall back to the localised anon label when
  // both are blank so the dot still has something legible.
  const initial = avatarInitial(characterName || displayName)
  return (
    <li
      className={`feed-chat${own ? ' own' : ''}${mentionsMe ? ' mentioned' : ''}${
        archived ? ' archived' : ''
      }${pending ? ' pending' : ''}`}
    >
      {!compact && (
        <FeedAvatar image={image} color={color} initial={initial} isGM={speakerIsGM} />
      )}
      <div className="feed-bubble">
        <div className="feed-line">
          <button
            type="button"
            className="feed-name"
            style={{ color }}
            onClick={() =>
              onOpenDetail({
                playerId: m.playerId,
                characterId: m.characterId ?? '',
              })
            }
          >
            {feedName(displayName, characterName, compact)}
          </button>
          {speakerIsGM && <span className="badge gm">{t('room.gmBadge')}</span>}
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
  speaker,
  archived,
  isGM,
  compact,
  playerId,
  onOpenDetail,
}: {
  roll: RollResult
  speaker: SessionCharacterDraft | undefined
  archived: boolean
  isGM: boolean
  /** The compact feed shows just the character name, no player-color dot. */
  compact: boolean
  playerId: string
  onOpenDetail: (target: FeedDetailTarget) => void
}) {
  const { t } = useI18n()
  const canSee = isGM || !r.hidden
  const isHidden = r.hidden && !canSee
  const own = r.playerId === playerId
  const color = playerColor(r.playerId)
  const displayName = speaker?.playerName || t('player.anon')
  const characterName = speaker?.characterName ?? ''
  const speakerIsGM = speaker?.isGM ?? false
  const image = speaker?.image || undefined
  const initial = avatarInitial(characterName || displayName)
  return (
    <li
      className={`feed-roll roll ${isHidden ? 'hidden' : r.kind}${own ? ' own' : ''}${archived ? ' archived' : ''}`}
    >
      {!compact && (
        <FeedAvatar image={image} color={color} initial={initial} isGM={speakerIsGM} />
      )}
      <div className="feed-bubble">
        <div className="feed-line">
          <button
            type="button"
            className="feed-name"
            style={{ color }}
            onClick={() =>
              onOpenDetail({
                playerId: r.playerId,
                characterId: r.characterId ?? '',
              })
            }
          >
            {feedName(displayName, characterName, compact)}
          </button>
          {speakerIsGM && <span className="badge gm">{t('room.gmBadge')}</span>}
          <time>{formatClock(new Date(r.timestamp))}</time>
        </div>
        <p className="roll-text">{formatRollText(t, r, canSee, displayName)}</p>
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
  /** Per-(player, character) records keyed by `${playerId}|${characterId}`.
   *  The feed renders speaker name / character name / background / GM
   *  mark / portrait from the record matching the entry's `characterId`
   *  (with `legacyCharacterIdFromName` fallback for older entries). */
  sessionCharacters: Record<string, SessionCharacterDraft | undefined>
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
  sessionCharacters,
  onOpenDetail,
  onOpenImage,
  emptyState,
}: Props) {
  const { t, lang } = useI18n()
  const listRef = useRef<HTMLUListElement>(null)
  // Whether the player is at the bottom — only then does a new entry scroll.
  const stuckToBottom = useRef(true)
  // Mirrored as state so the "jump to latest" button can render only
  // when the player has scrolled away from the bottom. The ref above is
  // still the one consulted on every new entry (avoids the extra
  // render cycle a setState would add to every scroll tick).
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    const el = listRef.current
    if (el && stuckToBottom.current) el.scrollTop = el.scrollHeight
  }, [feed.length, pending.length])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
    stuckToBottom.current = isAtBottom
    setAtBottom(isAtBottom)
  }

  const jumpToLatest = () => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  return (
    <div className="feed-wrap">
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
              speaker={sessionCharacters[speakerImageKey(item.message)]}
              archived={archived}
              compact={compact}
              playerId={playerId}
              onOpenDetail={onOpenDetail}
              onOpenImage={onOpenImage}
            />
          )
        } else {
          node = (
            <FeedRollItem
              roll={item.roll}
              speaker={sessionCharacters[speakerImageKey(item.roll)]}
              archived={archived}
              isGM={isGM}
              compact={compact}
              playerId={playerId}
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
          speaker={sessionCharacters[speakerImageKey(m)]}
          archived={false}
          pending
          compact={compact}
          playerId={playerId}
          onOpenDetail={onOpenDetail}
          onOpenImage={onOpenImage}
        />
      ))}
    </ul>
    {!atBottom && (
      <button
        type="button"
        className="feed-jump-latest"
        aria-label={t('feed.jumpToLatest')}
        title={t('feed.jumpToLatest')}
        onClick={jumpToLatest}
      >
        <ChevronDownIcon />
      </button>
    )}
    </div>
  )
}
