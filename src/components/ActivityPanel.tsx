import { useEffect, useMemo, useRef, useState } from 'react'
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

const FILTERS: FeedFilter[] = ['all', 'rolls', 'chat']

function markerText(t: TFn, marker: SystemMarker): string {
  return t(`marker.${marker.type}`, {
    code: marker.roomCode ?? '',
    name: marker.playerName ?? '',
  })
}

/** Combined roll history + chat timeline with a per-view filter. */
export function ActivityPanel({ session }: { session: Session }) {
  const { t, lang } = useI18n()
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [text, setText] = useState('')
  // The feed entry whose name was tapped, opening the player-detail card.
  const [detail, setDetail] = useState<{ playerId: string; name: string } | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const feed = useMemo(
    () => buildFeed(session.history, session.chat, session.markers, filter),
    [session.history, session.chat, session.markers, filter],
  )

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

  const send = () => {
    if (!text.trim()) return
    session.sendChat(text)
    setText('')
  }

  const onType = (value: string) => {
    setText(value)
    session.sendTyping()
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
            return (
              <li key={item.id} className={`feed-chat${own ? ' own' : ''}${archived}`}>
                <div className="feed-line">
                  <span className="player-dot" style={{ background: color }} />
                  <button
                    type="button"
                    className="feed-name"
                    style={{ color }}
                    onClick={() => setDetail({ playerId: m.playerId, name: m.playerName })}
                  >
                    {m.playerName}
                  </button>
                  <time>{new Date(m.timestamp).toLocaleTimeString(lang)}</time>
                </div>
                <p className="chat-text">{m.text}</p>
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
                    setDetail({ playerId: r.playerId, name: r.playerName || t('player.anon') })
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
        <div className="chat-input">
          <input
            type="text"
            value={text}
            maxLength={300}
            placeholder={t('chat.placeholder')}
            onChange={(e) => onType(e.target.value)}
            // Ignore Enter that only confirms an IME (e.g. Japanese) conversion.
            onKeyDown={(e) => {
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
      )}

      {detail && (
        <Sheet onClose={() => setDetail(null)}>
          <PlayerDetailCard
            player={session.players.find((p) => p.id === detail.playerId) ?? null}
            playerId={detail.playerId}
            fallbackName={detail.name}
            isSelf={detail.playerId === session.playerId}
          />
        </Sheet>
      )}
    </section>
  )
}
