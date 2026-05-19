import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RollResult } from '../dice/types'
import type { Lang } from '../i18n/translations'
import { RoomManager, type RoomStatus } from '../net/room'
import {
  newChatId,
  normalizeRoomCode,
  redactRoll,
  staleGhostPeerIds,
  type ChatFile,
  type ChatMessage,
  type ClientMessage,
  type HostMessage,
  type Identity,
  type Player,
  type Snapshot,
  type TypingSignal,
} from '../net/protocol'
import { newMarkerId, type MarkerType, type SystemMarker } from '../feed/feed'
import { composeName } from '../players/identity'
import { getPlayerId, loadPlayerName, savePlayerName } from '../storage/player'
import { saveLastRoomCode } from '../storage/room'
import { appendLogEntries, appendLogEntry, clearRoomLog, loadRecentLog } from '../storage/roomLog'
import { clearActiveRoom, loadActiveRoom, saveActiveRoom } from '../storage/activeRoom'
import type { RoomImport } from '../storage/roomImport'
import { MAX_RECONNECT_ATTEMPTS, reconnectDelay } from '../net/reconnect'

export type Role = 'offline' | 'host' | 'client'
export type ErrorKind = 'connect' | 'hostLost' | 'codeTaken' | null

const MAX_HISTORY = 200
const MAX_CHAT = 200
const MAX_MARKERS = 100
/** Cap on chat messages held for an offline GM. */
const MAX_OUTBOX = 50
/** How long a "typing" signal stays live without a refresh. */
const TYPING_TTL_MS = 4000
/** Minimum gap between outgoing typing signals. */
const TYPING_THROTTLE_MS = 2000
/** How often stale typing signals are pruned. */
const TYPING_PRUNE_MS = 1200
/** How often a client sends a liveness ping to the host. */
const PING_INTERVAL_MS = 4000
/** How often the host checks for clients that have gone silent. */
const PRESENCE_CHECK_MS = 5000
/** A client unheard from for this long is treated as disconnected. */
const PRESENCE_TIMEOUT_MS = 13000
/** A host unheard from for this long is treated as offline by a client. */
const HOST_SILENCE_MS = 13000

interface TypingEntry {
  name: string
  at: number
}

export interface Session {
  playerId: string
  /** Player (person) name. */
  name: string
  /** Composed display name: "Character（Player）" or just the player. */
  displayName: string
  /** Update any part of the local player's identity (and re-sync it). */
  updateIdentity: (patch: Partial<Identity>) => void
  /** Set the local player's character portrait and sync it ('' clears it). */
  setCharacterImage: (image: string) => void
  role: Role
  status: RoomStatus
  roomCode: string | null
  /** GM-chosen room name ('' when unnamed). */
  roomName: string
  /** Set the room name (host only; broadcast to clients). */
  setRoomName: (name: string) => void
  errorKind: ErrorKind
  clearError: () => void
  /** Create a room; with a code, host exactly that code (else random). */
  createRoom: (preferredCode?: string) => Promise<void>
  joinRoom: (code: string) => Promise<void>
  /** On startup, resume the room from the URL — re-host (GM) or re-join. */
  resumeRoom: (urlCode: string) => Promise<void>
  /** Restore a room from a parsed export file by re-hosting it (offline only). */
  importRoom: (data: RoomImport) => Promise<void>
  /** Host only: change the live room's code; clients migrate automatically. */
  changeRoomCode: (code: string) => Promise<void>
  leaveRoom: () => void
  players: Player[]
  /** Character portrait images keyed by player id (synced apart from the roster). */
  playerImages: Record<string, string>
  history: RollResult[]
  chat: ChatMessage[]
  markers: SystemMarker[]
  /** Chat sent while the GM was offline, not yet delivered (shown pending). */
  outbox: ChatMessage[]
  /** True while reconnecting to a dropped room — the GM-offline state. */
  reconnecting: boolean
  /** Names of other players currently typing in chat. */
  typingNames: string[]
  isGM: boolean
  roll: (result: RollResult) => void
  sendChat: (text: string, file?: ChatFile, mentions?: string[], mentionsAll?: boolean) => void
  /** Signal that the local player is typing (throttled internally). */
  sendTyping: () => void
  /** Clear the local feed view (rolls, chat and markers). */
  clearFeed: () => void
}

/** Keep at most `max` items, dropping the oldest. */
function capEnd<T>(list: T[], max: number): T[] {
  return list.length > max ? list.slice(list.length - max) : list
}

