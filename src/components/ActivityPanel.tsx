import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { TFn } from '../i18n/context'
import type { Session } from '../hooks/useSession'
import {
  buildFeed,
  isRoomExitMarker,
  type FeedFilter,
  type SystemMarker,
} from '../feed/feed'
import { playerColor } from '../players/colors'
import { formatDiceSummary, formatRollText } from '../dice/format'
import { Sheet } from './Sheet'
import { PlayerDetailCard } from './PlayerDetailCard'
import { ChatAttachment } from './ChatAttachment'
import { Lightbox } from './Lightbox'
import { CloseIcon } from './icons'
import type { ChatFile } from '../net/protocol'
import { MAX_ATTACHMENT_BYTES, formatBytes, isImageType, readAttachment } from '../chat/attachment'
import { applyMention, mentionQuery, resolveMentions } from '../chat/mentions'

/** An entry in the @mention autocomplete list. */
type MentionSuggestion = { kind: 'all' } | { kind: 'player'; id: string; name: string }

/** How many autocomplete suggestions to show at once. */
const MAX_SUGGESTIONS = 6

const FILTERS: FeedFilter[] = ['all', 'rolls', 'chat', 'files']

function markerText(t: TFn, marker: SystemMarker): string {
  return t(`marker.${marker.type}`, {
    code: marker.roomCode ?? '',
    name: marker.playerName ?? '',
  })
}

interface Props {
  session: Session
  /** Surfaces attachment errors as a toast. */
  onNotice: (message: string, kind?: 'success' | 'error') => void
}

