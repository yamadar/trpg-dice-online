import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useFieldNotice } from '../hooks/useFieldNotice'
import { loadLastRoomCode } from '../storage/room'
import { loadFullLog } from '../storage/roomLog'
import { buildRoomExport, roomExportFilename } from '../storage/roomExport'
import { parseRoomImport } from '../storage/roomImport'
import { normalizeRoomCode, type Player } from '../net/protocol'
import { playerColor } from '../players/colors'
import { composeName } from '../players/identity'
import type { Session } from '../hooks/useSession'

interface Props {
  session: Session
  /** Room code from the URL (?room=CODE), used to prefill the join field. */
  initialJoinCode: string
  onNotice: (message: string) => void
}

export function RoomPanel({ session, initialJoinCode, onNotice }: Props) {
  const { t } = useI18n()
  // Prefill the join field with the URL code if any, else the last code
  // this player created or joined.
  const [codeInput, setCodeInput] = useState(
    () => normalizeRoomCode(initialJoinCode) || normalizeRoomCode(loadLastRoomCode()),
  )
  const [copied, setCopied] = useState(false)
  // Host-only field for changing the live room's code.
  const [newCode, setNewCode] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  // File-picker ref + error flag for importing a room from an export file.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState(false)
  const { status, role, roomCode, players, playerId } = session

  const busy = status === 'connecting'
  const online = role !== 'offline'

  // Toast once the room-name edit settles (on blur or when the sheet closes).
  const roomNameNotice = useFieldNotice(() => onNotice(t('toast.roomName')))

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
    const code = normalizeRoomCode(codeInput)
    if (code.length >= 4) void session.joinRoom(code)
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

  // The GM is also the host: leaving closes the room for everyone, so confirm.
  const handleLeave = () => {
    if (role === 'host' && !window.confirm(t('room.leaveConfirmGM'))) return
    session.leaveRoom()
  }

  // Save the room's full durable history — the player roster, rolls,
  // chat, attachments and markers — as a downloadable ZIP archive.
  const handleExport = async () => {
    if (!roomCode) return
    const entries = await loadFullLog(roomCode)
    const zip = buildRoomExport({ code: roomCode, name: session.roomName }, players, entries)
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

  return (
    <section className="panel">
      <h2>
        <span className="panel-icon" aria-hidden="true">
          👥
        </span>
        {t('room.section')}
      </h2>

      {!online && (
        <div className="room-setup">
          <input
            type="text"
            value={codeInput}
            placeholder={t('room.codePlaceholder')}
            maxLength={8}
            disabled={busy}
            onChange={(e) => setCodeInput(normalizeRoomCode(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <div className="room-setup-buttons">
            <button
              type="button"
              className="primary"
              // A code is optional for create; if given it must be valid.
              disabled={busy || (codeInput.length > 0 && codeInput.length < 4)}
              onClick={() => void session.createRoom(codeInput || undefined)}
            >
              {/* Each part stays whole; when narrow the label wraps only
                  before "(become GM)". */}
              <span className="nowrap">{t('room.create')}</span>
              <wbr />
              <span className="nowrap">{t('room.createGmNote')}</span>
            </button>
            <button type="button" disabled={busy || codeInput.length < 4} onClick={handleJoin}>
              {busy ? t('room.connecting') : t('room.join')}
            </button>
          </div>
          {busy ? (
            <p className="room-connecting" role="status">
              {t('room.connecting')}
            </p>
          ) : (
            <p className="hint">{t('room.codeCreateHint')}</p>
          )}
          <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
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

      {online && (
        <div className="room-active">
          <div className="room-code-row">
            <span className="room-code-label">{t('room.code')}</span>
            <code className="room-code">{roomCode}</code>
            <button type="button" className="link" onClick={() => void handleCopy()}>
              {copied ? t('room.copied') : t('room.copy')}
            </button>
          </div>
          <p className="hint">{t('room.shareHint')}</p>
          {role === 'host' && (
            <div className="field">
              <span>{t('room.changeCode')}</span>
              <div className="room-code-edit">
                <input
                  type="text"
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
          )}
          {role === 'host' ? (
            <label className="field">
              <span>{t('room.name')}</span>
              <input
                type="text"
                value={session.roomName}
                maxLength={40}
                placeholder={t('room.namePlaceholder')}
                onChange={(e) => {
                  session.setRoomName(e.target.value)
                  roomNameNotice.markChanged()
                }}
                onBlur={roomNameNotice.flush}
              />
            </label>
          ) : (
            session.roomName.trim() && (
              <div className="field">
                <span>{t('room.name')}</span>
                <p className="room-name-display">{session.roomName}</p>
              </div>
            )
          )}
          <button type="button" onClick={() => void handleExport()}>
            {t('room.exportHistory')}
          </button>
          <button type="button" className="danger" onClick={handleLeave}>
            {t('room.leave')}
          </button>
        </div>
      )}

      <div className="players">
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
            const hasDetail = p.characterName.trim() !== '' || p.background.trim() !== ''
            const expanded = expandedIds.has(p.id)
            const rowInner = (
              <>
                <span className="player-dot" style={{ background: color }} />
                <span className="player-name" style={{ color }}>
                  {composeName(p.name, p.characterName) || t('player.anon')}
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
    </section>
  )
}
