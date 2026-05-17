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
} from '../net/protocol'
import { getPlayerId, loadPlayerName, savePlayerName } from '../storage/player'

export type Role = 'offline' | 'host' | 'client'
export type ErrorKind = 'connect' | 'hostLost' | null

const MAX_HISTORY = 200
const MAX_CHAT = 200

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
  isGM: boolean
  roll: (result: RollResult) => void
  sendChat: (text: string) => void
  clearHistory: () => void
}

function capStart<T>(list: T[], max: number): T[] {
  return list.length > max ? list.slice(0, max) : list
}
function capEnd<T>(list: T[], max: number): T[] {
  return list.length > max ? list.slice(list.length - max) : list
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

  // Refs mirror state so PeerJS callbacks always read current values.
  const roleRef = useRef(role)
  const nameRef = useRef(name)
  const historyRef = useRef(history)
  const chatRef = useRef(chat)
  useEffect(() => {
    roleRef.current = role
    nameRef.current = name
    historyRef.current = history
    chatRef.current = chat
  })

  /** Host only: connected clients keyed by their PeerJS peer id. */
  const peerPlayersRef = useRef(new Map<string, Player>())
  const roomRef = useRef<RoomManager | null>(null)

  const appendHistory = useCallback((result: RollResult) => {
    setHistory((prev) => capStart([result, ...prev], MAX_HISTORY))
  }, [])
  const appendChat = useCallback((message: ChatMessage) => {
    setChat((prev) => capEnd([...prev, message], MAX_CHAT))
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
      }
    },
    [appendChat, appendHistory, broadcastPlayers, selfPlayer],
  )

  // --- Client: handle a message from the host -----------------------------
  const handleHostMessage = useCallback(
    (msg: HostMessage) => {
      switch (msg.t) {
        case 'welcome':
          setPlayers(msg.snapshot.players)
          setHistory(capStart(msg.snapshot.history, MAX_HISTORY))
          setChat(capEnd(msg.snapshot.chat, MAX_CHAT))
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
      }
    },
    [appendChat, appendHistory],
  )

  const handleClientDisconnect = useCallback(
    (peerId: string) => {
      if (peerPlayersRef.current.delete(peerId)) broadcastPlayers()
    },
    [broadcastPlayers],
  )

  const goOffline = useCallback(() => {
    roomRef.current?.close()
    roomRef.current = null
    peerPlayersRef.current.clear()
    setRole('offline')
    setStatus('offline')
    setRoomCode(null)
  }, [])

  const ensureRoom = useCallback((): RoomManager => {
    if (roomRef.current) return roomRef.current
    const mgr = new RoomManager({
      onStatus: setStatus,
      onClientMessage: handleClientMessage,
      onClientDisconnect: handleClientDisconnect,
      onHostMessage: handleHostMessage,
      onError: (kind) => {
        setErrorKind(kind)
        if (kind === 'hostLost') goOffline()
      },
    })
    roomRef.current = mgr
    return mgr
  }, [handleClientDisconnect, handleClientMessage, handleHostMessage, goOffline])

  // --- Public actions -----------------------------------------------------
  const createRoom = useCallback(async () => {
    setErrorKind(null)
    const mgr = ensureRoom()
    try {
      const code = await mgr.host()
      peerPlayersRef.current.clear()
      setRole('host')
      setRoomCode(code)
      setPlayers([selfPlayer(true)])
    } catch {
      setErrorKind('connect')
      goOffline()
    }
  }, [ensureRoom, goOffline, selfPlayer])

  const joinRoom = useCallback(
    async (code: string) => {
      setErrorKind(null)
      const mgr = ensureRoom()
      try {
        await mgr.join(code)
        setRole('client')
        setRoomCode(code)
        mgr.sendToHost({ t: 'hello', player: selfPlayer(false) })
      } catch {
        // onError already surfaced the failure.
        goOffline()
      }
    },
    [ensureRoom, goOffline, selfPlayer],
  )

  const leaveRoom = useCallback(() => {
    goOffline()
  }, [goOffline])

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

  const clearHistory = useCallback(() => setHistory([]), [])

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

  // Tear down the peer when the app unmounts.
  useEffect(() => () => roomRef.current?.close(), [])

  // Offline: the player list is just the current player, derived from name.
  const players: Player[] =
    role === 'offline' ? [{ id: playerId, name, isGM: false }] : playersState

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
    isGM: role === 'host',
    roll,
    sendChat,
    clearHistory,
  }
}
