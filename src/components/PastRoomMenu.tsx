import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { getCachedTranslation } from '../i18n/translator'
import {
  loadFullLog,
  loadSessionCharacters,
  type SessionCharacterRecord,
  type SessionSummary,
} from '../storage/roomLog'
import { buildRoomExport, roomExportFilename, type TranslationRecord } from '../storage/roomExport'
import type { ChatMessage, Player } from '../net/protocol'
import { playerColor } from '../players/colors'
import { composeName } from '../players/identity'

interface Props {
  /** The past session whose roster + export the menu mirrors. */
  session: SessionSummary
  /** Local player id, used only to mark the "you" badge if the local
   *  player took part in this session. */
  playerId: string
  /** Return to the session list — the room Sheet stays open and the
   *  history page steps back from "session feed" to "session list". */
  onBack: () => void
}

/**
 * Room-menu Sheet contents for a past session: the participant roster
 * (one row per (player, last-used character)), the room code at the
 * time of the session, an export-history button, and a back button that
 * returns to the session list. Modelled on the active-room block in
 * `RoomPanel` so the live and past menus read with one vocabulary.
 *
 * Why the data is loaded here rather than in `RoomHistory`: this menu
 * lives inside the room Sheet, while `RoomHistory` is the full-screen
 * feed page underneath; co-locating the per-record state with the menu
 * keeps each pane independent and avoids prop-drilling a roster the
 * feed page does not itself render in this view.
 */
export function PastRoomMenu({ session, playerId, onBack }: Props) {
  const { t, lang } = useI18n()
  // Tag the loaded records with their session id so a stale fetch that
  // resolves after the user has switched sessions is dropped at render
  // time instead of overwriting the newer roster.
  const [records, setRecords] = useState<{
    sessionId: string
    records: SessionCharacterRecord[]
  } | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sid = session.sessionId
    void loadSessionCharacters(sid).then((rows) => {
      setRecords({ sessionId: sid, records: rows })
    })
  }, [session.sessionId])

  const loadedRecords =
    records?.sessionId === session.sessionId ? records.records : null

  // One row per player, using the most recently observed (player,
  // character) record — the "last-used character" for that player in
  // this session. Sorted by playerName so the list is stable across
  // re-renders.
  const players = useMemo(() => {
    if (!loadedRecords) return []
    const byPlayer = new Map<string, SessionCharacterRecord>()
    for (const r of loadedRecords) {
      const cur = byPlayer.get(r.playerId)
      if (!cur || r.updatedAt > cur.updatedAt) byPlayer.set(r.playerId, r)
    }
    return Array.from(byPlayer.values()).sort((a, b) =>
      a.playerName.localeCompare(b.playerName),
    )
  }, [loadedRecords])

  const detailIds = players
    .filter(
      (r) => r.characterName.trim() !== '' || r.background.trim() !== '',
    )
    .map((r) => r.playerId)
  const allExpanded =
    detailIds.length > 0 && detailIds.every((id) => expandedIds.has(id))

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setExpandedIds(allExpanded ? new Set() : new Set(detailIds))
  }

  // Export this past session's whole durable log as a ZIP, mirroring
  // the live `handleExport` in `RoomPanel`. The `players` array on the
  // manifest is derived from the same per-(player, last-character)
  // records the roster shows.
  const handleExport = async () => {
    if (busy) return
    setBusy(true)
    try {
      const [entries, characters] = await Promise.all([
        loadFullLog(session.sessionId),
        loadSessionCharacters(session.sessionId),
      ])
      const translations: TranslationRecord[] = []
      const seen = new Set<string>()
      for (const entry of entries) {
        if (entry.kind !== 'chat') continue
        const chat = entry.data as ChatMessage
        if (chat.text === '' || chat.lang === lang) continue
        const translated = getCachedTranslation(chat.text, chat.lang, lang)
        if (translated === undefined) continue
        const key = `${chat.lang}:${chat.text}`
        if (seen.has(key)) continue
        seen.add(key)
        translations.push({ text: chat.text, from: chat.lang, to: lang, translated })
      }
      // The session record doesn't carry per-player `lang`; default to
      // the current UI lang for the export manifest — `roomImport`
      // ignores the `players` field on read, so this is only
      // informational.
      const exportPlayers: Player[] = players.map((r) => ({
        id: r.playerId,
        name: r.playerName,
        isGM: r.isGM,
        characterId: r.characterId,
        characterName: r.characterName,
        background: r.background,
        lang,
      }))
      const zip = buildRoomExport(
        { code: session.code, name: session.name },
        exportPlayers,
        entries,
        translations,
        characters,
      )
      const blob = new Blob([zip], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = roomExportFilename(session.code)
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="room-active">
      <div className="players players-prominent">
        <div className="players-head">
          <h3>
            {t('room.players')} ({players.length})
          </h3>
          {detailIds.length > 0 && (
            <button type="button" className="link expand-all" onClick={toggleAll}>
              {allExpanded ? t('room.collapseAll') : t('room.expandAll')}
            </button>
          )}
        </div>
        <ul>
          {players.map((r) => {
            const color = playerColor(r.playerId)
            const shown = composeName(r.playerName, r.characterName) || t('player.anon')
            const hasDetail =
              r.characterName.trim() !== '' || r.background.trim() !== ''
            const expanded = expandedIds.has(r.playerId)
            const rowInner = (
              <>
                {r.image ? (
                  <span className="player-avatar">
                    <img src={r.image} alt="" />
                  </span>
                ) : (
                  <span className="player-avatar" style={{ background: color }}>
                    {shown.charAt(0)}
                  </span>
                )}
                <span className="player-name" style={{ color }}>
                  {shown}
                </span>
                {r.isGM && <span className="badge gm">{t('room.gmBadge')}</span>}
                {r.playerId === playerId && (
                  <span className="badge you">{t('room.youBadge')}</span>
                )}
                {hasDetail && (
                  <span className={`player-caret${expanded ? ' open' : ''}`} aria-hidden="true">
                    ▸
                  </span>
                )}
              </>
            )
            return (
              <li key={r.playerId}>
                {hasDetail ? (
                  <button
                    type="button"
                    className="player-row"
                    aria-expanded={expanded}
                    onClick={() => toggleExpanded(r.playerId)}
                  >
                    {rowInner}
                  </button>
                ) : (
                  <div className="player-row">{rowInner}</div>
                )}
                {hasDetail && expanded && (
                  <div className="player-detail">
                    {r.characterName.trim() && (
                      <p>
                        <span className="detail-key">{t('character.name')}</span>
                        {r.characterName}
                      </p>
                    )}
                    <p>
                      <span className="detail-key">{t('player.name')}</span>
                      {r.playerName || t('player.anon')}
                    </p>
                    {r.background.trim() && <p className="detail-bg">{r.background}</p>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="room-code-row">
        <span className="room-code-label">{t('room.code')}</span>
        <code className="room-code">{session.code}</code>
      </div>

      <button type="button" disabled={busy} onClick={() => void handleExport()}>
        {t('room.exportHistory')}
      </button>
      <button type="button" onClick={onBack}>
        {t('history.backToList')}
      </button>
    </div>
  )
}