/** Merge two id-keyed, timestamped lists, de-duplicating and sorting oldest-first. */
function mergeById<T extends { id: string; timestamp: number }>(
  a: T[],
  b: T[],
  max: number,
): T[] {
  const map = new Map<string, T>()
  for (const item of a) map.set(item.id, item)
  for (const item of b) map.set(item.id, item)
  const merged = [...map.values()].sort((m, n) => m.timestamp - n.timestamp)
  return capEnd(merged, max)
}

/**
 * Central session state: player identity, room membership and the shared
 * roll history / chat. Works offline as a single player and online as a
 * host-authoritative P2P room.
 */
export function useSession(): Session {
  const playerId = useMemo(() => getPlayerId(), [])

  const [name, setNameState] = useState<string>(loadPlayerName)
  const [characterName, setCharacterNameState] = useState('')
  const [background, setBackgroundState] = useState('')
  const [lang, setLangState] = useState<Lang>('ja')
  const [role, setRole] = useState<Role>('offline')
  const [status, setStatus] = useState<RoomStatus>('offline')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [roomName, setRoomNameState] = useState('')
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [playersState, setPlayers] = useState<Player[]>([])
  /** Character portrait images keyed by player id — synced apart from the
   *  roster, so the frequent `players` broadcast stays small. */
  const [playerImages, setPlayerImagesState] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<RollResult[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [markers, setMarkers] = useState<SystemMarker[]>([])
  const [typing, setTyping] = useState<Record<string, TypingEntry>>({})
  // Chat composed while the GM is unreachable: queued to send on reconnect
  // and shown as pending in the sender's own feed.
  const [outbox, setOutbox] = useState<ChatMessage[]>([])
  // Mirrors reconnectingRef for rendering — the GM-offline banner reads it.
  const [reconnecting, setReconnecting] = useState(false)

  // Identity refs are written directly by updateIdentity so a re-sync can
  // read the new values synchronously.
  const nameRef = useRef(name)
  const characterNameRef = useRef(characterName)
  const backgroundRef = useRef(background)
  const langRef = useRef(lang)
  /** The local player's character portrait, read synchronously on re-sync. */
  const ownImageRef = useRef('')
  /** All players' portraits, mirrored so PeerJS callbacks read current values. */
  const playerImagesRef = useRef(playerImages)
  // These refs mirror state so PeerJS callbacks always read current values.
  const roleRef = useRef(role)
  const historyRef = useRef(history)
  const chatRef = useRef(chat)
  const roomCodeRef = useRef(roomCode)
  const roomNameRef = useRef(roomName)
  const outboxRef = useRef(outbox)
  useEffect(() => {
    roleRef.current = role
    historyRef.current = history
    chatRef.current = chat
    roomCodeRef.current = roomCode
    roomNameRef.current = roomName
    outboxRef.current = outbox
  })

  /** True once a graceful room close was received, so the following
   *  connection drop is not reported as an unexpected error. */
  const gracefulCloseRef = useRef(false)
  /** True while the local player is deliberately leaving — suppresses the
   *  auto-reconnect that an unintentional drop would otherwise start. */
  const intentionalLeaveRef = useRef(false)
  /** True while an auto-reconnect loop is in progress. */
  const reconnectingRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Holds the latest attemptReconnect so the retry timer can recurse. */
  const attemptReconnectRef = useRef<
    (role: 'host' | 'client', code: string, attempt: number) => void
  >(() => {})
  /** Holds the latest connection-error handler for the RoomManager. */
  const connErrorRef = useRef<(kind: 'connect' | 'hostLost' | 'peerLost') => void>(() => {})
  const lastTypingSentRef = useRef(0)
  /** Client: timestamp of the last message heard from the host. */
  const lastHostMsgRef = useRef(0)
  /** Host only: connected clients keyed by their PeerJS peer id. */
  const peerPlayersRef = useRef(new Map<string, Player>())
  /** Host only: last time each client peer was heard from. */
  const lastSeenRef = useRef(new Map<string, number>())
  const roomRef = useRef<RoomManager | null>(null)

  // The in-memory feed is capped for rendering; every entry is also
  // appended to the durable per-room log so the full history survives.
  const appendHistory = useCallback((result: RollResult) => {
    setHistory((prev) => capEnd([...prev, result], MAX_HISTORY))
    void appendLogEntry(roomCodeRef.current, 'roll', result)
  }, [])
  const appendChat = useCallback((message: ChatMessage) => {
    setChat((prev) => capEnd([...prev, message], MAX_CHAT))
    void appendLogEntry(roomCodeRef.current, 'chat', message)
  }, [])
  const addMarker = useCallback((type: MarkerType, extra?: Partial<SystemMarker>) => {
    const marker: SystemMarker = { id: newMarkerId(), timestamp: Date.now(), type, ...extra }
    setMarkers((prev) => capEnd([...prev, marker], MAX_MARKERS))
    void appendLogEntry(roomCodeRef.current, 'marker', marker)
  }, [])
  const noteTyping = useCallback((signal: TypingSignal) => {
    setTyping((prev) => ({ ...prev, [signal.playerId]: { name: signal.playerName, at: Date.now() } }))
  }, [])

  /** Replace the whole portrait map — ref and state move together. */
  const setPlayerImages = useCallback((next: Record<string, string>) => {
    playerImagesRef.current = next
    setPlayerImagesState(next)
  }, [])

  /** Set or clear one player's portrait. */
  const putPlayerImage = useCallback(
    (id: string, image: string) => {
      const next = { ...playerImagesRef.current }
      if (image) next[id] = image
      else delete next[id]
      setPlayerImages(next)
    },
    [setPlayerImages],
  )

  const selfPlayer = useCallback(
    (asGM: boolean): Player => ({
      id: playerId,
      name: nameRef.current,
      isGM: asGM,
      characterName: characterNameRef.current,
      background: backgroundRef.current,
      lang: langRef.current,
    }),
    [playerId],
  )

  /** Host: the full roster — the GM first, then every connected client. */
  const buildRoster = useCallback(
    (): Player[] => [selfPlayer(true), ...peerPlayersRef.current.values()],
    [selfPlayer],
  )

  /** Host: rebuild the player list (GM first) and push it to everyone. */
  const broadcastPlayers = useCallback(() => {
    const list = buildRoster()
    setPlayers(list)
    roomRef.current?.broadcast({ t: 'players', players: list })
  }, [buildRoster])

  // --- Host: handle a message from a client -------------------------------
  const handleClientMessage = useCallback(
    (peerId: string, msg: ClientMessage) => {
      // Any message proves the client is still alive.
      lastSeenRef.current.set(peerId, Date.now())
      switch (msg.t) {
        case 'hello': {
          const player: Player = { ...msg.player, isGM: false }
          // Evict any ghost connection left by an earlier session of the
          // same player (a drop without a clean "leave"), so a player is
          // never listed twice.
          for (const ghostId of staleGhostPeerIds(peerPlayersRef.current, player.id, peerId)) {
            peerPlayersRef.current.delete(ghostId)
            lastSeenRef.current.delete(ghostId)
            roomRef.current?.dropClient(ghostId)
          }
          peerPlayersRef.current.set(peerId, player)
          const snapshot: Snapshot = {
            players: buildRoster(),
            history: historyRef.current.map(redactRoll),
            chat: chatRef.current,
            roomName: roomNameRef.current,
            images: { ...playerImagesRef.current },
          }
          roomRef.current?.sendTo(peerId, { t: 'welcome', snapshot })
          broadcastPlayers()
          const shown = composeName(player.name, player.characterName)
          addMarker('playerJoined', { playerName: shown })
          roomRef.current?.broadcast({
            t: 'notice',
            event: 'playerJoined',
            playerName: shown,
            timestamp: Date.now(),
          })
          break
        }
        case 'identity': {
          const existing = peerPlayersRef.current.get(peerId)
          if (existing) {
            peerPlayersRef.current.set(peerId, { ...existing, ...msg.identity })
            broadcastPlayers()
          }
          break
        }
        case 'image': {
          // Relay a client's portrait to everyone, keyed by its player id.
          const sender = peerPlayersRef.current.get(peerId)
          if (sender) {
            putPlayerImage(sender.id, msg.image)
            roomRef.current?.broadcast({ t: 'image', playerId: sender.id, image: msg.image })
          }
          break
        }
        case 'roll': {
          // Only the GM may hide rolls; client rolls are always visible.
          const result: RollResult = { ...msg.result, hidden: false }
          appendHistory(result)
          roomRef.current?.broadcast({ t: 'roll', result })
          break
        }
        case 'chat': {
          appendChat(msg.message)
          roomRef.current?.broadcast({ t: 'chat', message: msg.message })
          break
        }
        case 'typing': {
          noteTyping(msg.signal)
          roomRef.current?.broadcast({ t: 'typing', signal: msg.signal })
          break
        }
        case 'ping':
          // Liveness already recorded above; nothing else to do.
          break
      }
    },
    [addMarker, appendChat, appendHistory, broadcastPlayers, buildRoster, noteTyping, putPlayerImage],
  )

  /** Set the reconnecting flag — a ref for sync reads, state for rendering. */
  const markReconnecting = useCallback((on: boolean) => {
    reconnectingRef.current = on
    setReconnecting(on)
  }, [])

  const goOffline = useCallback(() => {
    // Stop any reconnect loop — going offline is final.
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    markReconnecting(false)
    // Queued sends die with the room — there is nowhere to deliver them.
    setOutbox([])
    // No longer in a room — a later reload should not try to resume it.
    clearActiveRoom()
    // Clear the roster first so the disconnect events fired while closing
    // do not produce a "player left" marker for every client.
    peerPlayersRef.current.clear()
    lastSeenRef.current.clear()
    roomRef.current?.close()
    roomRef.current = null
    setRole('offline')
    setStatus('offline')
    setRoomCode(null)
    roomNameRef.current = ''
    setRoomNameState('')
    setTyping({})
  }, [markReconnecting])

  // --- Client: handle a message from the host -----------------------------
  const handleHostMessage = useCallback(
    (msg: HostMessage) => {
      // Any message proves the host is still reachable.
      lastHostMsgRef.current = Date.now()
      switch (msg.t) {
        case 'welcome': {
          // Keep the player's pre-join rolls/chat by merging the snapshot in.
          setPlayers(msg.snapshot.players)
          // Adopt the host's portrait map, keeping the local player's own.
          {
            const images = { ...msg.snapshot.images }
            if (ownImageRef.current) images[playerId] = ownImageRef.current
            setPlayerImages(images)
          }
          setHistory((prev) => mergeById(prev, msg.snapshot.history, MAX_HISTORY))
          setChat((prev) => mergeById(prev, msg.snapshot.chat, MAX_CHAT))
          roomNameRef.current = msg.snapshot.roomName
          setRoomNameState(msg.snapshot.roomName)
          // Record the snapshot in the durable log (put() upserts, so a
          // re-welcome does not duplicate entries).
          const code = roomCodeRef.current
          for (const roll of msg.snapshot.history) void appendLogEntry(code, 'roll', roll)
          for (const message of msg.snapshot.chat) void appendLogEntry(code, 'chat', message)
          break
        }
        case 'roomName':
          roomNameRef.current = msg.name
          setRoomNameState(msg.name)
          break
        case 'roomCodeChanged': {
          // The GM moved the room to a new code. Follow it over, keeping
          // the feed, by re-joining through the reconnect machinery.
          const newCode = msg.code
          setRoomCode(newCode)
          roomCodeRef.current = newCode
          saveLastRoomCode(newCode)
          saveActiveRoom({ code: newCode, role: 'client' })
          addMarker('codeChanged', { roomCode: newCode })
          if (!reconnectingRef.current) {
            markReconnecting(true)
            attemptReconnectRef.current('client', newCode, 1)
          }
          break
        }
        case 'players':
          setPlayers(msg.players)
          break
        case 'image':
          putPlayerImage(msg.playerId, msg.image)
          break
        case 'roll':
          appendHistory(msg.result)
          break
        case 'chat':
          appendChat(msg.message)
          // A queued message that just echoed back is delivered now.
          setOutbox((prev) =>
            prev.some((m) => m.id === msg.message.id)
              ? prev.filter((m) => m.id !== msg.message.id)
              : prev,
          )
          break
        case 'typing':
          noteTyping(msg.signal)
          break
        case 'notice':
          addMarker(msg.event, { playerName: msg.playerName, timestamp: msg.timestamp })
          break
        case 'alive':
          // A keepalive; the timestamp recorded above is all it carries.
          break
        case 'roomClosed':
          gracefulCloseRef.current = true
          addMarker('gmClosed', { roomCode: roomCodeRef.current ?? undefined })
          goOffline()
          break
      }
    },
    [
      addMarker,
      appendChat,
      appendHistory,
      goOffline,
      markReconnecting,
      noteTyping,
      playerId,
      putPlayerImage,
      setPlayerImages,
    ],
  )

  const handleClientDisconnect = useCallback(
    (peerId: string) => {
      const gone = peerPlayersRef.current.get(peerId)
      lastSeenRef.current.delete(peerId)
      if (peerPlayersRef.current.delete(peerId)) {
        broadcastPlayers()
        if (gone) {
          // Drop the departed player's portrait so it is not carried in
          // later welcome snapshots.
          putPlayerImage(gone.id, '')
          const shown = composeName(gone.name, gone.characterName)
          addMarker('playerLeft', { playerName: shown })
          roomRef.current?.broadcast({
            t: 'notice',
            event: 'playerLeft',
            playerName: shown,
            timestamp: Date.now(),
          })
        }
      }
    },
    [addMarker, broadcastPlayers, putPlayerImage],
  )

  const ensureRoom = useCallback((): RoomManager => {
    if (roomRef.current) return roomRef.current
    const mgr = new RoomManager({
      onStatus: setStatus,
      onClientMessage: handleClientMessage,
      onClientDisconnect: handleClientDisconnect,
      onHostMessage: handleHostMessage,
      // Routed through a ref so the handler can be redefined freely without
      // forcing a new RoomManager on every render.
      onError: (kind) => connErrorRef.current(kind),
    })
    roomRef.current = mgr
    return mgr
  }, [handleClientDisconnect, handleClientMessage, handleHostMessage])

  // --- Public actions -----------------------------------------------------
  const createRoom = useCallback(
    async (preferredCode?: string) => {
      setErrorKind(null)
      gracefulCloseRef.current = false
      intentionalLeaveRef.current = false
      // A code under 4 chars is treated as "no code" — host a random one.
      const wanted = preferredCode ? normalizeRoomCode(preferredCode) : ''
      const mgr = ensureRoom()
      try {
        const code = await mgr.host(wanted.length >= 4 ? wanted : undefined)
        peerPlayersRef.current.clear()
        setRole('host')
        setRoomCode(code)
        // Eagerly set the ref so the marker below is logged under this room.
        roomCodeRef.current = code
        saveLastRoomCode(code)
        saveActiveRoom({ code, role: 'host' })
        roomNameRef.current = ''
        setRoomNameState('')
        setPlayers([selfPlayer(true)])
        addMarker('created', { roomCode: code })
      } catch (err) {
        // A requested code already taken by another room is distinct from
        // a generic connection failure.
        setErrorKind(err === 'unavailable-id' ? 'codeTaken' : 'connect')
        goOffline()
      }
    },
    [addMarker, ensureRoom, goOffline, selfPlayer],
  )

  const joinRoom = useCallback(
    async (code: string) => {
      setErrorKind(null)
      gracefulCloseRef.current = false
      intentionalLeaveRef.current = false
      const mgr = ensureRoom()
      try {
        await mgr.join(code)
        setRole('client')
        setRoomCode(code)
        // Eagerly set the ref so the marker below is logged under this room.
        roomCodeRef.current = code
        saveLastRoomCode(code)
        saveActiveRoom({ code, role: 'client' })
        addMarker('joined', { roomCode: code })
        mgr.sendToHost({ t: 'hello', player: selfPlayer(false) })
        // The portrait travels apart from `hello` (the roster stays light).
        if (ownImageRef.current) mgr.sendToHost({ t: 'image', image: ownImageRef.current })
      } catch {
        // onError already surfaced the failure.
        goOffline()
      }
    },
    [addMarker, ensureRoom, goOffline, selfPlayer],
  )

  const leaveRoom = useCallback(() => {
    // Mark this as deliberate so the connection drop does not auto-reconnect.
    intentionalLeaveRef.current = true
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    markReconnecting(false)
    const currentRole = roleRef.current
    if (currentRole === 'host') {
      // Closing the room ends it for everyone: tell clients, then tear down.
      roomRef.current?.broadcast({ t: 'roomClosed' })
      addMarker('youClosed', { roomCode: roomCodeRef.current ?? undefined })
      setTimeout(() => goOffline(), 300)
    } else if (currentRole === 'client') {
      addMarker('youLeft', { roomCode: roomCodeRef.current ?? undefined })
      goOffline()
    }
  }, [addMarker, goOffline, markReconnecting])

  // --- Auto-reconnect after an unintentional disconnect -------------------
  // One attempt at re-establishing the room. The transport is rebuilt from
  // scratch each time; on failure it schedules the next attempt with a
  // growing backoff, and after MAX_RECONNECT_ATTEMPTS it gives up.
  const attemptReconnect = useCallback(
    (role: 'host' | 'client', code: string, attempt: number) => {
      if (intentionalLeaveRef.current) {
        markReconnecting(false)
        return
      }
      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        markReconnecting(false)
        addMarker('reconnectFailed', { roomCode: code })
        setErrorKind('hostLost')
        goOffline()
        return
      }
      setStatus('connecting')
      // Each attempt uses a fresh RoomManager so no stale peer lingers.
      roomRef.current?.close()
      roomRef.current = null
      const mgr = ensureRoom()
      const succeed = () => {
        markReconnecting(false)
        setErrorKind(null)
        setStatus('connected')
        addMarker('reconnected', { roomCode: code })
      }
      const retry = () => {
        if (intentionalLeaveRef.current) {
          markReconnecting(false)
          return
        }
        reconnectTimerRef.current = setTimeout(
          () => attemptReconnectRef.current(role, code, attempt + 1),
          reconnectDelay(attempt),
        )
      }
      if (role === 'host') {
        mgr
          .host(code)
          .then(() => {
            // Clients reconnect on their own and re-introduce themselves.
            peerPlayersRef.current.clear()
            lastSeenRef.current.clear()
            setRole('host')
            setPlayers([selfPlayer(true)])
            succeed()
          })
          .catch(retry)
      } else {
        mgr
          .join(code)
          .then(() => {
            setRole('client')
            mgr.sendToHost({ t: 'hello', player: selfPlayer(false) })
            if (ownImageRef.current) mgr.sendToHost({ t: 'image', image: ownImageRef.current })
            // Flush messages queued while the GM was unreachable, in order.
            for (const message of outboxRef.current) {
              mgr.sendToHost({ t: 'chat', message })
            }
            succeed()
          })
          .catch(retry)
      }
    },
    [addMarker, ensureRoom, goOffline, markReconnecting, selfPlayer],
  )

  // Decide what to do when the RoomManager reports connection trouble.
  const handleConnError = useCallback(
    (kind: 'connect' | 'hostLost' | 'peerLost') => {
      if (kind === 'connect') {
        // Per-attempt failures during a reconnect loop are expected; the
        // loop handles its own retries, so do not surface them.
        if (!reconnectingRef.current) setErrorKind('connect')
        return
      }
      // hostLost / peerLost: an established room dropped.
      if (gracefulCloseRef.current) return // the GM closed it on purpose
      if (intentionalLeaveRef.current) return // we are leaving on purpose
      if (reconnectingRef.current) return // a reconnect loop is already running
      const code = roomCodeRef.current
      const role = roleRef.current
      if (!code || (role !== 'host' && role !== 'client')) {
        // Nothing to reconnect to — fall back to the plain error.
        setErrorKind('hostLost')
        addMarker('hostLost')
        goOffline()
        return
      }
      markReconnecting(true)
      addMarker('reconnecting', { roomCode: code })
      attemptReconnectRef.current(role, code, 1)
    },
    [addMarker, goOffline, markReconnecting],
  )

  // Keep the refs the RoomManager / retry timer call pointed at the latest.
  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect
    connErrorRef.current = handleConnError
  }, [attemptReconnect, handleConnError])

  /**
   * Host: change the live room's code. A new peer is claimed first (so a
   * code already used by another room is rejected without disturbing this
   * room); clients are then told to migrate and the room switches over.
   * The feed survives on both ends because no one goes offline.
   */
  const changeRoomCode = useCallback(
    async (rawCode: string) => {
      if (roleRef.current !== 'host') return
      const code = normalizeRoomCode(rawCode)
      if (code.length < 4 || code === roomCodeRef.current) return
      const mgr = roomRef.current
      if (!mgr) return
      setErrorKind(null)
      try {
        await mgr.prepareCodeChange(code)
      } catch {
        // The code belongs to another room — leave this room as it was.
        setErrorKind('codeTaken')
        return
      }
      // Tell current clients the new code, let the message land, then
      // switch the room onto the new peer.
      mgr.broadcast({ t: 'roomCodeChanged', code })
      setTimeout(() => {
        if (roleRef.current !== 'host' || roomRef.current !== mgr) {
          mgr.cancelCodeChange()
          return
        }
        mgr.commitCodeChange()
        setRoomCode(code)
        roomCodeRef.current = code
        saveLastRoomCode(code)
        saveActiveRoom({ code, role: 'host' })
        addMarker('codeChanged', { roomCode: code })
      }, 500)
    },
    [addMarker],
  )

  /**
   * On startup, resume the room named by the URL `?room=` code. If this
   * tab was the GM of that room (per the sessionStorage pointer), restore
   * the feed from the durable log and re-host the same code; otherwise
   * re-join it. Called once on mount.
   */
  const resumeRoom = useCallback(
    async (urlCode: string) => {
      const code = normalizeRoomCode(urlCode)
      if (code.length < 4) return
      const pointer = loadActiveRoom()
      const resuming = pointer?.code === code
      if (resuming) {
        // Restore the recent feed from this room's durable log.
        const entries = await loadRecentLog(code, 500)
        const rolls = entries.filter((e) => e.kind === 'roll').map((e) => e.data as RollResult)
        const chats = entries.filter((e) => e.kind === 'chat').map((e) => e.data as ChatMessage)
        const marks = entries
          .filter((e) => e.kind === 'marker')
          .map((e) => e.data as SystemMarker)
        if (rolls.length) setHistory(capEnd(rolls, MAX_HISTORY))
        if (chats.length) setChat(capEnd(chats, MAX_CHAT))
        if (marks.length) setMarkers(capEnd(marks, MAX_MARKERS))
      }
      setRoomCode(code)
      roomCodeRef.current = code
      if (resuming && pointer?.role === 'host') {
        // Re-host the same code; attemptReconnect retries while the broker
        // still holds the pre-reload peer id.
        markReconnecting(true)
        attemptReconnectRef.current('host', code, 1)
      } else {
        void joinRoom(code)
      }
    },
    [joinRoom, markReconnecting],
  )

  /**
   * Restore a room from a parsed export file: re-host its code, then seed
   * the durable log and the feed with the imported history. Behaves like
   * createRoom, but pre-populated rather than empty and without a fresh
   * "created" marker (the imported entries carry the room's own history).
   */
  const importRoom = useCallback(
    async (data: RoomImport) => {
      setErrorKind(null)
      gracefulCloseRef.current = false
      intentionalLeaveRef.current = false
      const code = normalizeRoomCode(data.roomCode)
      if (code.length < 4) return
      const mgr = ensureRoom()
      try {
        const hosted = await mgr.host(code)
        peerPlayersRef.current.clear()
        // Persist the imported history first, then show its recent window.
        await appendLogEntries(hosted, data.entries)
        const rolls = data.entries.filter((e) => e.kind === 'roll').map((e) => e.data as RollResult)
        const chats = data.entries.filter((e) => e.kind === 'chat').map((e) => e.data as ChatMessage)
        const marks = data.entries
          .filter((e) => e.kind === 'marker')
          .map((e) => e.data as SystemMarker)
        setHistory(capEnd(rolls, MAX_HISTORY))
        setChat(capEnd(chats, MAX_CHAT))
        setMarkers(capEnd(marks, MAX_MARKERS))
        setRole('host')
        setRoomCode(hosted)
        roomCodeRef.current = hosted
        saveLastRoomCode(hosted)
        saveActiveRoom({ code: hosted, role: 'host' })
        roomNameRef.current = data.roomName
        setRoomNameState(data.roomName)
        setPlayers([selfPlayer(true)])
      } catch (err) {
        setErrorKind(err === 'unavailable-id' ? 'codeTaken' : 'connect')
        goOffline()
      }
    },
    [ensureRoom, goOffline, selfPlayer],
  )

  const roll = useCallback(
    (result: RollResult) => {
      const currentRole = roleRef.current
      if (currentRole === 'host') {
        appendHistory(result)
        roomRef.current?.broadcast({ t: 'roll', result: redactRoll(result) })
      } else if (currentRole === 'client') {
        roomRef.current?.sendToHost({ t: 'roll', result: { ...result, hidden: false } })
      } else {
        appendHistory(result)
      }
    },
    [appendHistory],
  )

  const sendChat = useCallback(
    (text: string, file?: ChatFile, mentions: string[] = [], mentionsAll = false) => {
      const trimmed = text.trim()
      // A message needs either text or an attachment to be worth sending.
      if (!trimmed && !file) return
      const message: ChatMessage = {
        id: newChatId(),
        playerId,
        playerName: composeName(nameRef.current, characterNameRef.current) || '???',
        isGM: roleRef.current === 'host',
        characterName: characterNameRef.current,
        background: backgroundRef.current,
        text: trimmed,
        timestamp: Date.now(),
        lang: langRef.current,
        mentions,
        mentionsAll,
        ...(file ? { file } : {}),
      }
      const currentRole = roleRef.current
      if (currentRole === 'host') {
        appendChat(message)
        roomRef.current?.broadcast({ t: 'chat', message })
      } else if (currentRole === 'client') {
        // While the GM is unreachable, hold the message in the outbox and
        // show it as pending; the reconnect flush sends it in order.
        if (reconnectingRef.current) {
          setOutbox((prev) => capEnd([...prev, message], MAX_OUTBOX))
        } else {
          roomRef.current?.sendToHost({ t: 'chat', message })
        }
      } else {
        appendChat(message)
      }
    },
    [appendChat, playerId],
  )

  const sendTyping = useCallback(() => {
    const currentRole = roleRef.current
    if (currentRole === 'offline') return
    const now = Date.now()
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return
    lastTypingSentRef.current = now
    const signal: TypingSignal = {
      playerId,
      playerName: composeName(nameRef.current, characterNameRef.current) || '???',
    }
    if (currentRole === 'host') {
      roomRef.current?.broadcast({ t: 'typing', signal })
    } else {
      roomRef.current?.sendToHost({ t: 'typing', signal })
    }
  }, [playerId])

  const clearFeed = useCallback(() => {
    setHistory([])
    setChat([])
    setMarkers([])
    setOutbox([])
    // "Clear" also discards the room's durable log, so older entries are
    // not later resurfaced by an on-demand history load.
    void clearRoomLog(roomCodeRef.current)
  }, [])

  /** Re-publish the local identity after it changed. */
  const resyncIdentity = useCallback(() => {
    const currentRole = roleRef.current
    if (currentRole === 'host') {
      broadcastPlayers()
    } else if (currentRole === 'client') {
      roomRef.current?.sendToHost({
        t: 'identity',
        identity: {
          name: nameRef.current,
          characterName: characterNameRef.current,
          background: backgroundRef.current,
          lang: langRef.current,
        },
      })
    }
  }, [broadcastPlayers])

  const updateIdentity = useCallback(
    (patch: Partial<Identity>) => {
      if (patch.name !== undefined) {
        nameRef.current = patch.name
        setNameState(patch.name)
        savePlayerName(patch.name)
      }
      if (patch.characterName !== undefined) {
        characterNameRef.current = patch.characterName
        setCharacterNameState(patch.characterName)
      }
      if (patch.background !== undefined) {
        backgroundRef.current = patch.background
        setBackgroundState(patch.background)
      }
      if (patch.lang !== undefined) {
        langRef.current = patch.lang
        setLangState(patch.lang)
      }
      resyncIdentity()
    },
    [resyncIdentity],
  )

  /**
   * Set the local player's character portrait and sync it to the room.
   * Travels on its own message so the frequent roster broadcast stays
   * small; `''` clears the portrait.
   */
  const setCharacterImage = useCallback(
    (image: string) => {
      if (image === ownImageRef.current) return
      ownImageRef.current = image
      putPlayerImage(playerId, image)
      const currentRole = roleRef.current
      if (currentRole === 'host') {
        roomRef.current?.broadcast({ t: 'image', playerId, image })
      } else if (currentRole === 'client') {
        roomRef.current?.sendToHost({ t: 'image', image })
      }
    },
    [playerId, putPlayerImage],
  )

  /** Host: name (or rename) the room and broadcast it to clients. */
  const setRoomName = useCallback((name: string) => {
    roomNameRef.current = name
    setRoomNameState(name)
    if (roleRef.current === 'host') {
      roomRef.current?.broadcast({ t: 'roomName', name })
    }
  }, [])

  const clearError = useCallback(() => setErrorKind(null), [])

  // Drop stale typing signals so the indicator clears on its own.
  useEffect(() => {
    const timer = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now()
        const next: Record<string, TypingEntry> = {}
        let changed = false
        for (const [id, entry] of Object.entries(prev)) {
          if (now - entry.at < TYPING_TTL_MS) next[id] = entry
          else changed = true
        }
        return changed ? next : prev
      })
    }, TYPING_PRUNE_MS)
    return () => clearInterval(timer)
  }, [])

  // Presence: a client pings so the host notices abrupt disconnects, and a
  // host broadcasts keepalives so a client can tell a quiet GM from an
  // absent one — WebRTC itself is slow to report a vanished peer.
  useEffect(() => {
    if (role === 'client') {
      // A fresh connection counts as live until the first prolonged silence.
      lastHostMsgRef.current = Date.now()
      const timer = setInterval(() => {
        roomRef.current?.sendToHost({ t: 'ping' })
        if (!reconnectingRef.current && Date.now() - lastHostMsgRef.current > HOST_SILENCE_MS) {
          connErrorRef.current('hostLost')
        }
      }, PING_INTERVAL_MS)
      return () => clearInterval(timer)
    }
    if (role === 'host') {
      const timer = setInterval(() => {
        // Keepalive so clients can tell a quiet GM from an absent one.
        roomRef.current?.broadcast({ t: 'alive' })
        const now = Date.now()
        for (const [peerId, seen] of lastSeenRef.current) {
          if (now - seen > PRESENCE_TIMEOUT_MS) roomRef.current?.dropClient(peerId)
        }
      }, PRESENCE_CHECK_MS)
      return () => clearInterval(timer)
    }
  }, [role])

  // Tear down the peer when the app unmounts.
  useEffect(() => () => roomRef.current?.close(), [])

  // Offline: the player list is just the current player.
  const players: Player[] =
    role === 'offline'
      ? [{ id: playerId, name, isGM: false, characterName, background, lang }]
      : playersState

  // Self is excluded; stale entries are pruned by the interval above.
  const typingNames = Object.entries(typing)
    .filter(([id]) => id !== playerId)
    .map(([, entry]) => entry.name)

  return {
    playerId,
    name,
    displayName: composeName(name, characterName),
    updateIdentity,
    setCharacterImage,
    role,
    status,
    roomCode,
    roomName,
    setRoomName,
    errorKind,
    clearError,
    createRoom,
    joinRoom,
    resumeRoom,
    importRoom,
    changeRoomCode,
    leaveRoom,
    players,
    playerImages,
    history,
    chat,
    markers,
    outbox,
    reconnecting,
    typingNames,
    isGM: role === 'host',
    roll,
    sendChat,
    sendTyping,
    clearFeed,
  }
}
