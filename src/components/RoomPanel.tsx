import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback'
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
  const [codeInput, setCodeInput] = useState(() => normalizeRoomCode(initialJoinCode))
  const [copied, setCopied] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const { status, role, roomCode, players, playerId } = session

  const busy = status === 'connecting'
  const online = role !== 'offline'

  // One toast after a burst of room-name edits settles, not per keystroke.
  const notifyRoomName = useDebouncedCallback(() => onNotice(t('toast.roomName')), 800)

  const handleJoin = () => {
    const code = normalizeRoomCode(codeInput)
    if (code.length >= 4) void session.joinRoom(code)
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
      <h2>{t('room.section')}</h2>

      {!online && (
        <div className="room-setup">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void session.createRoom()}
          >
            {t('room.create')}
          </button>
          <div className="room-join">
            <input
              type="text"
              value={codeInput}
              placeholder={t('room.codePlaceholder')}
              maxLength={8}
              disabled={busy}
              onChange={(e) => setCodeInput(normalizeRoomCode(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button type="button" disabled={busy || codeInput.length < 4} onClick={handleJoin}>
              {busy ? t('room.connecting') : t('room.join')}
            </button>
          </div>
          {busy ? (
            <p className="room-connecting" role="status">
              {t('room.connecting')}
            </p>
          ) : (
            <p className="hint">{t('room.offline')}</p>
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
                  notifyRoomName()
                }}
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
