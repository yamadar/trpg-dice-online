import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RollResult } from '../dice/types'
import { RoomManager, type RoomStatus } from '../net/room'
import {
  newChatId,
  redactRoll,
  type ChatMessage,
  type ClientMessage,
  type HostMessage,
  type Player,
  type Snapshot,
  type TypingSignal,
} from '../net/protocol'
import { newMarkerId, type MarkerType, type SystemMarker } from '../feed/feed'
import { getPlayerId, loadPlayerName, savePlayerName } from '../storage/player'

export type Role = 'offline' | 'host' | 'client'
export type ErrorKind = 'connect' | 'hostLost' | null

const MAX_HISTORY = 200
const MAX_CHAT = 200
const MAX_MARKERS = 100
/** How long a "typing" signal stays live without a refresh. */
const TYPING_TTL_MS = 4000
/** Minimum gap between outgoing typing signals. */
const TYPING_THROTTLE_MS = 2000
/** How often stale typing signals are pruned. */
const TYPING_PRUNE_MS = 1200

interface TypingEntry {
  name: string
  at: number
}

export interface Session {
  playerId: string
  name: string
  setName: (name: string) => void
  role: Role
  status: RoomStatus
  roomCode: string | null
  errorKind: ErrorKind
  clearError: () => void
  createRoom: () => Promise<void>
  joinRoom: (code: string) => Promise<void>
  leaveRoom: () => void
  players: Player[]
  history: RollResult[]
  chat: ChatMessage[]
  markers: SystemMarker[]
  /** Names of other players currently typing in chat. */
  typingNames: string[]
  isGM: boolean
  roll: (result: RollResult) => void
  sendChat: (text: string) => void
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
  const [role, setRole] = useState<Role>('offline')
  const [status, setStatus] = useState<RoomStatus>('offline')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [playersState, setPlayers] = useState<Player[]>([])
  const [history, setHistory] = useState<RollResult[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [markers, setMarkers] = useState<SystemMarker[]>([])
  const [typing, setTyping] = useState<Record<string, TypingEntry>>({})

  // Refs mirror state so PeerJS callbacks always read current values.
  const roleRef = useRef(role)
  const nameRef = useRef(name)
  const historyRef = useRef(history)
  const chatRef = useRef(chat)
  const roomCodeRef = useRef(roomCode)
  useEffect(() => {
    roleRef.current = role
    nameRef.current = name
    historyRef.current = history
    chatRef.current = chat
    roomCodeRef.current = roomCode
  })

  /** True once a graceful room close was received, so the following
   *  connection drop is not reported as an unexpected error. */
  const gracefulCloseRef = useRef(false)
  const lastTypingSentRef = useRef(0)
  /** Host only: connected clients keyed by their PeerJS peer id. */
  const peerPlayersRef = useRef(new Map<string, Player>())
  const roomRef = useRef<RoomManager | null>(null)

  const appendHistory = useCallback((result: RollResult) => {
    setHistory((prev) => capEnd([...prev, result], MAX_HISTORY))
  }, [])
  const appendChat = useCallback((message: ChatMessage) => {
    setChat((prev) => capEnd([...prev, message], MAX_CHAT))
  }, [])
  const addMarker = useCallback((type: MarkerType, extra?: Partial<SystemMarker>) => {
    setMarkers((prev) =>
      capEnd(
        [...prev, { id: newMarkerId(), timestamp: Date.now(), type, ...extra }],
        MAX_MARKERS,
      ),
    )
  }, [])
  const noteTyping = useCallback((signal: TypingSignal) => {
    setTyping((prev) => ({ ...prev, [signal.playerId]: { name: signal.playerName, at: Date.now() } }))
  }, [])

  const selfPlayer = useCallback(
    (asGM: boolean): Player => ({ id: playerId, name: nameRef.current, isGM: asGM }),
    [playerId],
  )

  /** Host: rebuild the player list (GM first) and push it to everyone. */
  const broadcastPlayers = useCallback(() => {
    const list: Player[] = [selfPlayer(true), ...peerPlayersRef.current.values()]
    setPlayers(list)
    roomRef.current?.broadcast({ t: 'players', players: list })
  }, [selfPlayer])

  // --- Host: handle a message from a client -------------------------------
  const handleClientMessage = useCallback(
    (peerId: string, msg: ClientMessage) => {
      switch (msg.t) {
        case 'hello': {
          const player: Player = { ...msg.player, isGM: false }
          peerPlayersRef.current.set(peerId, player)
          const snapshot: Snapshot = {
            players: [selfPlayer(true), ...peerPlayersRef.current.values()],
            history: historyRef.current.map(redactRoll),
            chat: chatRef.current,
          }
          roomRef.current?.sendTo(peerId, { t: 'welcome', snapshot })
          broadcastPlayers()
          addMarker('playerJoined', { playerName: player.name })
          roomRef.current?.broadcast({
            t: 'notice',
            event: 'playerJoined',
            playerName: player.name,
            timestamp: Date.now(),
          })
          break
        }
        case 'rename': {
          const existing = peerPlayersRef.current.get(peerId)
          if (existing) {
            peerPlayersRef.current.set(peerId, { ...existing, name: msg.name })
            broadcastPlayers()
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
      }
    },
    [addMarker, appendChat, appendHistory, broadcastPlayers, noteTyping, selfPlayer],
  )

  const goOffline = useCallback(() => {
    roomRef.current?.close()
    roomRef.current = null
    peerPlayersRef.current.clear()
    setRole('offline')
    setStatus('offline')
    setRoomCode(null)
    setTyping({})
  }, [])

  // --- Client: handle a message from the host -----------------------------
  const handleHostMessage = useCallback(
    (msg: HostMessage) => {
      switch (msg.t) {
        case 'welcome':
          // Keep the player's pre-join rolls/chat by merging the snapshot in.
          setPlayers(msg.snapshot.players)
          setHistory((prev) => mergeById(prev, msg.snapshot.history, MAX_HISTORY))
          setChat((prev) => mergeById(prev, msg.snapshot.chat, MAX_CHAT))
          break
        case 'players':
          setPlayers(msg.players)
          break
        case 'roll':
          appendHistory(msg.result)
          break
        case 'chat':
          appendChat(msg.message)
          break
        case 'typing':
          noteTyping(msg.signal)
          break
        case 'notice':
          addMarker(msg.event, { playerName: msg.playerName, timestamp: msg.timestamp })
          break
        case 'roomClosed':
          gracefulCloseRef.current = true
          addMarker('gmClosed', { roomCode: roomCodeRef.current ?? undefined })
          goOffline()
          break
      }
    },
    [addMarker, appendChat, appendHistory, goOffline, noteTyping],
  )

  const handleClientDisconnect = useCallback(
    (peerId: string) => {
      const gone = peerPlayersRef.current.get(peerId)
      if (peerPlayersRef.current.delete(peerId)) {
        broadcastPlayers()
        if (gone) {
          addMarker('playerLeft', { playerName: gone.name })
          roomRef.current?.broadcast({
            t: 'notice',
            event: 'playerLeft',
            playerName: gone.name,
            timestamp: Date.now(),
          })
        }
      }
    },
    [addMarker, broadcastPlayers],
  )

  const ensureRoom = useCallback((): RoomManager => {
    if (roomRef.current) return roomRef.current
    const mgr = new RoomManager({
      onStatus: setStatus,
      onClientMessage: handleClientMessage,
      onClientDisconnect: handleClientDisconnect,
      onHostMessage: handleHostMessage,
      onError: (kind) => {
        if (kind === 'hostLost') {
          // A graceful "room closed" was already handled — ignore the drop.
          if (gracefulCloseRef.current) return
          setErrorKind('hostLost')
          addMarker('hostLost')
          goOffline()
        } else {
          setErrorKind('connect')
        }
      },
    })
    roomRef.current = mgr
    return mgr
  }, [addMarker, handleClientDisconnect, handleClientMessage, handleHostMessage, goOffline])

  // --- Public actions -----------------------------------------------------
  const createRoom = useCallback(async () => {
    setErrorKind(null)
    gracefulCloseRef.current = false
    const mgr = ensureRoom()
    try {
      const code = await mgr.host()
      peerPlayersRef.current.clear()
      setRole('host')
      setRoomCode(code)
      setPlayers([selfPlayer(true)])
      addMarker('created', { roomCode: code })
    } catch {
      setErrorKind('connect')
      goOffline()
    }
  }, [addMarker, ensureRoom, goOffline, selfPlayer])

  const joinRoom = useCallback(
    async (code: string) => {
      setErrorKind(null)
      gracefulCloseRef.current = false
      const mgr = ensureRoom()
      try {
        await mgr.join(code)
        setRole('client')
        setRoomCode(code)
        addMarker('joined', { roomCode: code })
        mgr.sendToHost({ t: 'hello', player: selfPlayer(false) })
      } catch {
        // onError already surfaced the failure.
        goOffline()
      }
    },
    [addMarker, ensureRoom, goOffline, selfPlayer],
  )

  const leaveRoom = useCallback(() => {
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
  }, [addMarker, goOffline])

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
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const message: ChatMessage = {
        id: newChatId(),
        playerId,
        playerName: nameRef.current || '???',
        text: trimmed,
        timestamp: Date.now(),
      }
      const currentRole = roleRef.current
      if (currentRole === 'host') {
        appendChat(message)
        roomRef.current?.broadcast({ t: 'chat', message })
      } else if (currentRole === 'client') {
        roomRef.current?.sendToHost({ t: 'chat', message })
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
    const signal: TypingSignal = { playerId, playerName: nameRef.current || '???' }
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
  }, [])

  const setName = useCallback(
    (next: string) => {
      setNameState(next)
      nameRef.current = next
      savePlayerName(next)
      const currentRole = roleRef.current
      if (currentRole === 'host') {
        const list: Player[] = [
          { id: playerId, name: next, isGM: true },
          ...peerPlayersRef.current.values(),
        ]
        setPlayers(list)
        roomRef.current?.broadcast({ t: 'players', players: list })
      } else if (currentRole === 'client') {
        roomRef.current?.sendToHost({ t: 'rename', name: next })
      }
    },
    [playerId],
  )

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

  // Tear down the peer when the app unmounts.
  useEffect(() => () => roomRef.current?.close(), [])

  // Offline: the player list is just the current player, derived from name.
  const players: Player[] =
    role === 'offline' ? [{ id: playerId, name, isGM: false }] : playersState

  // Self is excluded; stale entries are pruned by the interval above.
  const typingNames = Object.entries(typing)
    .filter(([id]) => id !== playerId)
    .map(([, entry]) => entry.name)

  return {
    playerId,
    name,
    setName,
    role,
    status,
    roomCode,
    errorKind,
    clearError,
    createRoom,
    joinRoom,
    leaveRoom,
    players,
    history,
    chat,
    markers,
    typingNames,
    isGM: role === 'host',
    roll,
    sendChat,
    sendTyping,
    clearFeed,
  }
}