/** Combined roll history + chat timeline with a per-view filter. */
export function ActivityPanel({ session, onNotice }: Props) {
  const { t, lang } = useI18n()
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [text, setText] = useState('')
  // The feed entry whose name was tapped, opening the player-detail card.
  // The character snapshot is taken from the tapped entry, so it shows the
  // character used at that time even if the player has since switched.
  const [detail, setDetail] = useState<{
    playerId: string
    name: string
    characterName: string
    background: string
  } | null>(null)
  // A file picked but not yet sent, and the index (within `images`) of the
  // image currently open in the lightbox.
  const [pending, setPending] = useState<ChatFile | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  // The in-progress @mention the caret sits in, driving the autocomplete.
  const [mention, setMention] = useState<{ query: string; start: number; selected: number } | null>(
    null,
  )
  const listRef = useRef<HTMLUListElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  const feed = useMemo(
    () => buildFeed(session.history, session.chat, session.markers, filter),
    [session.history, session.chat, session.markers, filter],
  )

  // Image attachments in the feed, in order — the lightbox steps through
  // these with the arrow keys / swipes.
  const images = useMemo(() => {
    const list: ChatFile[] = []
    for (const item of feed) {
      if (item.kind === 'chat' && item.message.file && isImageType(item.message.file.type)) {
        list.push(item.message.file)
      }
    }
    return list
  }, [feed])

  const openLightbox = (file: ChatFile) => {
    const i = images.indexOf(file)
    setLightboxIndex(i >= 0 ? i : 0)
  }
  // Stable so the Lightbox keydown effect does not rebind every render.
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  // Items older than the most recent room exit belong to a room left behind.
  const lastExitAt = useMemo(
    () =>
      session.markers
        .filter((m) => isRoomExitMarker(m.type))
        .reduce((max, m) => Math.max(max, m.timestamp), 0),
    [session.markers],
  )

  // Keep the newest entry in view as the feed grows.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [feed.length])

  // Autocomplete options for the current @token: an "everyone" entry plus
  // matching players (self excluded).
  const suggestions = useMemo<MentionSuggestion[]>(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    const list: MentionSuggestion[] = []
    if ('all'.startsWith(q)) list.push({ kind: 'all' })
    for (const p of session.players) {
      if (p.id === session.playerId) continue
      const name = p.name.trim()
      if (name && name.toLowerCase().includes(q)) {
        list.push({ kind: 'player', id: p.id, name })
      }
    }
    return list.slice(0, MAX_SUGGESTIONS)
  }, [mention, session.players, session.playerId])

  const send = () => {
    if (!text.trim() && !pending) return
    const { ids, all } = resolveMentions(text, session.players)
    session.sendChat(text, pending ?? undefined, ids, all)
    setText('')
    setPending(null)
    setMention(null)
  }

  // Recompute the @mention autocomplete from the input value and caret.
  const refreshMention = (value: string, cursor: number) => {
    const q = mentionQuery(value, cursor)
    setMention(q ? { query: q.query, start: q.start, selected: 0 } : null)
  }

  const onType = (value: string, cursor: number) => {
    setText(value)
    session.sendTyping()
    refreshMention(value, cursor)
  }

  // Insert the picked suggestion as "@label " and return focus to the input.
  const pickSuggestion = (s: MentionSuggestion) => {
    if (!mention) return
    const label = s.kind === 'all' ? 'all' : s.name
    const next = applyMention(text, mention.start, mention.query, label)
    setText(next.text)
    setMention(null)
    requestAnimationFrame(() => {
      const el = chatInputRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(next.cursor, next.cursor)
      }
    })
  }

  // Read a picked file into a sendable attachment (images are downscaled).
  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setAttaching(true)
    try {
      const result = await readAttachment(file)
      if (result.ok) {
        setPending(result.file)
      } else if (result.error === 'tooLarge') {
        onNotice(t('chat.attachTooLarge', { max: formatBytes(MAX_ATTACHMENT_BYTES) }), 'error')
      } else {
        onNotice(t('chat.attachFailed'), 'error')
      }
    } finally {
      setAttaching(false)
    }
  }

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

      <ul className="feed" ref={listRef}>
        {feed.length === 0 && <li className="hint feed-empty">{t('feed.empty')}</li>}

        {feed.map((item) => {
          const archived = item.at < lastExitAt ? ' archived' : ''

          if (item.kind === 'system') {
            return (
              <li key={item.id} className={`feed-system${archived}`}>
                <span>{markerText(t, item.marker)}</span>
              </li>
            )
          }

          if (item.kind === 'chat') {
            const m = item.message
            const own = m.playerId === session.playerId
            const color = playerColor(m.playerId)
            // Highlight the message for a player it @mentions (or for
            // everyone when it is an @all). Id-based, so it survives renames.
            const mentionsMe =
              (m.mentionsAll ?? false) || (m.mentions ?? []).includes(session.playerId)
            return (
              <li
                key={item.id}
                className={`feed-chat${own ? ' own' : ''}${mentionsMe ? ' mentioned' : ''}${archived}`}
              >
                <div className="feed-line">
                  <span className="player-dot" style={{ background: color }} />
                  <button
                    type="button"
                    className="feed-name"
                    style={{ color }}
                    onClick={() =>
                      setDetail({
                        playerId: m.playerId,
                        name: m.playerName,
                        characterName: m.characterName ?? '',
                        background: m.background ?? '',
                      })
                    }
                  >
                    {m.playerName}
                  </button>
                  <time>{new Date(m.timestamp).toLocaleTimeString(lang)}</time>
                </div>
                {m.text && <p className="chat-text">{m.text}</p>}
                {m.file && <ChatAttachment file={m.file} onOpenImage={openLightbox} />}
              </li>
            )
          }

          const r = item.roll
          const canSee = session.isGM || !r.hidden
          const isHidden = r.hidden && !canSee
          const color = playerColor(r.playerId)
          return (
            <li key={item.id} className={`feed-roll roll ${isHidden ? 'hidden' : r.kind}${archived}`}>
              <div className="feed-line">
                <span className="player-dot" style={{ background: color }} />
                <button
                  type="button"
                  className="feed-name"
                  style={{ color }}
                  onClick={() =>
                    setDetail({
                      playerId: r.playerId,
                      name: r.playerName || t('player.anon'),
                      characterName: r.characterName ?? '',
                      background: r.background ?? '',
                    })
                  }
                >
                  {r.playerName || t('player.anon')}
                </button>
                <time>{new Date(r.timestamp).toLocaleTimeString(lang)}</time>
              </div>
              <p className="roll-text">{formatRollText(t, r, canSee)}</p>
              {!isHidden && (
                <p className="roll-detail">
                  {formatDiceSummary(r.diceCount, r.diceType, r.modifier)}
                  {' · '}
                  {t('result.faces')}: [{r.faces.join(', ')}]
                  {r.hidden && session.isGM && ' 🔒'}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="typing-line" aria-live="polite">
        {typingLine}
      </p>

      {filter !== 'rolls' && (
        <div className="chat-compose">
          {pending && (
            <div className="attach-pending">
              {isImageType(pending.type) ? (
                <img className="attach-pending-thumb" src={pending.dataUrl} alt={pending.name} />
              ) : (
                <span className="attach-pending-icon" aria-hidden="true">
                  📎
                </span>
              )}
              <span className="attach-pending-name">{pending.name}</span>
              <button
                type="button"
                className="link icon-x attach-pending-remove"
                aria-label={t('chat.removeAttachment')}
                onClick={() => setPending(null)}
              >
                <CloseIcon />
              </button>
            </div>
          )}
          {mention && suggestions.length > 0 && (
            <ul className="mention-suggest" role="listbox">
              {suggestions.map((s, i) => (
                <li key={s.kind === 'all' ? '@all' : s.id}>
                  <button
                    type="button"
                    className={`mention-item${i === mention.selected ? ' active' : ''}`}
                    // preventDefault keeps focus on the chat input.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pickSuggestion(s)
                    }}
                  >
                    {s.kind === 'all' ? (
                      <>
                        <span className="mention-handle">@all</span>
                        <span className="mention-sub">{t('chat.mentionEveryone')}</span>
                      </>
                    ) : (
                      <span className="mention-handle">@{s.name}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="chat-input">
            <input
              ref={fileInputRef}
              type="file"
              className="visually-hidden"
              onChange={handlePickFile}
            />
            <button
              type="button"
              className="attach-btn"
              aria-label={t('chat.attach')}
              disabled={attaching}
              onClick={() => fileInputRef.current?.click()}
            >
              📎
            </button>
            <input
              ref={chatInputRef}
              type="text"
              value={text}
              maxLength={300}
              placeholder={t('chat.placeholder')}
              onChange={(e) => onType(e.target.value, e.target.selectionStart ?? e.target.value.length)}
              onSelect={(e) => {
                const el = e.currentTarget
                refreshMention(el.value, el.selectionStart ?? el.value.length)
              }}
              onBlur={() => setMention(null)}
              onKeyDown={(e) => {
                // While the autocomplete is open, the arrow keys and Enter
                // drive it instead of the message input.
                if (mention && suggestions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setMention({
                      ...mention,
                      selected: (mention.selected + 1) % suggestions.length,
                    })
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setMention({
                      ...mention,
                      selected:
                        (mention.selected - 1 + suggestions.length) % suggestions.length,
                    })
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setMention(null)
                    return
                  }
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    pickSuggestion(suggestions[mention.selected] ?? suggestions[0])
                    return
                  }
                }
                // Ignore Enter that only confirms an IME (e.g. Japanese) conversion.
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            {/* preventDefault on mousedown keeps focus on the input, so clicking
                Send does not blur it and force-commit an in-progress IME
                composition — that blur previously raced with the click and left
                the message in the box (and a second click re-sent it). */}
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={send}>
              {t('chat.send')}
            </button>
          </div>
        </div>
      )}

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
