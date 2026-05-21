import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { getCachedTranslation, seedTranslation } from '../i18n/translator'
import { loadLastRoomCode } from '../storage/room'
import { loadFullLog } from '../storage/roomLog'
import { buildRoomExport, roomExportFilename, type TranslationRecord } from '../storage/roomExport'
import { parseRoomImport } from '../storage/roomImport'
import { normalizeRoomCode, type ChatMessage, type Player } from '../net/protocol'
import { playerColor } from '../players/colors'
import { composeName } from '../players/identity'
import type { Session } from '../hooks/useSession'
import { RoomHistory } from './RoomHistory'
import { RoomIcon } from './icons'

interface Props {
  session: Session
  /** Room code from the URL (?room=CODE), used to prefill the join field. */
  initialJoinCode: string
  onNotice: (message: string) => void
}

/** Which lobby screen is shown while not in a room. */
type LobbyView = 'home' | 'create' | 'join' | 'history'

export function RoomPanel({ session, initialJoinCode, onNotice }: Props) {
  const { t, lang } = useI18n()
  // Creating and joining are now distinct screens; a URL code jumps
  // straight to the join screen with the field prefilled.
  const [view, setView] = useState<LobbyView>(() =>
    normalizeRoomCode(initialJoinCode) ? 'join' : 'home',
  )
  // Join screen: prefilled with the URL code if any, else the last code
  // this player created or joined.
  const [joinCode, setJoinCode] = useState(
    () => normalizeRoomCode(initialJoinCode) || normalizeRoomCode(loadLastRoomCode()),
  )
  // Create screen: an optional custom code and the room name.
  const [createCode, setCreateCode] = useState('')
  const [createName, setCreateName] = useState('')
  const [copied, setCopied] = useState(false)
  // Host-only fields for renaming the room and changing its code. The
  // panel is mounted only while open, so `useState(session.roomName)`
  // re-seeds with the current name each time the sheet is reopened; the
  // host's `session.roomName` only changes via this same editor while it
  // is open, so no external resync is needed.
  const [newRoomName, setNewRoomName] = useState(session.roomName)
  const [newCode, setNewCode] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  // File-picker ref + error flag for importing a room from an export file.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState(false)
  const { status, role, roomCode, players, playerId, playerImages } = session

  const busy = status === 'connecting'
  const online = role !== 'offline'

  const handleChangeRoomName = () => {
    const next = newRoomName.trim()
    if (next === session.roomName.trim()) return
    session.setRoomName(next)
    onNotice(t('toast.roomName'))
  }

  // A committed room-code change is worth a toast on top of the feed
  // marker. roomCode only goes code→code on a real change (host action).
  const prevRoomCodeRef = useRef(roomCode)
  useEffect(() => {
    const prev = prevRoomCodeRef.current
    prevRoomCodeRef.current = roomCode
    if (prev && roomCode && prev !== roomCode && role === 'host') {
      onNotice(t('toast.roomCodeChanged'))
    }
  }, [roomCode, role, onNotice, t])

  const handleJoin = () => {
    const code = normalizeRoomCode(joinCode)
    if (code.length >= 4) void session.joinRoom(code)
  }

  const handleCreate = () => {
    const code = normalizeRoomCode(createCode)
    // A code is optional for create; if given it must be valid.
    if (code.length > 0 && code.length < 4) return
    void session.createRoom(code || undefined, createName.trim() || undefined)
  }

  // Restore a room from an exported ZIP: parse it, then re-host the room.
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    setImportError(false)
    file
      .arrayBuffer()
      .then((buf) => {
        const data = parseRoomImport(new Uint8Array(buf))
        if (!data) {
          setImportError(true)
          return
        }
        // Pre-fill the translation cache so restored chat shows the same
        // translations without re-contacting a backend.
        for (const tr of data.translations) {
          seedTranslation(tr.text, tr.from, tr.to, tr.translated)
        }
        void session.importRoom(data)
      })
      .catch(() => setImportError(true))
  }

  // Copy the full room link so it can be shared directly.
  const handleCopy = async () => {
    if (!roomCode) return
    const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked */
    }
  }

  // The GM is also the host: closing ends the room for everyone, so confirm.
  const handleLeave = () => {
    if (role === 'host' && !window.confirm(t('room.leaveConfirmGM'))) return
    session.leaveRoom()
  }

  // Save the room's full durable history — the player roster, rolls,
  // chat, attachments, markers and any cached chat translations — as a
  // downloadable ZIP archive.
  const handleExport = async () => {
    if (!roomCode || !session.sessionId) return
    const entries = await loadFullLog(session.sessionId)
    // Carry whatever chat translations are already cached so a re-import
    // shows them without re-translating.
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
    const zip = buildRoomExport(
      { code: roomCode, name: session.roomName },
      players,
      entries,
      translations,
    )
    const blob = new Blob([zip], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = roomExportFilename(roomCode)
    a.click()
    URL.revokeObjectURL(url)
  }

  // Only players with a character name or background have a detail to expand.
  const detailIds = players
    .filter((p) => p.characterName.trim() !== '' || p.background.trim() !== '')
    .map((p) => p.id)
  const allExpanded = detailIds.length > 0 && detailIds.every((id) => expandedIds.has(id))

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // One control to expand or collapse every participant's detail at once.
  const toggleAll = () => {
    setExpandedIds(allExpanded ? new Set() : new Set(detailIds))
  }

  // The participant roster — shown prominently at the top of an active room.
  const playersBlock = (
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
        {players.map((p: Player) => {
          const color = playerColor(p.id)
          const shown = composeName(p.name, p.characterName) || t('player.anon')
          const image = playerImages[p.id]
          const hasDetail = p.characterName.trim() !== '' || p.background.trim() !== ''
          const expanded = expandedIds.has(p.id)
          const rowInner = (
            <>
              {image ? (
                <span className="player-avatar">
                  <img src={image} alt="" />
                </span>
              ) : (
                <span className="player-avatar" style={{ background: color }}>
                  {shown.charAt(0)}
                </span>
              )}
              <span className="player-name" style={{ color }}>
                {shown}
              </span>
              {p.isGM && <span className="badge gm">{t('room.gmBadge')}</span>}
              {p.id === playerId && <span className="badge you">{t('room.youBadge')}</span>}
              {hasDetail && (
                <span className={`player-caret${expanded ? ' open' : ''}`} aria-hidden="true">
                  ▸
                </span>
              )}
            </>
          )
          return (
            <li key={p.id}>
              {hasDetail ? (
                <button
                  type="button"
                  className="player-row"
                  aria-expanded={expanded}
                  onClick={() => toggleExpanded(p.id)}
                >
                  {rowInner}
                </button>
              ) : (
                <div className="player-row">{rowInner}</div>
              )}
              {hasDetail && expanded && (
                <div className="player-detail">
                  {p.characterName.trim() && (
                    <p>
                      <span className="detail-key">{t('character.name')}</span>
                      {p.characterName}
                    </p>
                  )}
                  <p>
                    <span className="detail-key">{t('player.name')}</span>
                    {p.name || t('player.anon')}
                  </p>
                  {p.background.trim() && <p className="detail-bg">{p.background}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <section className="panel">
      <h2>
        <span className="panel-icon" aria-hidden="true">
          <RoomIcon size={20} />
        </span>
        {t('room.section')}
      </h2>

      {!online && view === 'home' && (
        <div className="room-setup">
          <button
            type="button"
            className="primary big"
            disabled={busy}
            onClick={() => setView('create')}
          >
            {t('room.create')}
          </button>
          <button type="button" className="big" disabled={busy} onClick={() => setView('join')}>
            {t('room.join')}
          </button>
          <button
            type="button"
            className="link"
            disabled={busy}
            onClick={() => setView('history')}
          >
            {t('room.history')}
          </button>
          <button
            type="button"
            className="link"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('room.importHistory')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={handleImportFile}
          />
          {importError && (
            <p className="banner error" role="alert">
              {t('room.importError')}
            </p>
          )}
        </div>
      )}

      {!online && view === 'create' && (
        <div className="room-setup">
          <label className="field">
            <span>{t('room.name')}</span>
            <input
              type="text"
              value={createName}
              maxLength={40}
              placeholder={t('room.namePlaceholder')}
              disabled={busy}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('room.code')}</span>
            <input
              type="text"
              className="upper"
              value={createCode}
              placeholder={t('room.codePlaceholder')}
              maxLength={8}
              disabled={busy}
              onChange={(e) => setCreateCode(normalizeRoomCode(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </label>
          <p className="hint">{t('room.codeCreateHint')}</p>
          <p className="hint">{t('room.createGmHint')}</p>
          <div className="room-setup-buttons">
            <button type="button" disabled={busy} onClick={() => setView('home')}>
              {t('room.back')}
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy || (createCode.length > 0 && createCode.length < 4)}
              onClick={handleCreate}
            >
              {busy ? t('room.connecting') : t('room.create')}
            </button>
          </div>
          {busy && (
            <p className="room-connecting" role="status">
              {t('room.connecting')}
            </p>
          )}
        </div>
      )}

      {!online && view === 'join' && (
        <div className="room-setup">
          <label className="field">
            <span>{t('room.code')}</span>
            <input
              type="text"
              className="upper"
              value={joinCode}
              placeholder={t('room.codePlaceholder')}
              maxLength={8}
              disabled={busy}
              onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </label>
          <div className="room-setup-buttons">
            <button type="button" disabled={busy} onClick={() => setView('home')}>
              {t('room.back')}
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy || joinCode.length < 4}
              onClick={handleJoin}
            >
              {busy ? t('room.connecting') : t('room.join')}
            </button>
          </div>
          {busy && (
            <p className="room-connecting" role="status">
              {t('room.connecting')}
            </p>
          )}
        </div>
      )}

      {!online && view === 'history' && (
        <RoomHistory playerId={playerId} onBack={() => setView('home')} />
      )}

      {online && (
        <div className="room-active">
          {playersBlock}

          <div className="room-code-row">
            <span className="room-code-label">{t('room.code')}</span>
            <code className="room-code">{roomCode}</code>
            <button type="button" className="link" onClick={() => void handleCopy()}>
              {copied ? t('room.copied') : t('room.copy')}
            </button>
          </div>
          <p className="hint">{t('room.shareHint')}</p>

          {role === 'host' && (
            <details className="gm-section">
              <summary>{t('room.gmSection')}</summary>
              <div className="field">
                <span>{t('room.name')}</span>
                <div className="room-code-edit">
                  <input
                    type="text"
                    value={newRoomName}
                    placeholder={t('room.namePlaceholder')}
                    maxLength={40}
                    onChange={(e) => setNewRoomName(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={newRoomName.trim() === session.roomName.trim()}
                    onClick={handleChangeRoomName}
                  >
                    {t('room.changeName')}
                  </button>
                </div>
              </div>
              <div className="field">
                <span>{t('room.changeCode')}</span>
                <div className="room-code-edit">
                  <input
                    type="text"
                    className="upper"
                    value={newCode}
                    placeholder={t('room.newCodePlaceholder')}
                    maxLength={8}
                    onChange={(e) => setNewCode(normalizeRoomCode(e.target.value))}
                  />
                  <button
                    type="button"
                    disabled={busy || newCode.length < 4 || newCode === roomCode}
                    onClick={() => void session.changeRoomCode(newCode)}
                  >
                    {t('room.changeCode')}
                  </button>
                </div>
                <p className="hint">{t('room.codeChangeHint')}</p>
              </div>
            </details>
          )}

          <button type="button" onClick={() => void handleExport()}>
            {t('room.exportHistory')}
          </button>
          <button type="button" className="danger" onClick={handleLeave}>
            {role === 'host' ? t('room.close') : t('room.leave')}
          </button>
        </div>
      )}
    </section>
  )
}
