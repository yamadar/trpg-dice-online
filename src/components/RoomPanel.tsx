import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { normalizeRoomCode, type Player } from '../net/protocol'
import { playerColor } from '../players/colors'
import { composeName } from '../players/identity'
import type { Session } from '../hooks/useSession'

export function RoomPanel({ session }: { session: Session }) {
  const { t } = useI18n()
  const [codeInput, setCodeInput] = useState('')
  const [copied, setCopied] = useState(false)
  const { status, role, roomCode, players, playerId } = session

  const busy = status === 'connecting'
  const online = role !== 'offline'

  const handleJoin = () => {
    const code = normalizeRoomCode(codeInput)
    if (code.length >= 4) void session.joinRoom(code)
  }

  const handleCopy = async () => {
    if (!roomCode) return
    try {
      await navigator.clipboard.writeText(roomCode)
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

  return (
    <section className="panel">
      <h2>{t('room.section')}</h2>

      {!online && (
        <div className="room-setup">
          <button type="button" className="primary" disabled={busy} onClick={() => void session.createRoom()}>
            {busy ? t('room.connecting') : t('room.create')}
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
              {t('room.join')}
            </button>
          </div>
          <p className="hint">{t('room.offline')}</p>
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
                onChange={(e) => session.setRoomName(e.target.value)}
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
        <h3>
          {t('room.players')} ({players.length})
        </h3>
        <ul>
          {players.map((p: Player) => (
            <li key={p.id}>
              <div className="player-row">
                <span className="player-dot" style={{ background: playerColor(p.id) }} />
                <span className="player-name" style={{ color: playerColor(p.id) }}>
                  {composeName(p.name, p.characterName) || t('player.anon')}
                </span>
                {p.isGM && <span className="badge gm">{t('room.gmBadge')}</span>}
                {p.id === playerId && <span className="badge you">{t('room.youBadge')}</span>}
              </div>
              {p.background.trim() && <p className="player-background">{p.background}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
