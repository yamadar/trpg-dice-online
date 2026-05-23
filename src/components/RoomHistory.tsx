import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { useI18n } from '../i18n/useI18n'
import { buildFeed, type FeedFilter, type SystemMarker } from '../feed/feed'
import { isImageType } from '../chat/attachment'
import { formatFeedDate } from '../feed/datetime'
import type { ChatFile, ChatMessage } from '../net/protocol'
import type { RollResult } from '../dice/types'
import {
  characterImagesKey,
  deleteAllSessions,
  deleteSession,
  listSessions,
  loadFullLog,
  loadSessionCharacters,
  normalizeSpeakerEntry,
  type SessionCharacterDraft,
  type SessionCharacterRecord,
  type SessionSummary,
} from '../storage/roomLog'
import { useConfirm } from '../hooks/useConfirm'
import { speakerImageKey } from '../feed/feed'
import { FeedList, type FeedDetailTarget } from './FeedList'
import { Lightbox } from './Lightbox'
import { PlayerDetailCard } from './PlayerDetailCard'
import { Sheet } from './Sheet'
import { AllIcon, AttachIcon, ChatIcon, DiceIcon, PlayerIcon, type IconProps } from './icons'

// Icon-only filter chips — same glyphs the live ActivityPanel uses so the
// past-session feed reads with one consistent vocabulary.
const FILTERS: { id: FeedFilter; Icon: ComponentType<IconProps> }[] = [
  { id: 'all', Icon: AllIcon },
  { id: 'chat', Icon: ChatIcon },
  { id: 'rolls', Icon: DiceIcon },
  { id: 'files', Icon: AttachIcon },
]

interface Props {
  /** The local player id — passed through to the read-only feed. */
  playerId: string
  /** The session currently being viewed. `null` is the list view.
   *  Controlled by the parent so the room Sheet can mirror it as a
   *  "past room" menu and call `onSelect(null)` to return to the list. */
  selected: SessionSummary | null
  onSelect: (s: SessionSummary | null) => void
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
 * stored session; opening one renders its whole feed read-only, and
 * tapping a player name surfaces that player's character snapshot (with
 * the last-known portrait). Sessions can be deleted individually or all
 * at once.
 */
