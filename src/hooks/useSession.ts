import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RollResult } from '../dice/types'
import type { Lang } from '../i18n/translations'
import { RoomManager, type RoomStatus } from '../net/room'
import {
  newChatId,
  normalizeRoomCode,
  redactRoll,
  sanitizeSyncedImage,
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
import {
  appendLogEntries,
  appendLogEntry,
  characterImagesKey,
  deleteSession,
  findReusableSession,
  legacyCharacterIdFromName,
  loadRecentLog,
  markSessionClosed,
  newSessionId,
  normalizeSpeakerEntry,
  saveSessionCharacter,
  saveSessionCharacters,
  type LogTarget,
  type SessionCharacterDraft,
} from '../storage/roomLog'
import {
  clearActiveRoom,
  loadActiveRoom,
  saveActiveRoom,
  updateActiveRoomName,
} from '../storage/activeRoom'
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
  /** Durable-log session id for the current room, or null when offline. */
  sessionId: string | null
  /** GM-chosen room name ('' when unnamed). */
  roomName: string
  /** Set the room name (host only; broadcast to clients). */
  setRoomName: (name: string) => void
  errorKind: ErrorKind
  clearError: () => void
  /** Create a room; with a code, host exactly that code (else random). An
   *  optional name pre-sets the room name. */
  createRoom: (preferredCode?: string, name?: string) => Promise<void>
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
  /**
   * Per-(player, character) records observed in the current session,
   * keyed by `${playerId}|${characterId}` — the canonical source for
   * rendering speaker info in the feed (display name, character name,
   * background, GM mark, portrait). The map survives a speaker leaving
   * the room so past entries keep rendering correctly. Typed with
   * explicit `| undefined` so consumers handle the missing-key case
   * (an unobserved character collapses to a colored dot rather than
   * reusing someone else's record).
   */
  sessionCharacters: Record<string, SessionCharacterDraft | undefined>
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
  const [characterId, setCharacterIdState] = useState('')
  const [characterName, setCharacterNameState] = useState('')
  const [background, setBackgroundState] = useState('')
  const [lang, setLangState] = useState<Lang>('ja')
  const [role, setRole] = useState<Role>('offline')
  const [status, setStatus] = useState<RoomStatus>('offline')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [roomName, setRoomNameState] = useState('')
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [playersState, setPlayers] = useState<Player[]>([])
  /** Character portrait images keyed by player id — synced apart from the
   *  roster, so the frequent `players` broadcast stays small. */
  const [playerImages, setPlayerImagesState] = useState<Record<string, string>>({})
  /** Per-(player, character) records keyed by `${playerId}|${characterId}`
   *  — updated whenever an observation lands. Carries the speaker fields
   *  (playerName / characterName / background / isGM) along with the
   *  portrait image, so the feed renders past entries without dipping
   *  back into the live roster. Updated below via render-phase setState
   *  (matching the codebase's pattern for "derive state from props"),
   *  so entries survive across renders without needing the
   *  `useEffect` + `setState` that the React 19 lint rule bans. */
  const [sessionCharacters, setSessionCharacters] = useState<
    Record<string, SessionCharacterDraft | undefined>
  >({})
  /** Tracks the inputs that produced the current `sessionCharacters`
   *  map, so the render-phase update fires exactly when any of them
   *  changed. */
  const [sessionCharactersInputs, setSessionCharactersInputs] = useState<{
    pid: string
    cid: string
    cn: string
    bg: string
    nm: string
    rl: Role
    pi: Record<string, string>
    ps: Player[]
    h: RollResult[]
    c: ChatMessage[]
  }>({
    pid: '',
    cid: '',
    cn: '',
    bg: '',
    nm: '',
    rl: 'offline',
    pi: {},
    ps: [],
    h: [],
    c: [],
  })
  const [history, setHistory] = useState<RollResult[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [markers, setMarkers] = useState<SystemMarker[]>([])
  const [typing, setTyping] = useState<Record<string, TypingEntry>>({})
  // Chat composed while the GM is unreachable: queued to send on reconnect
  // and shown as pending in the sender's own feed.
  const [outbox, setOutbox] = useState<ChatMessage[]>([])
  // Mirrors reconnectingRef for rendering — the GM-offline banner reads it.
  const [reconnecting, setReconnecting] = useState(false)

  /** Type of a single buffered (player, character) record save. The
   *  `sessionId` is captured at stage-time (not read from the live ref
   *  at flush-time) so an observation made just before the user leaves
   *  the room still persists to the right session even if
   *  `sessionIdRef` has already been cleared by `goOffline`. */
  type PortraitSave = {
    sessionId: string
  } & SessionCharacterDraft
  // Append-only queue of portrait writes. The `characterImages`
  // derivation block appends new deltas during render (via a functional
  // `setState` so concurrent commits do not clobber each other); the
  // flush effect below reads from `portraitFlushedCountRef.current` to
  // `length` and saves only the new tail, then advances the ref. This
  // splits the rules cleanly: the derivation never touches a ref or
  // calls `setState` inside an effect — neither pattern the React 19
  // strict-effect lint rules ban.
  const [portraitQueue, setPortraitQueue] = useState<ReadonlyArray<PortraitSave>>([])
  const portraitFlushedCountRef = useRef(0)
  // Promise chain so concurrent flush effects (a second commit landing
  // before the first IndexedDB transaction resolves) write in order
  // rather than racing — without it, the later batch could commit
  // first and the earlier batch's stale payload could overwrite it.
  const portraitFlushChainRef = useRef<Promise<void>>(Promise.resolve())
  // Once a flushed offset crosses this many entries, the flush
  // effect compacts the queue (slices off the prefix and resets the
  // offset) so a long session of frequent portrait changes does not
  // hold them all in memory forever. Tuned high enough that ordinary
  // sessions never trip it but a pathological case is still bounded.
  const PORTRAIT_QUEUE_COMPACT_AT = 64


  // Identity refs are written directly by updateIdentity so a re-sync can
  // read the new values synchronously.
  const nameRef = useRef(name)
  const characterIdRef = useRef(characterId)
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
  /** The durable-log session id — written directly so appends read it
   *  synchronously, mirrored to `sessionId` state for consumers. */
  const sessionIdRef = useRef<string | null>(null)
  const roomNameRef = useRef(roomName)
  const outboxRef = useRef(outbox)
  /**
   * Set the moment a roll, chat or imported snapshot lands on this session.
   * Read by `finalizeSession` on the way out so an empty drive-by session is
   * dropped while one that carried real content survives. Reset at the
   * start of every create / join — including the case where a still-open
   * session is reused, since `restoreFeedFromLog` then re-flips it on.
   * Kept as a ref because the post-welcome / post-roll exit can land in
   * the same micro-task as the state write, before `historyRef` / `chatRef`
   * catch up through the mirror effect.
   */
  const hasActivityRef = useRef(false)
  useEffect(() => {
    roleRef.current = role
    historyRef.current = history
    chatRef.current = chat
    roomCodeRef.current = roomCode
    roomNameRef.current = roomName
    outboxRef.current = outbox
  })

  // Snapshot every observed (player, character) record into
  // `sessionCharacters` during render whenever its inputs have changed.
  // Past entries are kept while still referenced by the live feed window
  // (history / chat are themselves capped), and unreferenced ones are
  // pruned so the map cannot grow unbounded across long sessions or
  // character churn. Uses the "adjust state during render" pattern React
  // recommends for derived state — same shape as the `popoverCharId`
  // reset in `CharacterPanel` — so the React 19 lint rule that bans
  // `setState` inside `useEffect` is honoured.
  if (
    sessionCharactersInputs.pid !== playerId ||
    sessionCharactersInputs.cid !== characterId ||
    sessionCharactersInputs.cn !== characterName ||
    sessionCharactersInputs.bg !== background ||
    sessionCharactersInputs.nm !== name ||
    sessionCharactersInputs.rl !== role ||
    sessionCharactersInputs.pi !== playerImages ||
    sessionCharactersInputs.ps !== playersState ||
    sessionCharactersInputs.h !== history ||
    sessionCharactersInputs.c !== chat
  ) {
    setSessionCharactersInputs({
      pid: playerId,
      cid: characterId,
      cn: characterName,
      bg: background,
      nm: name,
      rl: role,
      pi: playerImages,
      ps: playersState,
      h: history,
      c: chat,
    })
    let map = sessionCharacters
    let changed = false
    // Batched writes carry their own `sessionId` snapshot so a fast
    // leave/offline cannot strand them.
    const portraitDeltas: PortraitSave[] = []
    const stageSid = sessionId
    const put = (record: SessionCharacterDraft) => {
      const id = record.playerId
      if (!id) return
      const key = characterImagesKey(id, record.characterId)
      const existing = map[key]
      const isNewObservation =
        !existing ||
        existing.playerName !== record.playerName ||
        existing.characterName !== record.characterName ||
        existing.background !== record.background ||
        existing.isGM !== record.isGM ||
        existing.image !== record.image
      if (isNewObservation) {
        if (!changed) {
          map = { ...map }
          changed = true
        }
        map[key] = record
      }
      // Stage the full record for the flush effect — speaker fields land
      // in IndexedDB alongside the image so room history can render past
      // entries without the live session.
      if (stageSid) {
        portraitDeltas.push({ sessionId: stageSid, ...record })
      }
    }
    // The local player's current (character) snapshot — always staged so
    // the durable record carries the name / background even when there
    // is no portrait yet.
    put({
      playerId,
      characterId,
      playerName: composeName(name, characterName),
      characterName,
      background,
      isGM: role === 'host',
      image: playerImages[playerId] ?? '',
    })
    for (const p of playersState) {
      if (p.id === playerId) continue
      put({
        playerId: p.id,
        characterId: p.characterId ?? '',
        playerName: composeName(p.name, p.characterName),
        characterName: p.characterName,
        background: p.background,
        isGM: p.isGM,
        image: playerImages[p.id] ?? '',
      })
    }
    // Prune keys that no live observation or feed entry references. Each
    // entry only survives if its (playerId, characterId) pair appears
    // in current identity, the current roster, or a roll / chat still
    // inside the in-memory feed window. Legacy entries (with no
    // `characterId` field) are matched via the v4→v5 synthesised
    // `@n:<encoded characterName>` id so old roomLog data keeps a
    // pruning anchor.
    const needed = new Set<string>()
    const noteKey = (id: string, cid: string) => {
      if (id) needed.add(characterImagesKey(id, cid))
    }
    const legacySpeakerCid = (entry: unknown): string => {
      const e = entry as { characterId?: string; characterName?: string }
      // Match the semantics of `speakerImageKey` / `normalizeSpeakerEntry`:
      // an explicit empty `characterId` means "the player was acting
      // directly" and must stay empty, not fall back to a synthesised
      // `@n:<name>`. Falling back on `''` would anchor pruning on a
      // different key from the one rendering uses, leaving the wrong
      // record alive while pruning the right one.
      return e.characterId !== undefined
        ? e.characterId
        : legacyCharacterIdFromName(e.characterName ?? '')
    }
    noteKey(playerId, characterId)
    for (const p of playersState) noteKey(p.id, p.characterId ?? '')
    for (const r of history) noteKey(r.playerId, legacySpeakerCid(r))
    for (const m of chat) noteKey(m.playerId, legacySpeakerCid(m))
    for (const key of Object.keys(map)) {
      if (needed.has(key)) continue
      if (!changed) {
        map = { ...map }
        changed = true
      }
      delete map[key]
    }
    if (changed) setSessionCharacters(map)
    // Append the staged deltas to the persistent queue. Functional
    // `setState` guarantees consecutive derivations layer onto each
    // other instead of clobbering — the flush effect's offset ref
    // (`portraitFlushedCountRef`) skips already-written entries.
    if (portraitDeltas.length > 0) {
      const newBatch = portraitDeltas
      setPortraitQueue((prev) => prev.concat(newBatch))
    }
  }

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

  /** The current durable-log target, or null when not in a room. */
  const logTarget = useCallback((): LogTarget | null => {
    const sid = sessionIdRef.current
    if (!sid) return null
    return {
      sessionId: sid,
      roomCode: roomCodeRef.current ?? '',
      roomName: roomNameRef.current,
      role: roleRef.current === 'host' ? 'host' : 'client',
    }
  }, [])

  // The in-memory feed is capped for rendering; every entry is also
  // appended to the durable per-session log so the full history survives.
  const appendHistory = useCallback(
    (result: RollResult) => {
      hasActivityRef.current = true
      setHistory((prev) => capEnd([...prev, result], MAX_HISTORY))
      void appendLogEntry(logTarget(), 'roll', result)
    },
    [logTarget],
  )
  const appendChat = useCallback(
    (message: ChatMessage) => {
      hasActivityRef.current = true
      setChat((prev) => capEnd([...prev, message], MAX_CHAT))
      void appendLogEntry(logTarget(), 'chat', message)
    },
    [logTarget],
  )
  const addMarker = useCallback(
    (type: MarkerType, extra?: Partial<SystemMarker>) => {
      const marker: SystemMarker = { id: newMarkerId(), timestamp: Date.now(), type, ...extra }
      setMarkers((prev) => capEnd([...prev, marker], MAX_MARKERS))
      void appendLogEntry(logTarget(), 'marker', marker)
    },
    [logTarget],
  )
  const noteTyping = useCallback((signal: TypingSignal) => {
    setTyping((prev) => ({ ...prev, [signal.playerId]: { name: signal.playerName, at: Date.now() } }))
  }, [])

  /** Replace the whole portrait map — ref and state move together. */
  const setPlayerImages = useCallback((next: Record<string, string>) => {
    playerImagesRef.current = next
    setPlayerImagesState(next)
  }, [])

  /** Set or clear one player's portrait. The matching
   *  per-(player, character) persistence happens by way of the
   *  `characterImages` derivation block above: when that block sees a
   *  new (or cleared) image, it pushes a delta onto `portraitQueue`,
   *  and a separate `useEffect` further down coalesces / groups those
   *  deltas and writes them via `saveCharacterPortraits` — keeping
   *  IndexedDB I/O out of the render phase. */
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
      characterId: characterIdRef.current,
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
          // Filter the snapshot's images down to the current roster.
          // Disconnected players' entries are kept in
          // `playerImagesRef` (see `handleClientDisconnect`) so the
          // durable per-character record this session has persisted
          // does not get mistakenly wiped; but a new client must not
          // see images of players no longer in the room.
          const roster = buildRoster()
          const rosterIds = new Set(roster.map((p) => p.id))
          const snapshotImages: Record<string, string> = {}
          for (const [id, img] of Object.entries(playerImagesRef.current)) {
            if (rosterIds.has(id) && img) snapshotImages[id] = img
          }
          const snapshot: Snapshot = {
            players: roster,
            history: historyRef.current.map(redactRoll),
            chat: chatRef.current,
            roomName: roomNameRef.current,
            images: snapshotImages,
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
            // Take only the known identity fields from the (untrusted)
            // client message — never let it overwrite the host-side id or
            // the isGM flag (which `hello` already fixed to false).
            const { name, characterId, characterName, background, lang } = msg.identity
            peerPlayersRef.current.set(peerId, {
              ...existing,
              name,
              characterId,
              characterName,
              background,
              lang,
            })
            broadcastPlayers()
          }
          break
        }
        case 'image': {
          // Relay a client's portrait to everyone, keyed by its player id.
          // The portrait is untrusted, so sanitize before storing/relaying.
          const sender = peerPlayersRef.current.get(peerId)
          if (sender) {
            const image = sanitizeSyncedImage(msg.image)
            putPlayerImage(sender.id, image)
            roomRef.current?.broadcast({ t: 'image', playerId: sender.id, image })
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
    setSessionId(null)
    // Clear the refs eagerly too (mirrors createRoom / joinRoom) so a stray
    // offline log write cannot land under the room just left.
    roomCodeRef.current = null
    sessionIdRef.current = null
    roomNameRef.current = ''
    setRoomNameState('')
    setTyping({})
  }, [markReconnecting])

  /**
   * Decide what to do with the durable log on the way out of a room:
   *  - No user activity (no roll, no chat) → drop the session entirely
   *    so a quick join-and-leave doesn't litter the history list.
   *  - `closing` (host closed, or client received gmClosed) → tag the
   *    session as closed so a later visit to the same code starts fresh.
   *  - Otherwise (deliberate leave, dropped connection) → leave it open,
   *    so re-entering the same code resumes this same history.
   */
  const finalizeSession = useCallback((closing: boolean) => {
    const sid = sessionIdRef.current
    if (!sid) return
    if (!hasActivityRef.current) {
      void deleteSession(sid)
    } else if (closing) {
      void markSessionClosed(sid)
    }
  }, [])

  // --- Client: handle a message from the host -----------------------------
  const handleHostMessage = useCallback(
    (msg: HostMessage) => {
      // Any message proves the host is still reachable.
      lastHostMsgRef.current = Date.now()
      switch (msg.t) {
        case 'welcome': {
          // Keep the player's pre-join rolls/chat by merging the snapshot in.
          setPlayers(msg.snapshot.players)
          // Adopt the host's portrait map — each entry is untrusted, so
          // sanitize it — while keeping the local player's own portrait.
          {
            const images: Record<string, string> = {}
            for (const [id, img] of Object.entries(msg.snapshot.images ?? {})) {
              const clean = sanitizeSyncedImage(img)
              if (clean) images[id] = clean
            }
            if (ownImageRef.current) images[playerId] = ownImageRef.current
            setPlayerImages(images)
            // Persist the per-(player, character) snapshot — the
            // speaker fields the feed needs land in IndexedDB alongside
            // the image so room history can render past entries
            // without the live session. (The render-phase derivation
            // also covers this for the in-memory map; the explicit
            // write here makes sure a freshly joined room's welcome
            // commits to disk even if the player navigates away
            // before the next render-phase tick.)
            const drafts: SessionCharacterDraft[] = []
            for (const p of msg.snapshot.players) {
              drafts.push({
                playerId: p.id,
                characterId: p.characterId ?? '',
                playerName: composeName(p.name, p.characterName),
                characterName: p.characterName,
                background: p.background,
                isGM: p.isGM,
                image: images[p.id] ?? '',
              })
            }
            if (!msg.snapshot.players.some((p) => p.id === playerId)) {
              drafts.push({
                playerId,
                characterId: characterIdRef.current,
                playerName: composeName(nameRef.current, characterNameRef.current),
                characterName: characterNameRef.current,
                background: backgroundRef.current,
                isGM: false,
                image: ownImageRef.current,
              })
            }
            void saveSessionCharacters(sessionIdRef.current, drafts)
          }
          if (msg.snapshot.history.length || msg.snapshot.chat.length) {
            hasActivityRef.current = true
          }
          setHistory((prev) => mergeById(prev, msg.snapshot.history, MAX_HISTORY))
          setChat((prev) => mergeById(prev, msg.snapshot.chat, MAX_CHAT))
          roomNameRef.current = msg.snapshot.roomName
          setRoomNameState(msg.snapshot.roomName)
          updateActiveRoomName(msg.snapshot.roomName)
          // Record the snapshot in the durable log (put() upserts, so a
          // re-welcome does not duplicate entries).
          const target = logTarget()
          for (const roll of msg.snapshot.history) void appendLogEntry(target, 'roll', roll)
          for (const message of msg.snapshot.chat) void appendLogEntry(target, 'chat', message)
          break
        }
        case 'roomName':
          roomNameRef.current = msg.name
          setRoomNameState(msg.name)
          updateActiveRoomName(msg.name)
          break
        case 'roomCodeChanged': {
          // The GM moved the room to a new code. Follow it over, keeping
          // the feed, by re-joining through the reconnect machinery.
          const newCode = msg.code
          setRoomCode(newCode)
          roomCodeRef.current = newCode
          saveLastRoomCode(newCode)
          // The session id is unchanged — the log follows the room across
          // a code change.
          saveActiveRoom({
            code: newCode,
            role: 'client',
            sessionId: sessionIdRef.current ?? undefined,
            roomName: roomNameRef.current,
          })
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
          putPlayerImage(msg.playerId, sanitizeSyncedImage(msg.image))
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
          finalizeSession(true)
          goOffline()
          break
      }
    },
    [
      addMarker,
      appendChat,
      appendHistory,
      finalizeSession,
      goOffline,
      logTarget,
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
          // The departed player's portrait is intentionally *kept* in
          // `playerImagesRef`. The welcome-snapshot composition below
          // filters to current roster members, so a disconnected
          // player's image never reaches a new client — but the
          // in-memory entry survives so the per-character durable
          // portrait this session has already persisted is never
          // mistakenly deleted by the `characterImages` derivation
          // (which would otherwise observe `image: ''` and stage a
          // disk delete). A future rejoin will overwrite this entry
          // with whatever portrait the player brings back.
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
    [addMarker, broadcastPlayers],
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

  /**
   * Hydrate the in-memory feed from a session's durable log. Used when a
   * room re-opens an earlier (still-open) session — a quick re-host, a
   * client re-joining the same code, or a startup-time resume — so the
   * prior conversation is visible right away instead of only after the
   * welcome snapshot arrives.
   */
  const restoreFeedFromLog = useCallback(async (sid: string) => {
    const entries = await loadRecentLog(sid, 500)
    if (entries.length === 0) return
    // Older roomLog entries (pre-v1.74) carry `characterName` instead
    // of `characterId`; normalize them so the feed can render every
    // entry through the `(playerId, characterId)` lookup uniformly.
    const rolls = entries
      .filter((e) => e.kind === 'roll')
      .map((e) => normalizeSpeakerEntry(e.data as RollResult))
    const chats = entries
      .filter((e) => e.kind === 'chat')
      .map((e) => normalizeSpeakerEntry(e.data as ChatMessage))
    const marks = entries
      .filter((e) => e.kind === 'marker')
      .map((e) => e.data as SystemMarker)
    if (rolls.length || chats.length) hasActivityRef.current = true
    if (rolls.length) setHistory((prev) => mergeById(prev, rolls, MAX_HISTORY))
    if (chats.length) setChat((prev) => mergeById(prev, chats, MAX_CHAT))
    if (marks.length) setMarkers((prev) => mergeById(prev, marks, MAX_MARKERS))
  }, [])

  // --- Public actions -----------------------------------------------------
  const createRoom = useCallback(
    async (preferredCode?: string, name?: string) => {
      setErrorKind(null)
      gracefulCloseRef.current = false
      intentionalLeaveRef.current = false
      hasActivityRef.current = false
      // A code under 4 chars is treated as "no code" — host a random one.
      const wanted = preferredCode ? normalizeRoomCode(preferredCode) : ''
      const mgr = ensureRoom()
      try {
        const code = await mgr.host(wanted.length >= 4 ? wanted : undefined)
        peerPlayersRef.current.clear()
        setRole('host')
        setRoomCode(code)
        // Eagerly set the refs so the marker below is logged under this
        // room and a fresh session id.
        roomCodeRef.current = code
        // Reuse a still-open session for the same code so re-hosting after
        // a drop or a quick "leave then start again" stays in one history
        // entry; a fresh code (or one explicitly closed earlier) mints a
        // new one.
        const reused = await findReusableSession(code, 'host')
        const sid = reused ?? newSessionId()
        sessionIdRef.current = sid
        setSessionId(sid)
        saveLastRoomCode(code)
        const initialName = name?.trim() ?? ''
        saveActiveRoom({ code, role: 'host', sessionId: sid, roomName: initialName })
        roomNameRef.current = initialName
        setRoomNameState(initialName)
        setPlayers([selfPlayer(true)])
        addMarker('created', { roomCode: code })
        if (reused) await restoreFeedFromLog(reused)
      } catch (err) {
        // A requested code already taken by another room is distinct from
        // a generic connection failure.
        setErrorKind(err === 'unavailable-id' ? 'codeTaken' : 'connect')
        goOffline()
      }
    },
    [addMarker, ensureRoom, goOffline, restoreFeedFromLog, selfPlayer],
  )

  const joinRoom = useCallback(
    async (code: string, resumeSessionId?: string) => {
      setErrorKind(null)
      gracefulCloseRef.current = false
      intentionalLeaveRef.current = false
      hasActivityRef.current = false
      const mgr = ensureRoom()
      try {
        await mgr.join(code)
        // Resuming keeps the same session id (one continuous log); rejoining
        // the same code reuses the previous (still-open) session so quick
        // hops do not pile up new entries; a fresh join mints a new one.
        const reused = resumeSessionId
          ? null
          : await findReusableSession(code, 'client')
        const sid = resumeSessionId ?? reused ?? newSessionId()
        setRole('client')
        setRoomCode(code)
        // Eagerly set the refs so the marker below is logged under this room.
        roomCodeRef.current = code
        sessionIdRef.current = sid
        setSessionId(sid)
        saveLastRoomCode(code)
        // The room name is unknown until the welcome snapshot arrives.
        saveActiveRoom({ code, role: 'client', sessionId: sid, roomName: '' })
        addMarker('joined', { roomCode: code })
        mgr.sendToHost({ t: 'hello', player: selfPlayer(false) })
        // The portrait travels apart from `hello` (the roster stays light).
        if (ownImageRef.current) mgr.sendToHost({ t: 'image', image: ownImageRef.current })
        // For a re-join, surface the prior log right away — the welcome
        // snapshot will merge in on top once it lands.
        if (reused) await restoreFeedFromLog(reused)
      } catch {
        // onError already surfaced the failure.
        goOffline()
      }
    },
    [addMarker, ensureRoom, goOffline, restoreFeedFromLog, selfPlayer],
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
      finalizeSession(true)
      setTimeout(() => goOffline(), 300)
    } else if (currentRole === 'client') {
      addMarker('youLeft', { roomCode: roomCodeRef.current ?? undefined })
      finalizeSession(false)
      goOffline()
    }
  }, [addMarker, finalizeSession, goOffline, markReconnecting])

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
        // The session id is unchanged — the log follows the room across
        // a code change.
        saveActiveRoom({
          code,
          role: 'host',
          sessionId: sessionIdRef.current ?? undefined,
          roomName: roomNameRef.current,
        })
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
      // Resuming keeps the stored session id so the log stays continuous;
      // a pointer from before the session-id change carries none, so mint
      // a fresh one (its pre-reload entries simply will not be restored).
      const sid = resuming ? (pointer?.sessionId ?? newSessionId()) : null
      if (resuming && sid) {
        sessionIdRef.current = sid
        setSessionId(sid)
        // Restore the room name a GM would otherwise lose on reload (a
        // client also gets it back from the welcome snapshot shortly).
        if (pointer?.roomName) {
          roomNameRef.current = pointer.roomName
          setRoomNameState(pointer.roomName)
        }
        await restoreFeedFromLog(sid)
      }
      setRoomCode(code)
      roomCodeRef.current = code
      if (resuming && pointer?.role === 'host') {
        // Re-host the same code; attemptReconnect retries while the broker
        // still holds the pre-reload peer id.
        markReconnecting(true)
        attemptReconnectRef.current('host', code, 1)
      } else {
        void joinRoom(code, sid ?? undefined)
      }
    },
    [joinRoom, markReconnecting, restoreFeedFromLog],
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
      // Import is a fresh session; the loop below flips activity back on
      // if the imported archive actually carried any rolls or chat.
      hasActivityRef.current = false
      const code = normalizeRoomCode(data.roomCode)
      if (code.length < 4) return
      const mgr = ensureRoom()
      try {
        const hosted = await mgr.host(code)
        peerPlayersRef.current.clear()
        // An imported room is a fresh session, distinct from any earlier
        // run under the same code.
        const sid = newSessionId()
        // Persist the imported history and the per-(player, character)
        // records in parallel — both are tagged with the new session id
        // so the room-history view can render past entries (names,
        // backgrounds, GM mark, portraits) without the live session.
        await Promise.all([
          appendLogEntries(
            { sessionId: sid, roomCode: hosted, roomName: data.roomName, role: 'host' },
            data.entries,
          ),
          data.characters.length > 0
            ? saveSessionCharacters(sid, data.characters)
            : Promise.resolve(true),
        ])
        const rolls = data.entries.filter((e) => e.kind === 'roll').map((e) => e.data as RollResult)
        const chats = data.entries.filter((e) => e.kind === 'chat').map((e) => e.data as ChatMessage)
        const marks = data.entries
          .filter((e) => e.kind === 'marker')
          .map((e) => e.data as SystemMarker)
        if (rolls.length || chats.length) hasActivityRef.current = true
        setHistory(capEnd(rolls, MAX_HISTORY))
        setChat(capEnd(chats, MAX_CHAT))
        setMarkers(capEnd(marks, MAX_MARKERS))
        setRole('host')
        setRoomCode(hosted)
        roomCodeRef.current = hosted
        sessionIdRef.current = sid
        setSessionId(sid)
        saveLastRoomCode(hosted)
        saveActiveRoom({ code: hosted, role: 'host', sessionId: sid, roomName: data.roomName })
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
        characterId: characterIdRef.current,
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
        // Queue every message and show it as pending until the host
        // echoes it back (handleHostMessage 'chat' clears it from the
        // outbox). If the GM is unreachable — whether or not the drop has
        // been detected yet — the message simply stays queued and the
        // reconnect flush re-sends it, so a send during an as-yet-
        // undetected outage is never silently lost.
        setOutbox((prev) => capEnd([...prev, message], MAX_OUTBOX))
        if (!reconnectingRef.current) {
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
    // "Clear" also discards this session's durable log, so older entries
    // are not later resurfaced by an on-demand history load.
    void deleteSession(sessionIdRef.current)
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
          characterId: characterIdRef.current,
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
      if (patch.characterId !== undefined) {
        characterIdRef.current = patch.characterId
        setCharacterIdState(patch.characterId)
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
      // Persist it so a GM reload restores the name without a peer to
      // receive it back from.
      updateActiveRoomName(name)
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

  // When the session id first arrives (create / join / resume), persist
  // the local player's current (character) snapshot so a fresh session
  // always carries one entry — the characterImages derivation block's
  // per-update save misses the case where the (character, portrait)
  // was set before any room existed.
  useEffect(() => {
    if (!sessionId) return
    void saveSessionCharacter(sessionId, {
      playerId,
      characterId: characterIdRef.current,
      playerName: composeName(nameRef.current, characterNameRef.current),
      characterName: characterNameRef.current,
      background: backgroundRef.current,
      isGM: roleRef.current === 'host',
      image: ownImageRef.current,
    })
  }, [sessionId, playerId])

  // Flush the unprocessed tail of `portraitQueue` to IndexedDB. The
  // derivation block above only appends deltas — actually touching
  // IndexedDB happens here so React can safely re-run the derivation
  // under StrictMode / concurrent rendering without duplicating writes.
  // `portraitFlushedCountRef` marks the boundary between "already
  // written" and "new" entries, so multiple commits between effect
  // runs cannot drop or double-up any save. Each delta also carries
  // its own `sessionId` snapshot, so a fast `leaveRoom` / `goOffline`
  // that clears `sessionIdRef` between staging and flushing still
  // writes to the right session.
  //
  // Two optimisations live here:
  //   1. Coalesce by `(sessionId, playerId, characterId)`: only the
  //      last observation in the tail is written — the desired
  //      last-write-wins semantics anyway.
  //   2. Group by `sessionId` and use the bulk
  //      `saveSessionCharacters` API so the whole batch lands in a
  //      single IndexedDB transaction per session.
  //
  // The queue itself is left intact (we only advance the offset ref)
  // — in practice it grows by one or two entries per observation,
  // so trimming it would not pay back the bookkeeping cost.
  useEffect(() => {
    const start = portraitFlushedCountRef.current
    if (start >= portraitQueue.length) return
    const endIndex = portraitQueue.length
    const tail = portraitQueue.slice(start)

    // Coalesce + group: each session gets the latest draft for each
    // (playerId, characterId) key.
    const bySession = new Map<string, Map<string, SessionCharacterDraft>>()
    for (const w of tail) {
      let drafts = bySession.get(w.sessionId)
      if (!drafts) {
        drafts = new Map()
        bySession.set(w.sessionId, drafts)
      }
      drafts.set(characterImagesKey(w.playerId, w.characterId), {
        playerId: w.playerId,
        characterId: w.characterId,
        playerName: w.playerName,
        characterName: w.characterName,
        background: w.background,
        isGM: w.isGM,
        image: w.image,
      })
    }

    // Chain this batch off the previous flush so the IndexedDB writes
    // happen in commit order. A naive concurrent fire would let the
    // older batch's transaction commit *after* the newer one, replacing
    // the latest record with stale data (IndexedDB is last-write-wins
    // per transaction). `saveSessionCharacters` returns `false` when
    // the store is unavailable / blocked / aborted, in which case the
    // deltas stay in the queue and the next render's effect run retries
    // from the same offset.
    portraitFlushChainRef.current = portraitFlushChainRef.current.then(async () => {
      // A previous run on the same chain may have already covered this
      // range (multiple effect runs queue up before any of them
      // executes). Re-check the offset before redoing the work.
      if (portraitFlushedCountRef.current >= endIndex) return
      const results = await Promise.all(
        Array.from(bySession, ([sid, drafts]) =>
          saveSessionCharacters(sid, [...drafts.values()]),
        ),
      )
      if (!results.every((ok) => ok)) return
      portraitFlushedCountRef.current = endIndex
      // Compact the queue once a healthy chunk has been flushed, so a
      // long session does not pile up records in memory just because
      // the offset advanced past them. `setState` here runs in the
      // promise's microtask (not synchronously inside the effect
      // body), and the functional updater drops the same prefix from
      // whatever `prev` happens to be — so any new tail appended
      // while the flush was in flight is preserved.
      if (endIndex >= PORTRAIT_QUEUE_COMPACT_AT) {
        portraitFlushedCountRef.current = 0
        setPortraitQueue((prev) => prev.slice(endIndex))
      }
    })
  }, [portraitQueue])


  // Tear down the peer when the app unmounts.
  useEffect(() => () => roomRef.current?.close(), [])

  // Offline: the player list is just the current player.
  const players: Player[] =
    role === 'offline'
      ? [{ id: playerId, name, isGM: false, characterId, characterName, background, lang }]
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
    sessionId,
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
    sessionCharacters,
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
