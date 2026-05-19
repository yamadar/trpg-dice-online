import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { buildFeed, type FeedFilter, type SystemMarker } from '../feed/feed'
import { isImageType } from '../chat/attachment'
import { formatFeedDate } from '../feed/datetime'
import type { ChatFile, ChatMessage } from '../net/protocol'
import type { RollResult } from '../dice/types'
import {
  deleteAllSessions,
  deleteSession,
  listSessions,
  loadFullLog,
  type SessionSummary,
} from '../storage/roomLog'
import { FeedList } from './FeedList'
import { Lightbox } from './Lightbox'

const FILTERS: FeedFilter[] = ['all', 'rolls', 'chat', 'files']

interface Props {
  /** The local player id — passed through to the read-only feed. */
  playerId: string
  /** Return to the lobby home screen. */
  onBack: () => void
}

/** A past session's durable log, split into the three feed lists. */
interface LoadedLog {
  history: RollResult[]
  chat: ChatMessage[]
  markers: SystemMarker[]
}

/**
 * Browse the durable logs of past room sessions. The list view shows every
 * stored session; opening one renders its whole feed read-only. Sessions
 * can be deleted individually or all at once.
 */
export function RoomHistory({ playerId, onBack }: Props) {
  const { t, lang } = useI18n()
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [selected, setSelected] = useState<SessionSummary | null>(null)
  const [log, setLog] = useState<LoadedLog | null>(null)
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const refresh = useCallback(() => {
    void listSessions().then(setSessions)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Load the chosen session's whole durable log for read-only browsing.
  const openSession = useCallback((s: SessionSummary) => {
    setSelected(s)
    setLog(null)
    setFilter('all')
    void loadFullLog(s.sessionId).then((entries) => {
      setLog({
        history: entries.filter((e) => e.kind === 'roll').map((e) => e.data as RollResult),
        chat: entries.filter((e) => e.kind === 'chat').map((e) => e.data as ChatMessage),
        markers: entries.filter((e) => e.kind === 'marker').map((e) => e.data as SystemMarker),
      })
    })
  }, [])

  const closeSession = useCallback(() => {
    setSelected(null)
    setLog(null)
    setLightboxIndex(null)
  }, [])

  const handleDelete = (s: SessionSummary) => {
    if (!window.confirm(t('history.deleteConfirm'))) return
    void deleteSession(s.sessionId).then(refresh)
  }

  const handleDeleteAll = () => {
    if (!window.confirm(t('history.deleteAllConfirm'))) return
    void deleteAllSessions().then(refresh)
  }

  const feed = useMemo(
    () => (log ? buildFeed(log.history, log.chat, log.markers, filter) : []),
    [log, filter],
  )

  // Image attachments in view order — the lightbox steps through these.
  const images = useMemo(() => {
    const list: ChatFile[] = []
    for (const item of feed) {
      if (item.kind === 'chat' && item.message.file && isImageType(item.message.file.type)) {
        list.push(item.message.file)
      }
    }
    return list
  }, [feed])

  const openImage = useCallback(
    (file: ChatFile) => {
      const i = images.indexOf(file)
      setLightboxIndex(i >= 0 ? i : 0)
    },
    [images],
  )

  // --- detail view: one past session's read-only feed ---------------------
  if (selected) {
    return (
      <div className="room-history">
        <div className="history-head">
          <button type="button" className="link" onClick={closeSession}>
            ← {t('history.backToList')}
          </button>
          <h3 className="history-head-title">{selected.name.trim() || t('history.unnamed')}</h3>
        </div>
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
        {log === null ? (
          <p className="hint history-loading">…</p>
        ) : (
          <FeedList
            feed={feed}
            lastExitAt={0}
            playerId={playerId}
            isGM={selected.role === 'host'}
            compact={false}
            hasOlder={false}
            onLoadOlder={() => {}}
            pending={[]}
            onOpenDetail={() => {}}
            onOpenImage={openImage}
          />
        )}
        {lightboxIndex !== null && images[lightboxIndex] && (
          <Lightbox
            images={images}
            index={lightboxIndex}
            onIndexChange={setLightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </div>
    )
  }

  // --- list view: every stored past session -------------------------------
  return (
    <div className="room-history">
      <div className="history-head">
        <button type="button" className="link" onClick={onBack}>
          ← {t('room.back')}
        </button>
        <h3 className="history-head-title">{t('history.title')}</h3>
      </div>

      {sessions !== null && sessions.length === 0 && (
        <p className="hint">{t('history.empty')}</p>
      )}

      {sessions && sessions.length > 0 && (
        <>
          <ul className="history-list">
            {sessions.map((s) => (
              <li key={s.sessionId} className="history-item">
                <button type="button" className="history-row" onClick={() => openSession(s)}>
                  <span className="history-row-top">
                    <span className="history-name">
                      {s.name.trim() || t('history.unnamed')}
                    </span>
                    {s.role === 'host' && <span className="badge gm">{t('room.gmBadge')}</span>}
                  </span>
                  <span className="history-sub">
                    <code className="history-code">{s.code}</code>
                    <span>{formatFeedDate(new Date(s.lastAt), lang)}</span>
                    <span>{t('history.entryCount', { count: s.count })}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="link danger history-delete"
                  onClick={() => handleDelete(s)}
                >
                  {t('history.delete')}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="link danger" onClick={handleDeleteAll}>
            {t('history.deleteAll')}
          </button>
        </>
      )}
    </div>
  )
}