export function RoomHistory({ playerId, selected, onSelect, onBack }: Props) {
  const { t, lang } = useI18n()
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  // The loaded log and portrait map are tagged with their session id, so a
  // result that lands after the selection moved on is dropped at render
  // time rather than overwriting the newer view.
  const [log, setLog] = useState<{ sessionId: string; data: LoadedLog } | null>(null)
  const [charactersState, setCharactersState] = useState<
    { sessionId: string; records: SessionCharacterRecord[] } | null
  >(null)
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  // The entry whose name was tapped, opening a read-only player detail.
  const [detail, setDetail] = useState<FeedDetailTarget | null>(null)

  const refresh = useCallback(() => {
    void listSessions().then(setSessions)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Reset per-session UI state whenever the selection changes — a
  // freshly opened session always starts from the unfiltered top of
  // its feed, and closing one drops any leftover detail / lightbox
  // overlay. Done in render via the "store info from previous render"
  // pattern (React docs §"You Might Not Need an Effect") so the state
  // update is folded into the same render rather than triggering a
  // separate cascading-effect render.
  const selectedId = selected?.sessionId
  const [prevSelectedId, setPrevSelectedId] = useState<string | undefined>(selectedId)
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId)
    setFilter('all')
    setLightboxIndex(null)
    setDetail(null)
  }

  const openSession = useCallback(
    (s: SessionSummary) => {
      onSelect(s)
    },
    [onSelect],
  )

  const closeSession = useCallback(() => {
    onSelect(null)
  }, [onSelect])

  // Load the selected session's full log and its per-(player, character)
  // records in parallel. Both are tagged with the session id so a stale
  // result is dropped by `loadedLog` / `sessionCharacters` below. Older
  // feed entries that predate the `characterId` field fall back to
  // `legacyCharacterIdFromName` inside `speakerImageKey`, hitting the
  // rows the v4→v5 migration synthesised under `@n:<encoded characterName>`.
  useEffect(() => {
    if (!selected) return
    const sid = selected.sessionId
    void Promise.all([loadFullLog(sid), loadSessionCharacters(sid)]).then(
      ([entries, records]) => {
        setLog({
          sessionId: sid,
          data: {
            history: entries
              .filter((e) => e.kind === 'roll')
              .map((e) => normalizeSpeakerEntry(e.data as RollResult)),
            chat: entries
              .filter((e) => e.kind === 'chat')
              .map((e) => normalizeSpeakerEntry(e.data as ChatMessage)),
            markers: entries
              .filter((e) => e.kind === 'marker')
              .map((e) => e.data as SystemMarker),
          },
        })
        setCharactersState({ sessionId: sid, records })
      },
    )
  }, [selected])

  // Only the log / records that match the current selection.
  const loadedLog = selected && log?.sessionId === selected.sessionId ? log.data : null
  // Build the per-(player, character) map keyed by `${playerId}|${characterId}`
  // — the shape `FeedList` expects. Cached so the empty-object fallback
  // doesn't get a fresh identity every render.
  const sessionCharacters = useMemo<Record<string, SessionCharacterDraft | undefined>>(
    () => {
      if (!selected || charactersState?.sessionId !== selected.sessionId) return {}
      const map: Record<string, SessionCharacterDraft | undefined> = {}
      for (const r of charactersState.records) {
        map[characterImagesKey(r.playerId, r.characterId)] = {
          playerId: r.playerId,
          characterId: r.characterId,
          playerName: r.playerName,
          characterName: r.characterName,
          background: r.background,
          isGM: r.isGM,
          image: r.image,
        }
      }
      return map
    },
    [selected, charactersState],
  )

  const confirm = useConfirm()
  const handleDelete = async (s: SessionSummary) => {
    const ok = await confirm({ message: t('history.deleteConfirm'), destructive: true })
    if (!ok) return
    void deleteSession(s.sessionId).then(refresh)
  }

  const handleDeleteAll = async () => {
    const ok = await confirm({ message: t('history.deleteAllConfirm'), destructive: true })
    if (!ok) return
    void deleteAllSessions().then(refresh)
  }

  const feed = useMemo(
    () =>
      loadedLog
        ? buildFeed(loadedLog.history, loadedLog.chat, loadedLog.markers, filter)
        : [],
    [loadedLog, filter],
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

  // --- session view: one past session's read-only feed -------------------
  // Tapping a name opens the player-detail card as a modal Sheet on top
  // of the feed, mirroring the live ActivityPanel — so the back stack
  // stays "list → session → detail (overlay)" instead of swapping the
  // session view out for the detail page.
  if (selected) {
    const detailRecord = detail ? sessionCharacters[speakerImageKey(detail)] : null
    return (
      <div className="room-history room-history--session">
        <div className="history-head">
          <button type="button" className="link" onClick={closeSession}>
            ← {t('history.backToList')}
          </button>
          <h3 className="history-head-title">{selected.name.trim() || t('history.unnamed')}</h3>
        </div>
        <div className="panel-head feed-head">
          {/* Match the live ActivityPanel's 3-column grid (spacer · centred
              filter chips · right slot) so the chips sit on exactly the
              same optical centre line as in the live feed. There is no
              "clear view" trash button in the history view, so the right
              slot holds an invisible placeholder of the same width — the
              centring stays identical. */}
          <span className="feed-head-spacer" aria-hidden="true" />
          <div className="feed-filter" role="group" aria-label={t('feed.section')}>
            {FILTERS.map(({ id, Icon }) => {
              const label = t(`feed.${id}`)
              return (
                <button
                  key={id}
                  type="button"
                  className={id === filter ? 'filter-btn active' : 'filter-btn'}
                  aria-pressed={id === filter}
                  aria-label={label}
                  title={label}
                  onClick={() => setFilter(id)}
                >
                  <Icon />
                </button>
              )
            })}
          </div>
          <div className="feed-head-end">
            <span className="feed-clear-placeholder" aria-hidden="true" />
          </div>
        </div>
        {loadedLog === null ? (
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
            sessionCharacters={sessionCharacters}
            onOpenDetail={setDetail}
            onOpenImage={openImage}
          />
        )}
        {detail && (
          <Sheet
            title={t('feed.playerDetail')}
            titleIcon={<PlayerIcon size={20} />}
            onClose={() => setDetail(null)}
          >
            <PlayerDetailCard
              player={null}
              playerId={detail.playerId}
              displayName={detailRecord?.playerName ?? ''}
              characterName={detailRecord?.characterName ?? ''}
              background={detailRecord?.background ?? ''}
              image={detailRecord?.image || undefined}
              isSelf={detail.playerId === playerId}
            />
          </Sheet>
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

  // --- list view: every stored past session ------------------------------
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
