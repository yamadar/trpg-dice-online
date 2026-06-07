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
import {
  cellFromWorld,
  EMPTY_TABLETOP_STATE,
  newMapId,
  newNpcDefId,
  newSavedTabletopId,
  newSceneId,
  newTokenId,
  TOKEN_SIZES,
  type FogState,
  type Grid,
  type MapBackground,
  type MapText,
  type NpcDef,
  type PresetMap,
  type SavedTabletop,
  type TabletopLibraryKind,
  type TabletopState,
  type Token,
  type TokenSize,
  tokenSize,
} from '../tabletop/types'
import {
  applyDrawStrokeRemove,
  applyDrawStrokeUpsert,
  applyMapTextRemove,
  applyMapTextUpsert,
  canEditMapText,
  canEraseStroke,
  isCellRevealed,
  makeDrawStroke,
  makeMapText,
  nearestRevealedCellCenter,
} from '../tabletop/annotations'
import {
  validateDrawStrokeAddRequest,
  validateDrawStrokeRemoveRequest,
  validateMapTextAddRequest,
  validateMapTextRemoveRequest,
  validateMapTextUpdateRequest,
} from '../tabletop/hostValidation'
import { loadPresetMap } from '../tabletop/presetMaps'
import { isValidPingPoint, newPingId, type Ping } from '../tabletop/ping'
import { nextNpcDef } from '../tabletop/npc'
import { isValidFacing, normalizeFacing } from '../tabletop/facing'
import { clampHp, isValidHp, sanitizeStatuses } from '../tabletop/vitals'
import {
  addScene as addSceneToState,
  appendScenes as appendScenesToState,
  currentSceneOnly,
  ensureScenes,
  deleteScene as deleteSceneInState,
  renameScene as renameSceneInState,
  sceneCount,
  stripTemplateScenes,
  switchScene as switchSceneInState,
} from '../tabletop/scenes'
import { fillTabletopDefaults, stripMapBytesForWire, tokenForWire } from '../tabletop/snapshot'
import { loadTabletop, saveTabletop } from '../storage/tabletop'
import {
  deleteLibraryEntry as deleteLibraryEntryStorage,
  listLibrary,
  saveLibraryEntry,
} from '../storage/tabletopLibrary'
import { snapPlacementToGrid, snapResizeToGrid, snapToGrid, snapToGridForSize } from '../tabletop/grid'
import {
  applyTokenMove as applyTokenMoveHelper,
  applyTokenRemove,
  applyTokenUpsert,
  canMoveToken,
  defaultPlacementOrigin,
  makeGmToken,
  placementPosition,
  planPcTokenAdds,
  recenterTokensOnMap,
  snapAllTokensToGrid,
} from '../tabletop/tokens'
import { prepareNpcTokenImage } from '../characters/image'
import { ChunkBuffer, chunkString } from '../tabletop/imageChunk'
import {
  readMapBackground,
  readMapBackgroundFromUrl,
  type MapImageError,
} from '../tabletop/imageBackground'
import type { MapMeta } from '../net/protocol'

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
  /** Current tabletop state (background metadata, grid, tokens). */
  tabletop: TabletopState
  /** GM-only: update the grid configuration. Persists, broadcasts to clients. */
  updateGrid: (grid: Grid) => void
  /**
   * Move a token during a drag. Updates the local state immediately
   * (optimistic) and broadcasts at ~20 Hz to keep the wire calm. The
   * host validates ownership before applying.
   */
  moveTokenLive: (tokenId: string, x: number, y: number) => void
  /**
   * Commit a token move at drag end. Snaps to the grid (when enabled),
   * persists, and broadcasts the final position bypassing the live
   * throttle so the last frame is never dropped.
   */
  moveTokenCommit: (tokenId: string, x: number, y: number) => void
  /**
   * GM-only: pick an image File as the background map. The file is
   * downscaled to fit `MAX_MAP_EDGE`, persisted locally, then sent to
   * clients in chunks (`mapMeta` + `mapChunk`). Resolves to `'ok'` on
   * success or an error tag when the file is too large / unreadable.
   */
  setMapBackground: (file: File) => Promise<'ok' | MapImageError>
  /**
   * GM-only: load a background map from a remote URL. Goes through the
   * same downscale + chunked-broadcast pipeline as `setMapBackground`.
   * Returns a structured error tag — `'invalidUrl' | 'fetchFailed' |
   * 'notImage' | 'tooLarge' | 'unreadable'` — so the toolbar can flash
   * a precise message rather than a single "didn't work".
   */
  setMapBackgroundFromUrl: (input: string) => Promise<'ok' | MapImageError>
  /** GM-only: clear the current background map. Broadcasts `mapCleared`. */
  clearMapBackground: () => void
  /**
   * GM-only: add a standalone token (NPC / monster / prop). The image
   * goes through the same downscale pipeline as a character portrait
   * (≤ 2560 px / ~2 MB). Resolves to `'ok'` on success or
   * `'unreadable'` when the image cannot be processed.
   */
  addGmToken: (file: File, label?: string) => Promise<'ok' | 'unreadable'>
  /**
   * Remove a token from the map. Hosts remove directly; clients route
   * through the host (`tokenRemoveRequest`) and the host validates
   * ownership before applying. Map-only — the NPC library entry (if
   * any) survives.
   */
  removeToken: (tokenId: string) => void
  /**
   * GM-only: place a PC token for one of the participants. Auto-add
   * runs only when a player has a character; this is the manual path
   * for the no-character case and for adding more tokens to the same
   * participant.
   */
  addPlayerToken: (target: { id: string; characterId: string }) => void
  /**
   * Place a token for one of THE LOCAL PLAYER's own characters. Hosts
   * add directly; clients ask the host via `pcTokenPlaceRequest`.
   * Multiple placements for the same character are allowed (each one
   * mints a fresh token id).
   */
  placeMyCharacterToken: (
    characterId: string,
    characterName?: string,
    image?: string,
  ) => void
  /**
   * GM-only: edit a GM token's label / image. PC tokens are not
   * editable through this API — their label and portrait flow from
   * the character record.
   */
  updateGmToken: (
    tokenId: string,
    updates: { label?: string; image?: string; note?: string },
  ) => void
  /** Host-only: update the GM-private note on any token. The note is
   *  stored in local state only and never broadcast to clients. */
  updateTokenPrivateNote: (tokenId: string, privateNote: string) => void
  /** Any participant: update the public shared note on any token.
   *  The host applies directly; a client sends `tokenNoteRequest` and
   *  waits for the host echo via `tokenUpsert`. */
  updateTokenNote: (tokenId: string, note: string) => void
  /** GM-only: change a token's grid size. Re-snaps the token's
   *  position to the appropriate cell anchor for the new size so
   *  even-integer sizes align on cell corners, odd / 0.6 sizes stay
   *  on centres. */
  setTokenSize: (tokenId: string, size: TokenSize) => void
  /** Set or clear (`null`) a token's facing direction (degrees clockwise
   *  from north). Permission follows `canMoveToken` (own PC or GM): the
   *  host applies directly; a client sends `tokenFacingRequest` and the
   *  host echoes the result via `tokenUpsert`. */
  setTokenFacing: (tokenId: string, facing: number | null) => void
  /** Set or clear (`null`) a token's HP pool. Permission follows
   *  `canMoveToken` (own PC or GM); the host clamps the values. Hosts
   *  apply directly; clients send `tokenHpRequest`. */
  setTokenHp: (
    tokenId: string,
    hp: { current: number; max: number } | null,
  ) => void
  /** Replace a token's status-condition list (catalog keys). Permission
   *  follows `canMoveToken`; the host sanitises the list. Hosts apply
   *  directly; clients send `tokenStatusRequest`. */
  setTokenStatuses: (tokenId: string, statuses: string[]) => void
  /**
   * GM-only: add an NPC to the library (host-side stash that can be
   * placed on the map repeatedly). The image is optional at add-time
   * — the GM enters a name first and can attach (or change) the
   * portrait later via `updateNpcDef`. When supplied, the image
   * runs through the 300-px / ~200 KB pipeline so the broadcast
   * `npcDefUpsert` stays inline. Returns `'ok'` or `'unreadable'`
   * (the latter only when the image was supplied and failed to
   * decode; a name-only add cannot fail on image grounds).
   */
  addNpcDef: (
    name: string,
    input?: File | string,
  ) => Promise<string | 'unreadable'>
  /** GM-only: edit an NPC library entry's name / image / note. */
  updateNpcDef: (
    defId: string,
    updates: { name?: string; image?: string; note?: string },
  ) => void
  /**
   * GM-only: remove an NPC from the library. Placed instances on the
   * map are left as-is — they carry their image inline.
   */
  removeNpcDef: (defId: string) => void
  /** GM-only: move an NPC library entry / placed token up (-1) or down
   *  (+1) within its list. */
  reorderNpcDef: (defId: string, dir: -1 | 1) => void
  reorderToken: (tokenId: string, dir: -1 | 1) => void
  /** Host-only: re-sync the host's own placed PC tokens' snapshots from
   *  the live character list so other players can render the host's
   *  non-active characters. */
  syncOwnTokenSnapshots: (
    chars: ReadonlyArray<{ id: string; name: string; image?: string }>,
  ) => void
  /**
   * GM-only: drop a fresh GmToken on the map sourced from the named
   * library entry. The image / label are copied so a later library
   * edit does not retroactively change the placed instance.
   */
  placeNpcFromLibrary: (defId: string) => void
  /** All named tabletop templates + saves visible to this GM. Empty
   *  when IndexedDB is unavailable or nothing has been saved. */
  tabletopLibrary: ReadonlyArray<SavedTabletop>
  /**
   * GM-only: save the current tabletop with the given name and kind.
   *
   * - `template`: stores the layout (map + grid + NPC library + NPC
   *   placements) along with the supplied viewport centre as the PC
   *   spawn point; PC tokens are stripped so loading later does not
   *   resurrect old players' placements.
   * - `save`: stores the full state including all token positions.
   */
  saveTabletopAs: (
    name: string,
    kind: TabletopLibraryKind,
    viewportCenter?: { x: number; y: number },
    /** `'scene'` saves only the current scene; `'table'` (default) saves
     *  every scene. */
    scope?: 'scene' | 'table',
  ) => Promise<'ok' | 'invalid'>
  /**
   * GM-only: replace the WHOLE table (all scenes) with a saved one.
   * Template loads transplant the GM's existing PCs to the new
   * `pcSpawn`. Save loads restore exactly what was saved.
   */
  loadTabletopFromLibrary: (id: string) => Promise<'ok' | 'missing'>
  /** GM-only: splice a saved entry's scene(s) into the current session
   *  as new scenes (keeps existing scenes; switches to the first added). */
  addLibraryAsScenes: (id: string) => Promise<'ok' | 'missing'>
  /** GM-only: overwrite an existing library entry in place with the
   *  current table (keeps its id / name / kind; rebuilds its state with
   *  the same kind-specific transform `saveTabletopAs` uses). */
  overwriteTabletopInLibrary: (
    id: string,
    viewportCenter?: { x: number; y: number },
    scope?: 'scene' | 'table',
  ) => Promise<'ok' | 'missing' | 'invalid'>
  /** GM-only: drop an entry from the library. */
  deleteTabletopFromLibrary: (id: string) => Promise<void>
  /**
   * Add a free-text label on the map. Any participant may add one;
   * `ownerPlayerId` is stamped onto the label so the owner (and the
   * GM) can later remove it. Clients route through the host which
   * mints the canonical id.
   */
  addMapText: (
    text: string,
    x: number,
    y: number,
    options?: { color?: string; fontSize?: number },
  ) => void
  /**
   * Update an existing map text label. Permission follows
   * `canEditMapText` (owner or host). A no-op for other people's
   * labels.
   */
  updateMapText: (
    id: string,
    updates: { text?: string; x?: number; y?: number; color?: string; fontSize?: number },
  ) => void
  /** Remove a map text label (owner or host). */
  removeMapText: (id: string) => void
  /**
   * Add a pen stroke (commit on drag end). `ownerPlayerId` is the
   * local player; clients send through the host which validates and
   * broadcasts as the canonical record.
   */
  addDrawStroke: (
    points: number[],
    options?: { color?: string; width?: number },
  ) => void
  /** Erase one pen stroke (owner or host). */
  removeDrawStroke: (id: string) => void
  /** GM-only: turn the fog of war layer on or off. */
  setFogEnabled: (enabled: boolean) => void
  /**
   * GM-only: reveal or conceal a batch of fog cells (grid coordinates).
   * Two modes:
   *
   *  - default (no options): one-shot. Applies locally, broadcasts the
   *    full fog state and persists to IndexedDB. Used by the toolbar's
   *    "cover all" / "reveal all" buttons.
   *  - `{ live: true }`: in-drag path. Applies locally, broadcasts at
   *    a 150 ms throttle so clients see the painting progress, and
   *    *skips* the IndexedDB save. The follow-up `commitFog()` flushes
   *    the final state at drag-end so the wire and the durable record
   *    converge on the same value.
   */
  paintFog: (
    cells: ReadonlyArray<{ col: number; row: number }>,
    reveal: boolean,
    options?: { live?: boolean },
  ) => void
  /** GM-only: flush a live fog drag (force broadcast + IndexedDB save
   *  of the current fog state). Called from the canvas on mouseup /
   *  touchend so the wire and disk converge on the final value. */
  commitFog: () => void
  /** GM-only: replace the entire fog state (used by reveal-all /
   *  cover-all). */
  setFog: (fog: FogState) => void
  /**
   * GM-only: pick a bundled preset map from `public/maps/` and load it
   * as the background. Resolves to the same tag set as `setMapBackground`
   * so the toolbar can surface one error message.
   */
  setMapFromPreset: (preset: PresetMap) => Promise<'ok' | MapImageError>
  /** GM-only: add a new blank scene (its own map/grid/tokens/annotations)
   *  and switch to it. Optional name; '' shows a localized placeholder. */
  addScene: (name?: string) => void
  /** GM-only: switch the active scene to the given id. */
  switchScene: (id: string) => void
  /** GM-only: rename a scene (current or inactive). */
  renameScene: (id: string, name: string) => void
  /** GM-only: delete a scene; refuses to remove the only one. */
  deleteScene: (id: string) => void
  /**
   * The most recent transient "look here" ping, or null before any has
   * fired. Set whenever the local player drops one or one arrives over
   * the wire; the tabletop renderer watches it (render-phase derived
   * state, like chat bubbles) and animates each unique `id` for a couple
   * of seconds. Ephemeral — never persisted or snapshotted.
   */
  lastPing: Ping | null
  /**
   * Drop a transient ping at a world-space point. Hosts (and the offline
   * sandbox) render it locally and broadcast it; clients send a
   * `pingRequest` and render it when the host echoes it back.
   */
  sendPing: (x: number, y: number) => void
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
  /**
   * Shared tabletop state (background metadata, grid, tokens). Host
   * authoritative; clients receive grid / token / map updates via the
   * relevant `HostMessage` cases below. Restored from IndexedDB on
   * re-host / resume; seeded from the welcome snapshot on join.
   */
  const [tabletop, setTabletop] = useState<TabletopState>(EMPTY_TABLETOP_STATE)
  /** Latest transient ping. Carried as plain state (not in the tabletop
   *  state) because pings are ephemeral — they are never persisted,
   *  snapshotted or exported. The renderer derives an animation from each
   *  fresh `id`. */
  const [lastPing, setLastPing] = useState<Ping | null>(null)
  /**
   * GM-only: the user's named tabletop library (templates + saves).
   * Loaded asynchronously from IndexedDB on mount; the
   * `saveTabletopAs` / `loadTabletopFromLibrary` /
   * `deleteTabletopFromLibrary` mutations refresh it on success.
   */
  const [tabletopLibrary, setTabletopLibrary] = useState<
    ReadonlyArray<SavedTabletop>
  >([])

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
  /** Mirrors `tabletop` state for synchronous reads inside PeerJS
   *  callbacks (welcome-snapshot composition, broadcast on grid change). */
  const tabletopRef = useRef<TabletopState>(EMPTY_TABLETOP_STATE)
  useEffect(() => {
    roleRef.current = role
    historyRef.current = history
    chatRef.current = chat
    roomCodeRef.current = roomCode
    roomNameRef.current = roomName
    outboxRef.current = outbox
    tabletopRef.current = tabletop
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
  // PC `playerId|characterId` pairs whose token was deliberately removed
  // (by the owner or the GM). `ensurePcTokens` skips re-adding these so a
  // removed token does not resurrect on the next join / identity change.
  // Cleared when the pair is explicitly (re)placed.
  const removedPcKeysRef = useRef(new Set<string>())
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

  /**
   * Replace the whole tabletop state and persist it (fire-and-forget).
   * The IndexedDB write goes to `sessionIdRef.current` so a stale
   * resolve cannot land on the next session — `saveTabletop` is itself
   * a no-op when the session id is null.
   */
  const applyTabletop = useCallback((next: TabletopState) => {
    tabletopRef.current = next
    setTabletop(next)
    void saveTabletop(sessionIdRef.current, next)
  }, [])

  /**
   * Drop a transient "look here" ping at a world-space point. Hosts and
   * the offline sandbox render it locally and broadcast it; clients send
   * a `pingRequest` and render it only when the host echoes it back (so
   * the sender does not see it twice). Pings never touch the persisted
   * tabletop state.
   */
  const sendPing = useCallback((x: number, y: number) => {
    if (!isValidPingPoint(x, y)) return
    const role = roleRef.current
    if (role === 'client') {
      roomRef.current?.sendToHost({ t: 'pingRequest', x, y })
      return
    }
    const ping: Ping = { id: newPingId(), x, y, playerId }
    setLastPing(ping)
    roomRef.current?.broadcast({ t: 'ping', ping })
  }, [playerId])

  /**
   * GM-only: change the grid configuration. Updates the local state,
   * persists it and broadcasts a `gridChange` to clients so every
   * participant sees the same grid. A non-host caller can no-op safely
   * — `broadcast` requires an open `roomRef`.
   */
  const updateGrid = useCallback(
    (grid: Grid) => {
      // Defence in depth: a non-host call would broadcast to the host
      // (the client's only connection) where the message would be
      // silently dropped, leaving the local view out of sync with the
      // authoritative state. Reject it here instead.
      if (roleRef.current === 'client') return
      const oldTokens = tabletopRef.current.tokens
      // Re-snap every token whenever the new grid is snap-on. This
      // covers three transitions in one rule:
      //   - snap stays ON, cellSize or origin changed: tokens land on
      //     the new cell centres.
      //   - snap toggles OFF → ON: existing free-placed tokens lock to
      //     the grid.
      //   - snap stays OFF (or grid kind is 'none'): `snapToGrid`
      //     short-circuits to the input value, so this is a no-op.
      let newTokens: Token[] = oldTokens as Token[]
      if (grid.snap && grid.kind !== 'none') {
        let changed = false
        const next = oldTokens.map((token) => {
          const snapped = snapToGrid(token.x, token.y, grid)
          if (snapped.x === token.x && snapped.y === token.y) return token
          changed = true
          return { ...token, x: snapped.x, y: snapped.y }
        })
        if (changed) newTokens = next
      }
      applyTabletop({ ...tabletopRef.current, grid, tokens: newTokens })
      roomRef.current?.broadcast({ t: 'gridChange', grid })
      // Echo individual token moves so clients converge on the same
      // snapped positions without needing a full table-state push.
      if (newTokens !== oldTokens) {
        for (let i = 0; i < newTokens.length; i++) {
          if (newTokens[i] !== oldTokens[i]) {
            roomRef.current?.broadcast({
              t: 'tokenMove',
              tokenId: newTokens[i].id,
              x: newTokens[i].x,
              y: newTokens[i].y,
            })
          }
        }
      }
    },
    [applyTabletop],
  )

  /**
   * Throttle target for the in-drag `tokenMove` broadcast. ~50ms
   * between sends keeps the data channel calm while still feeling
   * fluid (Konva paints at 60 fps but the wire only needs ~20 Hz).
   */
  const lastTokenBroadcastRef = useRef(0)
  /**
   * Chunked-map receive: holds the in-flight `ChunkBuffer` (and the
   * announced map metadata) while `mapChunk` messages stream in. A
   * fresh `mapMeta` blows the previous one away — that is correct
   * even mid-transfer because the new transfer is the authoritative
   * one.
   */
  const pendingMapBufferRef = useRef<ChunkBuffer | null>(null)
  const pendingMapMetaRef = useRef<MapMeta | null>(null)
  /** Local helper: send a tokenMove on the appropriate channel. */
  const sendTokenMove = useCallback(
    (tokenId: string, x: number, y: number) => {
      const role = roleRef.current
      const room = roomRef.current
      if (!room) return
      if (role === 'host') {
        room.broadcast({ t: 'tokenMove', tokenId, x, y })
      } else if (role === 'client') {
        room.sendToHost({ t: 'tokenMove', tokenId, x, y })
      }
    },
    [],
  )

  /**
   * Optimistic mid-drag move. Updates the local state synchronously
   * (so the dragged token follows the cursor smoothly) and broadcasts
   * at ~20 Hz. IDB persistence is skipped on purpose — the commit
   * variant is the only place where the whole tabletop state gets
   * serialised, so a long drag does not hit disk on every frame.
   */
  const moveTokenLive = useCallback(
    (tokenId: string, x: number, y: number) => {
      const tokens = applyTokenMoveHelper(
        tabletopRef.current.tokens,
        tokenId,
        x,
        y,
      )
      if (tokens === tabletopRef.current.tokens) return
      const next: TabletopState = { ...tabletopRef.current, tokens }
      tabletopRef.current = next
      setTabletop(next)
      const now = Date.now()
      if (now - lastTokenBroadcastRef.current < 50) return
      lastTokenBroadcastRef.current = now
      sendTokenMove(tokenId, x, y)
    },
    [sendTokenMove],
  )

  /**
   * Drag-end commit: snap to the grid (when enabled), persist, and
   * always broadcast (bypassing the throttle so the final position is
   * never the one dropped). The snapped coordinate is what every
   * client converges on.
   */
  const moveTokenCommit = useCallback(
    (tokenId: string, x: number, y: number) => {
      const tabletop = tabletopRef.current
      // Look up the token so the snap can respect its size (a 2×2
      // token wants a 4-cell-corner anchor; 0.6 / odd sizes want a
      // cell centre). Fallback to the size-1 snap when the id is
      // unknown so a stale move from a deleted token still rounds.
      const moving = tabletop.tokens.find((t) => t.id === tokenId)
      // Existing snap behaviour runs first; the rescue below only ever
      // triggers when the user is a non-GM client (the GM may
      // deliberately position a token under fog, e.g., a hidden NPC).
      let snapped = moving
        ? snapToGridForSize(x, y, tokenSize(moving), tabletop.grid)
        : snapToGrid(x, y, tabletop.grid)
      if (
        roleRef.current === 'client' &&
        tabletop.fog.enabled &&
        tabletop.grid.kind !== 'none' &&
        tabletop.grid.cellSize > 0
      ) {
        const cell = cellFromWorld(snapped.x, snapped.y, tabletop.grid)
        if (!isCellRevealed(tabletop.fog, cell.col, cell.row)) {
          // The player's drag ended inside a fogged cell. The fog
          // layer absorbs their clicks, so the token would become
          // unreachable. Nudge it to the nearest revealed cell so
          // they can keep playing. The snap setting is still honoured
          // implicitly: the rescued point is a cell centre, which
          // matches what `snapToGrid` would produce when snap is on;
          // with snap off the player retains free placement on every
          // *other* move and only this emergency case is coerced
          // (placing them at the cell centre is the minimal safe
          // landing).
          const rescued = nearestRevealedCellCenter(
            snapped.x,
            snapped.y,
            tabletop.fog,
            tabletop.grid,
          )
          if (rescued) snapped = rescued
          // If `rescued` is null the entire table is fogged and there
          // is nowhere safe to land. Keep the (snapped) position
          // rather than block the move outright — the GM can always
          // reveal cells to recover, and silently dropping the move
          // would leave the token visually frozen mid-drag.
        }
      }
      const tokens = applyTokenMoveHelper(
        tabletop.tokens,
        tokenId,
        snapped.x,
        snapped.y,
      )
      if (tokens === tabletop.tokens) return
      applyTabletop({ ...tabletop, tokens })
      lastTokenBroadcastRef.current = Date.now()
      sendTokenMove(tokenId, snapped.x, snapped.y)
    },
    [applyTabletop, sendTokenMove],
  )

  /**
   * Broadcast a `MapBackground` to every client as a chunked transfer.
   * `mapMeta` declares the size; `mapChunk` messages follow in order.
   * Sender is the only call site; the host's own state already carries
   * the full `dataUrl` (set before this fires) so no echo to self.
   */
  const broadcastMapAsChunks = useCallback((map: MapBackground) => {
    const room = roomRef.current
    if (!room) return
    const { spec, chunks } = chunkString(map.id, map.dataUrl)
    room.broadcast({
      t: 'mapMeta',
      map: {
        id: map.id,
        name: map.name,
        width: map.width,
        height: map.height,
      },
      chunkSpec: spec,
    })
    for (const chunk of chunks) {
      room.broadcast({ t: 'mapChunk', chunk })
    }
  }, [])

  /**
   * Send a `MapBackground` to one specific client — used right after
   * `welcome` so a late joiner pulls the current map without making
   * every existing client re-receive it.
   */
  const sendMapAsChunksTo = useCallback((peerId: string, map: MapBackground) => {
    const room = roomRef.current
    if (!room) return
    const { spec, chunks } = chunkString(map.id, map.dataUrl)
    room.sendTo(peerId, {
      t: 'mapMeta',
      map: {
        id: map.id,
        name: map.name,
        width: map.width,
        height: map.height,
      },
      chunkSpec: spec,
    })
    for (const chunk of chunks) {
      room.sendTo(peerId, { t: 'mapChunk', chunk })
    }
  }, [])

  /**
   * GM-only: pick a file, downscale, save locally, send to clients.
   * Non-image / oversized files surface their error tag back to the
   * caller (Toolbar) so it can flash a notice.
   */
  const setMapBackground = useCallback(
    async (file: File): Promise<'ok' | MapImageError> => {
      if (roleRef.current === 'client') return 'unreadable'
      const result = await readMapBackground(file)
      if (!result.ok) return result.error
      const map: MapBackground = {
        id: newMapId(),
        name: result.name,
        width: result.width,
        height: result.height,
        dataUrl: result.dataUrl,
      }
      // When this is the FIRST map ever set on the tabletop, shift any
      // existing tokens (placed by `ensurePcTokens` at the world's
      // top-left) onto the new map's centre so they land where the
      // user expects them rather than stuck at (cell/2, cell/2).
      const prev = tabletopRef.current
      // First map ever: shift existing tokens onto the new map's
      // centre (and snap if snap is on). Subsequent map replacements
      // keep token positions but re-snap to the grid when snap is on
      // so a new scene's grid alignment isn't visually broken.
      const tokens = prev.map
        ? snapAllTokensToGrid(prev.tokens, prev.grid)
        : recenterTokensOnMap(prev.tokens, map, prev.grid)
      const next: TabletopState = { ...prev, map, tokens }
      applyTabletop(next)
      if (tokens !== prev.tokens) {
        // Token positions changed: peers need to know. Reuse the
        // existing `tabletopState` channel (small JSON, no map bytes)
        // — clients receive the move along with the new map metadata.
        roomRef.current?.broadcast({
          t: 'tabletopState',
          state: stripMapBytesForWire(next),
        })
      }
      broadcastMapAsChunks(map)
      return 'ok'
    },
    [applyTabletop, broadcastMapAsChunks],
  )

  /**
   * GM-only: load a remote image by URL, downscale, save locally, send
   * to clients. The URL goes through `readMapBackgroundFromUrl` which
   * returns a structured error tag for the toolbar to flash — invalid
   * URL, fetch / CORS failure, non-image body, or oversize blob.
   */
  const setMapBackgroundFromUrl = useCallback(
    async (input: string): Promise<'ok' | MapImageError> => {
      if (roleRef.current === 'client') return 'unreadable'
      const result = await readMapBackgroundFromUrl(input)
      if (!result.ok) return result.error
      const map: MapBackground = {
        id: newMapId(),
        name: result.name,
        width: result.width,
        height: result.height,
        dataUrl: result.dataUrl,
      }
      // Same first-map recenter as `setMapBackground` — see the comment
      // there for the rationale.
      const prev = tabletopRef.current
      // First map ever: shift existing tokens onto the new map's
      // centre (and snap if snap is on). Subsequent map replacements
      // keep token positions but re-snap to the grid when snap is on
      // so a new scene's grid alignment isn't visually broken.
      const tokens = prev.map
        ? snapAllTokensToGrid(prev.tokens, prev.grid)
        : recenterTokensOnMap(prev.tokens, map, prev.grid)
      const next: TabletopState = { ...prev, map, tokens }
      applyTabletop(next)
      if (tokens !== prev.tokens) {
        roomRef.current?.broadcast({
          t: 'tabletopState',
          state: stripMapBytesForWire(next),
        })
      }
      broadcastMapAsChunks(map)
      return 'ok'
    },
    [applyTabletop, broadcastMapAsChunks],
  )

  /** GM-only: drop the current background map. */
  const clearMapBackground = useCallback(() => {
    if (roleRef.current === 'client') return
    const next: TabletopState = { ...tabletopRef.current }
    delete next.map
    applyTabletop(next)
    roomRef.current?.broadcast({ t: 'mapCleared' })
  }, [applyTabletop])

  /**
   * GM-only: add a standalone NPC / monster token. The image runs
   * through the character-portrait pipeline (2560 px / ~2 MB cap) so
   * the bytes stay under the per-message ceiling without needing
   * chunking — these tokens travel inside a single `tokenUpsert`.
   */
  const addGmToken = useCallback(
    async (file: File, label?: string): Promise<'ok' | 'unreadable'> => {
      if (roleRef.current === 'client') return 'unreadable'
      const image = await prepareNpcTokenImage(file)
      if (!image) return 'unreadable'
      const token = makeGmToken(
        { image, label },
        tabletopRef.current.tokens,
        tabletopRef.current,
      )
      applyTabletop({
        ...tabletopRef.current,
        tokens: [...tabletopRef.current.tokens, token],
      })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(token) })
      return 'ok'
    },
    [applyTabletop],
  )

  /**
   * Remove a token. Hosts apply + broadcast directly; clients route the
   * request through the host, which validates that the client actually
   * owns the token (their own PC tokens only) before relaying.
   */
  const removeToken = useCallback(
    (tokenId: string) => {
      // A non-host owner can remove a token they can operate (their own
      // PC token): forward to the host, which validates `canMoveToken`
      // and broadcasts the removal. The host removes any token directly.
      if (roleRef.current === 'client') {
        roomRef.current?.sendToHost({ t: 'tokenRemoveRequest', tokenId })
        return
      }
      const removed = tabletopRef.current.tokens.find((t) => t.id === tokenId)
      const tokens = applyTokenRemove(tabletopRef.current.tokens, tokenId)
      if (tokens === tabletopRef.current.tokens) return
      // Tombstone a removed PC token so the auto-placer does not bring it
      // back; GM tokens are never auto-placed, so they need no tombstone.
      if (removed?.kind === 'pc') {
        removedPcKeysRef.current.add(
          `${removed.ownerPlayerId}|${removed.characterId}`,
        )
      }
      applyTabletop({ ...tabletopRef.current, tokens })
      roomRef.current?.broadcast({ t: 'tokenRemove', tokenId })
    },
    [applyTabletop],
  )

  /**
   * GM-only: manually create a PC token for a participant. Used to
   * place a token for a player who joined without a character (the
   * auto-add path is keyed on `characterId`, so a `''` characterId
   * carries no auto-token), or to add an extra token by switching
   * characters and adding again. A no-op when a token already exists
   * for the `(playerId, characterId)` pair.
   */
  const addPlayerToken = useCallback(
    (target: { id: string; characterId: string }) => {
      if (roleRef.current === 'client') return
      // Explicit (re)placement clears any tombstone so a later removal
      // can re-tombstone cleanly.
      removedPcKeysRef.current.delete(`${target.id}|${target.characterId}`)
      const plans = planPcTokenAdds(
        [{ id: target.id, characterId: target.characterId }],
        tabletopRef.current.tokens,
        tabletopRef.current,
      )
      if (plans.length === 0) return
      applyTabletop({
        ...tabletopRef.current,
        tokens: [...tabletopRef.current.tokens, ...plans],
      })
      for (const token of plans) {
        roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(token) })
      }
    },
    [applyTabletop],
  )

  /**
   * Place a PC token for the local player's named character. One token
   * per `(playerId, characterId)` pair is the rule — the call is a
   * no-op when a token already exists. Clients send a request; the
   * host validates the sender's identity and applies the same
   * uniqueness check before broadcasting.
   *
   * `characterName` and `image` are the caller's snapshot of the
   * character at place time — they get stamped onto the token's
   * `snapshot` so the renderer can show a portrait and label even when
   * the character is not currently the player's active one (so it
   * never lands in `sessionCharacters`). When omitted, the token still
   * works but only renders correctly for the active character.
   */
  const placeMyCharacterToken = useCallback(
    (characterId: string, characterName?: string, image?: string) => {
      if (roleRef.current === 'client') {
        // Client-side guard: also bail early if the local view already
        // shows a token for this character. The host re-checks
        // authoritatively, so this is only a UX optimisation that
        // avoids a wasted round-trip.
        const has = tabletopRef.current.tokens.some(
          (t) =>
            t.kind === 'pc' &&
            t.ownerPlayerId === playerId &&
            t.characterId === characterId,
        )
        if (has) return
        roomRef.current?.sendToHost({
          t: 'pcTokenPlaceRequest',
          characterId,
          characterName: characterName ?? '',
          image: image ?? '',
        })
        return
      }
      // Host (or offline) places for themselves. One PC token per
      // `(playerId, characterId)` — bail when one already exists.
      const tabletop = tabletopRef.current
      const has = tabletop.tokens.some(
        (t) =>
          t.kind === 'pc' &&
          t.ownerPlayerId === playerId &&
          t.characterId === characterId,
      )
      if (has) return
      // The placement origin follows the shared rule
      // (`defaultPlacementOrigin`): pcSpawn → map centre → grid first
      // cell. With a background map present this lands tokens near
      // the middle of the scene rather than the world's top-left.
      const cell = tabletop.grid.cellSize
      const index = tabletop.tokens.length
      const origin = defaultPlacementOrigin(tabletop)
      // Grid layout via placementPosition — wraps to a new row every
      // PLACEMENT_COLS tokens so the cluster stays compact.
      const raw = placementPosition(index, origin, cell)
      const pos = snapPlacementToGrid(raw.x, raw.y, tabletop.grid)
      const snapshot =
        characterName || image
          ? { name: characterName ?? '', image: image ?? '' }
          : undefined
      const token: Token = {
        id: newTokenId(),
        kind: 'pc',
        x: pos.x,
        y: pos.y,
        ownerPlayerId: playerId,
        characterId,
        ...(snapshot ? { snapshot } : {}),
      }
      applyTabletop({
        ...tabletop,
        tokens: [...tabletop.tokens, token],
      })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(token) })
    },
    [applyTabletop, playerId],
  )

  /**
   * GM-only: update a GM token's label or image (the editable bits).
   * PC tokens are not editable here — their label / portrait come from
   * the character record and are kept in sync with `sessionCharacters`.
   * A non-GM token id is a silent no-op.
   */
  const updateGmToken = useCallback(
    (
      tokenId: string,
      updates: { label?: string; image?: string; note?: string },
    ) => {
      if (roleRef.current === 'client') return
      const existing = tabletopRef.current.tokens.find((t) => t.id === tokenId)
      if (!existing || existing.kind !== 'gm') return
      const nextLabel =
        updates.label === undefined ? existing.label : updates.label.trim()
      const nextNote =
        updates.note === undefined ? existing.note : updates.note.trim()
      const next: Token = {
        ...existing,
        ...(updates.image !== undefined ? { image: updates.image } : {}),
        ...(nextLabel ? { label: nextLabel } : {}),
        ...(nextNote ? { note: nextNote } : {}),
      }
      // When label / note is explicitly cleared, drop it from the token
      // shape (the renderer / UI key off "field is present").
      if (updates.label !== undefined && !nextLabel && 'label' in next) {
        delete (next as { label?: string }).label
      }
      if (updates.note !== undefined && !nextNote && 'note' in next) {
        delete (next as { note?: string }).note
      }
      const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
      applyTabletop({ ...tabletopRef.current, tokens })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
    },
    [applyTabletop],
  )

  /** Host-only: update the GM-private note on any token. Applies locally
   *  and does NOT broadcast, so clients never see it. */
  const updateTokenPrivateNote = useCallback(
    (tokenId: string, privateNote: string) => {
      if (roleRef.current === 'client') return
      const existing = tabletopRef.current.tokens.find((t) => t.id === tokenId)
      if (!existing) return
      const trimmed = privateNote.trim()
      const next: Token = { ...existing }
      if (trimmed) {
        ;(next as Token & { privateNote?: string }).privateNote = trimmed
      } else {
        delete (next as Token & { privateNote?: string }).privateNote
      }
      applyTabletop({
        ...tabletopRef.current,
        tokens: applyTokenUpsert(tabletopRef.current.tokens, next),
      })
      // No broadcast — privateNote stays on the host only.
    },
    [applyTabletop],
  )

  /** Update the public shared note on any token. The host applies and
   *  broadcasts; a client sends `tokenNoteRequest` and waits for the
   *  host echo. */
  const updateTokenNote = useCallback(
    (tokenId: string, note: string) => {
      if (roleRef.current === 'client') {
        roomRef.current?.sendToHost({ t: 'tokenNoteRequest', tokenId, note })
        return
      }
      const existing = tabletopRef.current.tokens.find((t) => t.id === tokenId)
      if (!existing) return
      const trimmed = note.trim()
      const next: Token = { ...existing }
      if (trimmed) {
        ;(next as Token & { note?: string }).note = trimmed
      } else {
        delete (next as Token & { note?: string }).note
      }
      const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
      applyTabletop({ ...tabletopRef.current, tokens })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
    },
    [applyTabletop],
  )

  /**
   * GM-only: resize a token (PC or GM). Re-snaps the token to the
   * new size's appropriate cell anchor when snap is on so a 2×2
   * token immediately lines up on a 4-cell intersection. A
   * non-existent id is a silent no-op.
   */
  const setTokenSize = useCallback(
    (tokenId: string, size: TokenSize) => {
      // A non-host owner can resize a token they can operate (their own
      // PC token): forward the request to the host, which validates
      // `canMoveToken` and echoes the resized token back via tokenUpsert.
      if (roleRef.current === 'client') {
        roomRef.current?.sendToHost({ t: 'tokenSizeRequest', tokenId, size })
        return
      }
      const existing = tabletopRef.current.tokens.find((t) => t.id === tokenId)
      if (!existing) return
      // Use the non-drifting resize snap so 1→2→1 returns to the
      // original position.
      const snapped = snapResizeToGrid(
        existing.x,
        existing.y,
        tokenSize(existing),
        size,
        tabletopRef.current.grid,
      )
      const next: Token = {
        ...existing,
        size,
        x: snapped.x,
        y: snapped.y,
      }
      const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
      applyTabletop({ ...tabletopRef.current, tokens })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
    },
    [applyTabletop],
  )

  /**
   * Set or clear a token's facing direction. Permission is the same as
   * move / resize (`canMoveToken`): a non-host owner forwards the request
   * to the host and waits for the `tokenUpsert` echo; the host applies
   * directly. `null` (or a non-finite angle) clears the indicator;
   * otherwise the angle is normalised into [0, 360).
   */
  const setTokenFacing = useCallback(
    (tokenId: string, facing: number | null) => {
      if (roleRef.current === 'client') {
        roomRef.current?.sendToHost({ t: 'tokenFacingRequest', tokenId, facing })
        return
      }
      const existing = tabletopRef.current.tokens.find((t) => t.id === tokenId)
      if (!existing) return
      const next: Token = { ...existing }
      if (facing === null || !isValidFacing(facing)) {
        delete (next as Token & { facing?: number }).facing
      } else {
        ;(next as Token & { facing?: number }).facing = normalizeFacing(facing)
      }
      const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
      applyTabletop({ ...tabletopRef.current, tokens })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
    },
    [applyTabletop],
  )

  /**
   * Set or clear a token's HP pool. Permission mirrors move / resize
   * (`canMoveToken`): a client forwards a `tokenHpRequest`; the host
   * clamps the values (integer, current in [0, max]) and echoes the
   * token via `tokenUpsert`. `null` clears the bar.
   */
  const setTokenHp = useCallback(
    (tokenId: string, hp: { current: number; max: number } | null) => {
      if (roleRef.current === 'client') {
        roomRef.current?.sendToHost({ t: 'tokenHpRequest', tokenId, hp })
        return
      }
      const existing = tabletopRef.current.tokens.find((t) => t.id === tokenId)
      if (!existing) return
      const next: Token = { ...existing }
      if (hp === null || !isValidHp(hp)) {
        delete (next as Token & { hp?: unknown }).hp
      } else {
        ;(next as Token & { hp?: { current: number; max: number } }).hp =
          clampHp(hp)
      }
      const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
      applyTabletop({ ...tabletopRef.current, tokens })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
    },
    [applyTabletop],
  )

  /**
   * Replace a token's status-condition list. Permission mirrors move /
   * resize; the host sanitises the list (known catalog keys only,
   * de-duped, capped). An empty result drops the field entirely.
   */
  const setTokenStatuses = useCallback(
    (tokenId: string, statuses: string[]) => {
      if (roleRef.current === 'client') {
        roomRef.current?.sendToHost({ t: 'tokenStatusRequest', tokenId, statuses })
        return
      }
      const existing = tabletopRef.current.tokens.find((t) => t.id === tokenId)
      if (!existing) return
      const clean = sanitizeStatuses(statuses)
      const next: Token = { ...existing }
      if (clean.length === 0) {
        delete (next as Token & { statuses?: string[] }).statuses
      } else {
        ;(next as Token & { statuses?: string[] }).statuses = clean
      }
      const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
      applyTabletop({ ...tabletopRef.current, tokens })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
    },
    [applyTabletop],
  )

  /**
   * GM-only: add an NPC to the library. The image is downscaled via
   * the same pipeline as in-place NPC tokens. The library entry is
   * NOT placed on the map — it sits in `tabletop.npcLibrary` until
   * the GM presses "Place" on it (see `placeNpcFromLibrary`).
   */
  const addNpcDef = useCallback(
    async (
      name: string,
      input?: File | string,
    ): Promise<string | 'unreadable'> => {
      if (roleRef.current === 'client') return 'unreadable'
      // Name may be blank: the add flow creates an empty entry and opens
      // the editor focused on the name field. Image is optional too
      // (attach later via `updateNpcDef`); when supplied, the pipeline
      // still rejects unreadable bytes so a corrupted image cannot
      // smuggle itself onto the wire under the wrong NPC. Returns the
      // new entry's id so the caller can open it for editing.
      const trimmed = name.trim()
      let image = ''
      if (input !== undefined) {
        const prepared = await prepareNpcTokenImage(input)
        if (!prepared) return 'unreadable'
        image = prepared
      }
      const def: NpcDef = { id: newNpcDefId(), name: trimmed, image }
      applyTabletop({
        ...tabletopRef.current,
        npcLibrary: [...tabletopRef.current.npcLibrary, def],
      })
      roomRef.current?.broadcast({ t: 'npcDefUpsert', def })
      return def.id
    },
    [applyTabletop],
  )

  /** GM-only: edit a library entry's name or image (does NOT touch
   *  already-placed instances). */
  const updateNpcDef = useCallback(
    (
      defId: string,
      updates: { name?: string; image?: string; note?: string },
    ) => {
      if (roleRef.current === 'client') return
      const existing = tabletopRef.current.npcLibrary.find((d) => d.id === defId)
      if (!existing) return
      // `nextNpcDef` rejects only an explicit blank-name edit; an image- /
      // note-only update on a still-unnamed provisional entry goes through
      // (otherwise changing the image before typing the name is dropped).
      const next = nextNpcDef(existing, updates)
      if (!next) return
      applyTabletop({
        ...tabletopRef.current,
        npcLibrary: tabletopRef.current.npcLibrary.map((d) =>
          d.id === defId ? next : d,
        ),
      })
      roomRef.current?.broadcast({ t: 'npcDefUpsert', def: next })
    },
    [applyTabletop],
  )

  /** GM-only: drop a library entry. Placed instances remain. */
  const removeNpcDef = useCallback(
    (defId: string) => {
      if (roleRef.current === 'client') return
      const next = tabletopRef.current.npcLibrary.filter((d) => d.id !== defId)
      if (next.length === tabletopRef.current.npcLibrary.length) return
      applyTabletop({ ...tabletopRef.current, npcLibrary: next })
      roomRef.current?.broadcast({ t: 'npcDefRemove', defId })
    },
    [applyTabletop],
  )

  /**
   * GM-only: move a library entry or a placed token up (-1) / down (+1)
   * within its list. Reordering is a list-shape change with no dedicated
   * wire message, so it rebroadcasts the whole tabletop via
   * `tabletopState` (map bytes stripped — they travel on their own
   * channel). No-op at the ends or for a client.
   */
  const reorderById = <T extends { id: string }>(
    list: ReadonlyArray<T>,
    id: string,
    dir: -1 | 1,
  ): T[] | null => {
    const i = list.findIndex((x) => x.id === id)
    if (i < 0) return null
    const j = i + dir
    if (j < 0 || j >= list.length) return null
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  }
  const reorderNpcDef = useCallback(
    (defId: string, dir: -1 | 1) => {
      if (roleRef.current === 'client') return
      const next = reorderById(tabletopRef.current.npcLibrary, defId, dir)
      if (!next) return
      const state: TabletopState = {
        ...tabletopRef.current,
        npcLibrary: next,
      }
      applyTabletop(state)
      roomRef.current?.broadcast({
        t: 'tabletopState',
        state: stripMapBytesForWire(state),
      })
      // `tabletopState` clears the map's bytes on the wire; the client
      // does a full replace, so without re-streaming the bytes a reorder
      // would blank everyone's background map. Mirror the library-load /
      // set-map path and push the chunks back out.
      if (state.map?.dataUrl) broadcastMapAsChunks(state.map)
    },
    [applyTabletop, broadcastMapAsChunks],
  )
  const reorderToken = useCallback(
    (tokenId: string, dir: -1 | 1) => {
      if (roleRef.current === 'client') return
      const next = reorderById(tabletopRef.current.tokens, tokenId, dir)
      if (!next) return
      const state: TabletopState = { ...tabletopRef.current, tokens: next }
      applyTabletop(state)
      roomRef.current?.broadcast({
        t: 'tabletopState',
        state: stripMapBytesForWire(state),
      })
      // See reorderNpcDef: re-stream the stripped map bytes so the
      // client's full-state replace doesn't drop the background.
      if (state.map?.dataUrl) broadcastMapAsChunks(state.map)
    },
    [applyTabletop, broadcastMapAsChunks],
  )

  /**
   * GM-only: apply a scene operation. When it changes the *current*
   * scene (add / switch / delete-current — detected by a changed
   * `sceneId`) it broadcasts the new state and re-streams the current
   * map so clients converge on the new scene. Rename and delete of an
   * *inactive* scene keep the same `sceneId`, so they are host-local
   * (persisted, but nothing changes for clients, who never receive the
   * inactive `scenes` list).
   */
  const applySceneOp = useCallback(
    (next: TabletopState) => {
      const prev = tabletopRef.current
      if (next === prev) return
      const currentChanged = next.sceneId !== prev.sceneId
      applyTabletop(next)
      if (currentChanged) {
        roomRef.current?.broadcast({
          t: 'tabletopState',
          state: stripMapBytesForWire(next),
        })
        if (next.map?.dataUrl) broadcastMapAsChunks(next.map)
      }
    },
    [applyTabletop, broadcastMapAsChunks],
  )
  /** GM-only: add a new blank scene and switch to it. */
  const addScene = useCallback(
    (name?: string) => {
      if (roleRef.current === 'client') return
      const clean = typeof name === 'string' ? name.trim() : ''
      applySceneOp(addSceneToState(tabletopRef.current, newSceneId(), clean))
    },
    [applySceneOp],
  )
  /** GM-only: switch the active scene. */
  const switchScene = useCallback(
    (id: string) => {
      if (roleRef.current === 'client') return
      applySceneOp(switchSceneInState(tabletopRef.current, id))
    },
    [applySceneOp],
  )
  /** GM-only: rename a scene (current or inactive). */
  const renameScene = useCallback(
    (id: string, name: string) => {
      if (roleRef.current === 'client') return
      applySceneOp(renameSceneInState(tabletopRef.current, id, name.trim()))
    },
    [applySceneOp],
  )
  /** GM-only: delete a scene (refuses the last one). */
  const deleteScene = useCallback(
    (id: string) => {
      if (roleRef.current === 'client') return
      applySceneOp(deleteSceneInState(tabletopRef.current, id))
    },
    [applySceneOp],
  )

  /**
   * Host-only: refresh the place-time `snapshot` (name + portrait) of the
   * host's own placed PC tokens from the live character records, and
   * broadcast each change. This is the channel by which OTHER players see
   * the host's NON-active characters: `sessionCharacters` only ever
   * carries each player's *active* character, so a token's snapshot is
   * the only way a late-joining client can resolve a token bound to a
   * character the host is not currently operating. Called whenever the
   * local character list changes (name / portrait edits, new characters).
   */
  const syncOwnTokenSnapshots = useCallback(
    (chars: ReadonlyArray<{ id: string; name: string; image?: string }>) => {
      if (roleRef.current === 'client') return
      const byId = new Map(chars.map((c) => [c.id, c]))
      let changed = false
      const next = tabletopRef.current.tokens.map((tok) => {
        if (tok.kind !== 'pc' || tok.ownerPlayerId !== playerId) return tok
        const c = byId.get(tok.characterId)
        if (!c) return tok
        const name = c.name
        const image = c.image ?? ''
        if (tok.snapshot?.name === name && tok.snapshot?.image === image) {
          return tok
        }
        changed = true
        const updated: Token = { ...tok, snapshot: { name, image } }
        roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(updated) })
        return updated
      })
      if (changed) {
        applyTabletop({ ...tabletopRef.current, tokens: next })
      }
    },
    [applyTabletop, playerId],
  )

  /**
   * GM-only: mint a fresh GmToken on the map from a library entry.
   * The image / label are copied so the placed token is independent
   * of the library — a later library edit / delete leaves the
   * placement alone (and vice versa).
   */
  /**
   * Reload the library from IndexedDB. Used internally after every
   * save / delete so the UI stays in sync without round-tripping the
   * mutation result. A bare-bones effect on mount kicks the first
   * load.
   */
  const refreshTabletopLibrary = useCallback(async () => {
    const entries = await listLibrary()
    setTabletopLibrary(entries)
  }, [])

  // Mount-only async load of the library. The setState only fires
  // from inside the .then callback (which the React 19 lint rule
  // treats as "subscribing to an external source") rather than
  // synchronously in the effect body, so the rule is satisfied.
  // `cancelled` guards against a late resolution after unmount.
  useEffect(() => {
    let cancelled = false
    listLibrary().then((entries) => {
      if (!cancelled) setTabletopLibrary(entries)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * GM-only: save the current tabletop to the global library.
   *
   * Two orthogonal choices:
   *  - `scope`: `'scene'` saves only the current scene (the common
   *    "save this map" intent); `'table'` saves every scene. Before
   *    scenes existed a save always captured the whole state, which
   *    silently embedded every other scene — `scope` makes the unit
   *    explicit.
   *  - `kind`: `'template'` strips PC tokens + pen strokes from EVERY
   *    saved scene (the initial layout; PCs re-place on load) and
   *    stashes the viewport centre as `pcSpawn`; `'save'` keeps
   *    everything verbatim.
   */
  const saveTabletopAs = useCallback(
    async (
      name: string,
      kind: TabletopLibraryKind,
      viewportCenter?: { x: number; y: number },
      scope: 'scene' | 'table' = 'table',
    ): Promise<'ok' | 'invalid'> => {
      if (roleRef.current === 'client') return 'invalid'
      const trimmed = name.trim()
      if (!trimmed) return 'invalid'
      // Narrow to the current scene first when the GM asked for "this
      // scene", then apply the template strip across whatever scenes
      // remain (one for 'scene', all for 'table').
      const scoped =
        scope === 'scene'
          ? currentSceneOnly(tabletopRef.current)
          : tabletopRef.current
      let state: TabletopState =
        kind === 'template' ? stripTemplateScenes(scoped) : { ...scoped }
      if (kind === 'template' && viewportCenter) {
        state = { ...state, pcSpawn: viewportCenter }
      }
      const now = Date.now()
      const entry: SavedTabletop = {
        id: newSavedTabletopId(),
        name: trimmed,
        kind,
        state,
        createdAt: now,
        updatedAt: now,
      }
      await saveLibraryEntry(entry)
      await refreshTabletopLibrary()
      return 'ok'
    },
    [refreshTabletopLibrary],
  )

  /**
   * GM-only: replace the WHOLE table with a saved one — every existing
   * scene is discarded and the entry's scene(s) take over (use
   * `addLibraryAsScenes` to splice an entry in without losing the
   * current scenes). The full state replacement is broadcast to clients
   * via `tabletopState`; the map's `dataUrl` is stripped on the wire and
   * then streamed through the existing chunked-map path so a
   * multi-megabyte background does not block the data channel.
   */
  const loadTabletopFromLibrary = useCallback(
    async (id: string): Promise<'ok' | 'missing'> => {
      if (roleRef.current === 'client') return 'missing'
      const entry = tabletopLibrary.find((e) => e.id === id)
      if (!entry) return 'missing'
      // Normalise via `ensureScenes` so a legacy / pre-scenes saved entry
      // becomes a valid current-scene state on load — the same invariant
      // the other library paths (currentSceneOnly / appendScenes) hold.
      // Template loads transplant existing PCs to the spawn point so
      // their player owns continuity (no "everyone re-place" friction).
      let next: TabletopState = ensureScenes({ ...entry.state })
      if (entry.kind === 'template') {
        const survivors = tabletopRef.current.tokens.filter(
          (t) => t.kind === 'pc',
        )
        const spawn = entry.state.pcSpawn ?? {
          x: entry.state.grid.originX + entry.state.grid.cellSize / 2,
          y: entry.state.grid.originY + entry.state.grid.cellSize / 2,
        }
        // Place each surviving PC token in a staggered ring around the
        // spawn point. Multiple PCs end up clustered but not stacked.
        const cell = entry.state.grid.cellSize
        const relocated = survivors.map((t, i) => ({
          ...t,
          x: spawn.x + i * cell,
          y: spawn.y,
        }))
        next = { ...next, tokens: [...next.tokens, ...relocated] }
      }
      applyTabletop(next)
      // Broadcast to clients. The shared snapshot helper strips the
      // map's `dataUrl` so the JSON message stays small; the chunked
      // send below streams the bytes separately.
      roomRef.current?.broadcast({
        t: 'tabletopState',
        state: stripMapBytesForWire(next),
      })
      if (next.map?.dataUrl) {
        broadcastMapAsChunks(next.map)
      }
      return 'ok'
    },
    [applyTabletop, broadcastMapAsChunks, tabletopLibrary],
  )

  /**
   * GM-only: splice a saved entry's scene(s) into the CURRENT session as
   * new scenes (and switch to the first), keeping the GM's existing
   * scenes — the additive alternative to `loadTabletopFromLibrary`'s
   * whole-table replace. Reuses the scene-switch broadcast path: the
   * fresh current scene goes out as `tabletopState` + a streamed map.
   * Session-global `npcLibrary` / `pcSpawn` are left as they are.
   */
  const addLibraryAsScenes = useCallback(
    async (id: string): Promise<'ok' | 'missing'> => {
      if (roleRef.current === 'client') return 'missing'
      const entry = tabletopLibrary.find((e) => e.id === id)
      if (!entry) return 'missing'
      const count = sceneCount(entry.state)
      const newIds = Array.from({ length: count }, () => newSceneId())
      const next = appendScenesToState(tabletopRef.current, entry.state, newIds)
      applySceneOp(next)
      return 'ok'
    },
    [applySceneOp, tabletopLibrary],
  )

  /**
   * GM-only: overwrite an EXISTING library entry in place with the
   * current table. The entry keeps its id / name / kind / createdAt;
   * only `state` and `updatedAt` change. The state is rebuilt with the
   * same transform `saveTabletopAs` applies for that kind (templates
   * strip PC tokens + strokes and stash the viewport centre as the PC
   * spawn point; saves keep everything), honouring the same scope
   * (this scene vs the whole table) the save UI offers.
   */
  const overwriteTabletopInLibrary = useCallback(
    async (
      id: string,
      viewportCenter?: { x: number; y: number },
      scope: 'scene' | 'table' = 'table',
    ): Promise<'ok' | 'missing' | 'invalid'> => {
      if (roleRef.current === 'client') return 'invalid'
      const existing = tabletopLibrary.find((e) => e.id === id)
      if (!existing) return 'missing'
      const scoped =
        scope === 'scene'
          ? currentSceneOnly(tabletopRef.current)
          : tabletopRef.current
      let state: TabletopState =
        existing.kind === 'template'
          ? stripTemplateScenes(scoped)
          : { ...scoped }
      if (existing.kind === 'template' && viewportCenter) {
        state = { ...state, pcSpawn: viewportCenter }
      }
      const entry: SavedTabletop = {
        ...existing,
        state,
        updatedAt: Date.now(),
      }
      await saveLibraryEntry(entry)
      await refreshTabletopLibrary()
      return 'ok'
    },
    [refreshTabletopLibrary, tabletopLibrary],
  )

  /** GM-only: drop a saved entry from the library. The current
   *  tabletop on the table is untouched (deletes affect the saved
   *  copy only). */
  const deleteTabletopFromLibrary = useCallback(
    async (id: string) => {
      if (roleRef.current === 'client') return
      await deleteLibraryEntryStorage(id)
      await refreshTabletopLibrary()
    },
    [refreshTabletopLibrary],
  )

  const placeNpcFromLibrary = useCallback(
    (defId: string) => {
      if (roleRef.current === 'client') return
      const def = tabletopRef.current.npcLibrary.find((d) => d.id === defId)
      if (!def) return
      const tabletop = tabletopRef.current
      const cell = tabletop.grid.cellSize
      const index = tabletop.tokens.length
      // Shared default-placement rule: pcSpawn → map centre → grid
      // first cell. Grid layout wraps to a new row for compactness.
      const origin = defaultPlacementOrigin(tabletop)
      const raw2 = placementPosition(index, origin, cell)
      const pos = snapPlacementToGrid(raw2.x, raw2.y, tabletop.grid)
      const token: Token = {
        id: newTokenId(),
        kind: 'gm',
        x: pos.x,
        y: pos.y,
        image: def.image,
        label: def.name,
        // Copy the library note onto the placed token. From here the two
        // diverge — editing one does not affect the other.
        ...(def.note?.trim() ? { note: def.note.trim() } : {}),
      }
      applyTabletop({
        ...tabletopRef.current,
        tokens: [...tabletopRef.current.tokens, token],
      })
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(token) })
    },
    [applyTabletop],
  )

  // --- Map annotations (text / pen / fog) --------------------------------

  const addMapText = useCallback(
    (
      text: string,
      x: number,
      y: number,
      options?: { color?: string; fontSize?: number },
    ) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const role = roleRef.current
      const draft = makeMapText({
        text: trimmed,
        x,
        y,
        ownerPlayerId: playerId,
        color: options?.color,
        fontSize: options?.fontSize,
      })
      if (role === 'host' || role === 'offline') {
        applyTabletop({
          ...tabletopRef.current,
          texts: applyMapTextUpsert(tabletopRef.current.texts, draft),
        })
        roomRef.current?.broadcast({ t: 'mapTextUpsert', text: draft })
      } else if (role === 'client') {
        // Optimistic local insert so the typing user sees their label
        // immediately; the host's echo (with the same id) is a no-op
        // upsert. The host re-validates ownerPlayerId from the
        // connection identity before re-broadcasting.
        applyTabletop({
          ...tabletopRef.current,
          texts: applyMapTextUpsert(tabletopRef.current.texts, draft),
        })
        roomRef.current?.sendToHost({ t: 'mapTextAddRequest', text: draft })
      }
    },
    [applyTabletop, playerId],
  )

  const updateMapText = useCallback(
    (
      id: string,
      updates: {
        text?: string
        x?: number
        y?: number
        color?: string
        fontSize?: number
      },
    ) => {
      const existing = tabletopRef.current.texts.find((t) => t.id === id)
      if (!existing) return
      const actor = { playerId, isHost: roleRef.current !== 'client' }
      if (!canEditMapText(existing, actor)) return
      const next: MapText = {
        ...existing,
        ...(updates.text !== undefined ? { text: updates.text.slice(0, 200) } : {}),
        ...(updates.x !== undefined ? { x: updates.x } : {}),
        ...(updates.y !== undefined ? { y: updates.y } : {}),
        ...(updates.color !== undefined ? { color: updates.color } : {}),
        ...(updates.fontSize !== undefined ? { fontSize: updates.fontSize } : {}),
      }
      if (!next.text.trim()) return
      const role = roleRef.current
      if (role === 'host' || role === 'offline') {
        applyTabletop({
          ...tabletopRef.current,
          texts: applyMapTextUpsert(tabletopRef.current.texts, next),
        })
        roomRef.current?.broadcast({ t: 'mapTextUpsert', text: next })
      } else if (role === 'client') {
        applyTabletop({
          ...tabletopRef.current,
          texts: applyMapTextUpsert(tabletopRef.current.texts, next),
        })
        roomRef.current?.sendToHost({
          t: 'mapTextUpdateRequest',
          id,
          ...(updates.text !== undefined ? { text: next.text } : {}),
          ...(updates.x !== undefined ? { x: next.x } : {}),
          ...(updates.y !== undefined ? { y: next.y } : {}),
          ...(updates.color !== undefined ? { color: next.color } : {}),
          ...(updates.fontSize !== undefined ? { fontSize: next.fontSize } : {}),
        })
      }
    },
    [applyTabletop, playerId],
  )

  const removeMapText = useCallback(
    (id: string) => {
      const existing = tabletopRef.current.texts.find((t) => t.id === id)
      if (!existing) return
      const actor = { playerId, isHost: roleRef.current !== 'client' }
      if (!canEditMapText(existing, actor)) return
      const role = roleRef.current
      if (role === 'host' || role === 'offline') {
        applyTabletop({
          ...tabletopRef.current,
          texts: applyMapTextRemove(tabletopRef.current.texts, id),
        })
        roomRef.current?.broadcast({ t: 'mapTextRemove', id })
      } else if (role === 'client') {
        applyTabletop({
          ...tabletopRef.current,
          texts: applyMapTextRemove(tabletopRef.current.texts, id),
        })
        roomRef.current?.sendToHost({ t: 'mapTextRemoveRequest', id })
      }
    },
    [applyTabletop, playerId],
  )

  const addDrawStroke = useCallback(
    (points: number[], options?: { color?: string; width?: number }) => {
      if (points.length < 2) return
      const role = roleRef.current
      const draft = makeDrawStroke({
        points,
        ownerPlayerId: playerId,
        color: options?.color,
        width: options?.width,
      })
      if (role === 'host' || role === 'offline') {
        applyTabletop({
          ...tabletopRef.current,
          strokes: applyDrawStrokeUpsert(tabletopRef.current.strokes, draft),
        })
        roomRef.current?.broadcast({ t: 'drawStrokeAdd', stroke: draft })
      } else if (role === 'client') {
        applyTabletop({
          ...tabletopRef.current,
          strokes: applyDrawStrokeUpsert(tabletopRef.current.strokes, draft),
        })
        roomRef.current?.sendToHost({ t: 'drawStrokeAddRequest', stroke: draft })
      }
    },
    [applyTabletop, playerId],
  )

  const removeDrawStroke = useCallback(
    (id: string) => {
      const existing = tabletopRef.current.strokes.find((s) => s.id === id)
      if (!existing) return
      const actor = { playerId, isHost: roleRef.current !== 'client' }
      if (!canEraseStroke(existing, actor)) return
      const role = roleRef.current
      if (role === 'host' || role === 'offline') {
        applyTabletop({
          ...tabletopRef.current,
          strokes: applyDrawStrokeRemove(tabletopRef.current.strokes, id),
        })
        roomRef.current?.broadcast({ t: 'drawStrokeRemove', id })
      } else if (role === 'client') {
        applyTabletop({
          ...tabletopRef.current,
          strokes: applyDrawStrokeRemove(tabletopRef.current.strokes, id),
        })
        roomRef.current?.sendToHost({ t: 'drawStrokeRemoveRequest', id })
      }
    },
    [applyTabletop, playerId],
  )

  const setFog = useCallback(
    (fog: FogState) => {
      if (roleRef.current === 'client') return
      // De-duplicate the revealed list defensively in case the caller
      // forgot to do it themselves; the renderer relies on uniqueness
      // for the cell-count math.
      const seen = new Set<string>()
      const revealed: string[] = []
      for (const key of fog.revealed) {
        if (seen.has(key)) continue
        seen.add(key)
        revealed.push(key)
      }
      const next: FogState = { enabled: !!fog.enabled, revealed }
      applyTabletop({ ...tabletopRef.current, fog: next })
      roomRef.current?.broadcast({ t: 'fogSet', fog: next })
    },
    [applyTabletop],
  )

  const setFogEnabled = useCallback(
    (enabled: boolean) => {
      const fog = tabletopRef.current.fog
      setFog({ ...fog, enabled })
    },
    [setFog],
  )

  /**
   * Last time we broadcast a `fogSet` from inside a live drag. Drives
   * the throttle that keeps clients updated without flooding the data
   * channel with one message per painted cell.
   */
  const fogBroadcastThrottleRef = useRef(0)

  const paintFog = useCallback(
    (
      cells: ReadonlyArray<{ col: number; row: number }>,
      reveal: boolean,
      options?: { live?: boolean },
    ) => {
      if (cells.length === 0) return
      if (roleRef.current === 'client') return
      const fog = tabletopRef.current.fog
      const set = new Set(fog.revealed)
      if (reveal) {
        for (const c of cells) set.add(`${c.col},${c.row}`)
      } else {
        for (const c of cells) set.delete(`${c.col},${c.row}`)
      }
      const next: FogState = { ...fog, revealed: [...set] }
      if (options?.live) {
        // In-drag fast path: mutate the in-memory state and notify
        // React, but skip IndexedDB (every cell paint would otherwise
        // queue a write) and throttle the broadcast to ~6 Hz. The
        // `commitFog` call at drag-end forces the final state to the
        // wire and the disk.
        const updated: TabletopState = { ...tabletopRef.current, fog: next }
        tabletopRef.current = updated
        setTabletop(updated)
        const now = Date.now()
        if (now - fogBroadcastThrottleRef.current >= 150) {
          fogBroadcastThrottleRef.current = now
          roomRef.current?.broadcast({ t: 'fogSet', fog: next })
        }
      } else {
        setFog(next)
      }
    },
    [setFog],
  )

  const commitFog = useCallback(() => {
    if (roleRef.current === 'client') return
    // Force the next broadcast to fire regardless of the throttle.
    fogBroadcastThrottleRef.current = 0
    setFog(tabletopRef.current.fog)
  }, [setFog])

  const setMapFromPreset = useCallback(
    async (preset: PresetMap): Promise<'ok' | MapImageError> => {
      if (roleRef.current === 'client') return 'unreadable'
      const result = await loadPresetMap(preset)
      if (!result.ok) return result.error
      const map: MapBackground = {
        id: newMapId(),
        name: result.name,
        width: result.width,
        height: result.height,
        dataUrl: result.dataUrl,
      }
      // Same first-map recenter as `setMapBackground` — see comment
      // there for the rationale.
      const prev = tabletopRef.current
      // First map ever: shift existing tokens onto the new map's
      // centre (and snap if snap is on). Subsequent map replacements
      // keep token positions but re-snap to the grid when snap is on
      // so a new scene's grid alignment isn't visually broken.
      const tokens = prev.map
        ? snapAllTokensToGrid(prev.tokens, prev.grid)
        : recenterTokensOnMap(prev.tokens, map, prev.grid)
      const next: TabletopState = { ...prev, map, tokens }
      applyTabletop(next)
      if (tokens !== prev.tokens) {
        roomRef.current?.broadcast({
          t: 'tabletopState',
          state: stripMapBytesForWire(next),
        })
      }
      broadcastMapAsChunks(map)
      return 'ok'
    },
    [applyTabletop, broadcastMapAsChunks],
  )

  /**
   * Load any saved tabletop state for this session id and adopt it.
   * Called from the host's create / resume paths so re-opening a room
   * brings the grid (and, later, tokens and map) back exactly as it
   * was. A no-op when nothing is stored.
   */
  const restoreTabletopFromStorage = useCallback(async (sid: string) => {
    const stored = await loadTabletop(sid)
    if (stored) {
      tabletopRef.current = stored
      setTabletop(stored)
    }
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

  /**
   * Host-only: make sure every player with an active character has a
   * PC token. Pure planning happens in `planPcTokenAdds` (testable);
   * this wrapper applies the deltas locally and broadcasts each new
   * token via `tokenUpsert` so the late-joining client also sees it.
   * No-op for clients — the host owns the canonical list.
   *
   * Called from the `hello` / `identity` handlers and from
   * `updateIdentity` (when the host's own character changes) so the
   * roster and the token list stay in sync at every transition point.
   */
  const ensurePcTokens = useCallback(() => {
    if (roleRef.current === 'client') return
    const roster = buildRoster()
    const plans = planPcTokenAdds(
      roster,
      tabletopRef.current.tokens,
      tabletopRef.current,
    ).filter(
      (t) =>
        !removedPcKeysRef.current.has(`${t.ownerPlayerId}|${t.characterId}`),
    )
    if (plans.length === 0) return
    // Stamp a name snapshot from the roster so a freshly-joined client
    // renders each token's label / initial right away, before the
    // owner's character lands in `sessionCharacters`. The portrait still
    // resolves live; the snapshot image stays '' so it never masks a
    // real portrait that arrives later.
    const nameByKey = new Map(
      roster.map((p) => [`${p.id}|${p.characterId}`, p.characterName]),
    )
    const stamped = plans.map((tok) => {
      const name = nameByKey
        .get(`${tok.ownerPlayerId}|${tok.characterId}`)
        ?.trim()
      return name ? { ...tok, snapshot: { name, image: '' } } : tok
    })
    const next: TabletopState = {
      ...tabletopRef.current,
      tokens: [...tabletopRef.current.tokens, ...stamped],
    }
    applyTabletop(next)
    for (const token of stamped) {
      roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(token) })
    }
  }, [applyTabletop, buildRoster])

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
          // Strip the map's `dataUrl` from the snapshot — even a
          // downscaled background can be several MB, big enough to
          // make the welcome message itself slow. The client sees the
          // metadata in the snapshot (so the UI can flash a "loading
          // map" hint), then `sendMapAsChunksTo` streams the actual
          // bytes right after.
          const tableForSnapshot = stripMapBytesForWire(tabletopRef.current)
          const snapshot: Snapshot = {
            players: roster,
            history: historyRef.current.map(redactRoll),
            chat: chatRef.current,
            roomName: roomNameRef.current,
            images: snapshotImages,
            tabletop: tableForSnapshot,
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
          // A player joining with a character gets a PC token auto-added
          // — the new client receives it via the broadcast tokenUpsert
          // (their welcome above carries the pre-insert state).
          ensurePcTokens()
          // If we have a map, stream it to the new client now that the
          // welcome (with the metadata-only placeholder) has been sent.
          if (tabletopRef.current.map?.dataUrl) {
            sendMapAsChunksTo(peerId, tabletopRef.current.map)
          }
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
            // A character switch may need a fresh PC token (current
            // tokens for previous characters stay until the GM removes
            // them in PR 6 — `planPcTokenAdds` only adds, never re-keys).
            ensurePcTokens()
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
          // The GM mark is host-authoritative: only the host is GM in a
          // room, so a client-claimed `isGM: true` on their own roll is
          // overruled here before the entry lands in the host log or
          // gets re-broadcast.
          const result: RollResult = { ...msg.result, hidden: false, isGM: false }
          appendHistory(result)
          roomRef.current?.broadcast({ t: 'roll', result })
          break
        }
        case 'chat': {
          // Same host-authoritative GM-mark rule as the `roll` case.
          const message: ChatMessage = { ...msg.message, isGM: false }
          appendChat(message)
          roomRef.current?.broadcast({ t: 'chat', message })
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
        case 'tokenMove': {
          // Host-authoritative validation: the move is dropped silently
          // unless the sender owns the token. `canMoveToken` is shared
          // with the UI so the visible drag affordance and the wire
          // check agree on the rule.
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const token = tabletopRef.current.tokens.find(
            (t) => t.id === msg.tokenId,
          )
          if (!token) break
          if (!canMoveToken(token, { playerId: sender.id, isHost: false })) break
          const tokens = applyTokenMoveHelper(
            tabletopRef.current.tokens,
            msg.tokenId,
            msg.x,
            msg.y,
          )
          if (tokens === tabletopRef.current.tokens) break
          applyTabletop({ ...tabletopRef.current, tokens })
          // Echo to every client (including sender) so all viewers
          // converge on the same authoritative position. The sender's
          // optimistic state is overwritten by the same coordinates,
          // so the round-trip is invisible to them.
          roomRef.current?.broadcast({
            t: 'tokenMove',
            tokenId: msg.tokenId,
            x: msg.x,
            y: msg.y,
          })
          break
        }
        case 'tokenSizeRequest': {
          // Same host-authoritative ownership check as tokenMove: a
          // client may resize only a token it can operate.
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const token = tabletopRef.current.tokens.find(
            (t) => t.id === msg.tokenId,
          )
          if (!token) break
          if (!canMoveToken(token, { playerId: sender.id, isHost: false })) break
          // `msg.size` is typed TokenSize but arrives untrusted over the
          // wire; reject anything outside the allowed set so a bad client
          // can't persist an out-of-spec size into authoritative state.
          if (!(TOKEN_SIZES as ReadonlyArray<number>).includes(msg.size)) break
          const snapped = snapResizeToGrid(
            token.x,
            token.y,
            tokenSize(token),
            msg.size,
            tabletopRef.current.grid,
          )
          const next: Token = {
            ...token,
            size: msg.size,
            x: snapped.x,
            y: snapped.y,
          }
          const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
          applyTabletop({ ...tabletopRef.current, tokens })
          roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
          break
        }
        case 'tokenRemoveRequest': {
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const token = tabletopRef.current.tokens.find(
            (t) => t.id === msg.tokenId,
          )
          if (!token) break
          if (!canMoveToken(token, { playerId: sender.id, isHost: false })) break
          const tokens = applyTokenRemove(tabletopRef.current.tokens, msg.tokenId)
          if (tokens === tabletopRef.current.tokens) break
          if (token.kind === 'pc') {
            removedPcKeysRef.current.add(
              `${token.ownerPlayerId}|${token.characterId}`,
            )
          }
          applyTabletop({ ...tabletopRef.current, tokens })
          roomRef.current?.broadcast({ t: 'tokenRemove', tokenId: msg.tokenId })
          break
        }
        case 'tokenFacingRequest': {
          // Same ownership check as move / resize. `null` (or a non-finite
          // angle) clears the indicator; otherwise normalise into [0,360).
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const token = tabletopRef.current.tokens.find(
            (t) => t.id === msg.tokenId,
          )
          if (!token) break
          if (!canMoveToken(token, { playerId: sender.id, isHost: false })) break
          const next: Token = { ...token }
          if (msg.facing === null || !isValidFacing(msg.facing)) {
            delete (next as Token & { facing?: number }).facing
          } else {
            ;(next as Token & { facing?: number }).facing = normalizeFacing(
              msg.facing,
            )
          }
          const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
          applyTabletop({ ...tabletopRef.current, tokens })
          roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
          break
        }
        case 'tokenHpRequest': {
          // Same ownership check as move / resize. The host clamps so a
          // bad client cannot persist out-of-range / non-integer HP.
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const token = tabletopRef.current.tokens.find(
            (t) => t.id === msg.tokenId,
          )
          if (!token) break
          if (!canMoveToken(token, { playerId: sender.id, isHost: false })) break
          const next: Token = { ...token }
          if (msg.hp === null || !isValidHp(msg.hp)) {
            delete (next as Token & { hp?: unknown }).hp
          } else {
            ;(next as Token & { hp?: { current: number; max: number } }).hp =
              clampHp(msg.hp)
          }
          const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
          applyTabletop({ ...tabletopRef.current, tokens })
          roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
          break
        }
        case 'tokenStatusRequest': {
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const token = tabletopRef.current.tokens.find(
            (t) => t.id === msg.tokenId,
          )
          if (!token) break
          if (!canMoveToken(token, { playerId: sender.id, isHost: false })) break
          const clean = sanitizeStatuses(msg.statuses)
          const next: Token = { ...token }
          if (clean.length === 0) {
            delete (next as Token & { statuses?: string[] }).statuses
          } else {
            ;(next as Token & { statuses?: string[] }).statuses = clean
          }
          const tokens = applyTokenUpsert(tabletopRef.current.tokens, next)
          applyTabletop({ ...tabletopRef.current, tokens })
          roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(next) })
          break
        }
        case 'tokenNoteRequest': {
          // Any participant can update the public note on any token — no
          // per-token ownership check. Sender must be a known peer.
          if (!peerPlayersRef.current.has(peerId)) break
          const noteToken = tabletopRef.current.tokens.find(
            (t) => t.id === msg.tokenId,
          )
          if (!noteToken) break
          const trimmedNote = typeof msg.note === 'string' ? msg.note.trim() : ''
          const nextNoteToken: Token = { ...noteToken }
          if (trimmedNote) {
            ;(nextNoteToken as Token & { note?: string }).note = trimmedNote
          } else {
            delete (nextNoteToken as Token & { note?: string }).note
          }
          const noteTokens = applyTokenUpsert(
            tabletopRef.current.tokens,
            nextNoteToken,
          )
          applyTabletop({ ...tabletopRef.current, tokens: noteTokens })
          roomRef.current?.broadcast({
            t: 'tokenUpsert',
            token: tokenForWire(nextNoteToken),
          })
          break
        }
        case 'pcTokenPlaceRequest': {
          // Host fills in `ownerPlayerId` from the connection's
          // identity — the client cannot spoof someone else's id.
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const tabletop = tabletopRef.current
          // Enforce one PC token per `(playerId, characterId)` — the
          // client guards against duplicates locally, but the host
          // re-checks authoritatively so a stale / racy request from
          // a not-yet-updated client cannot bypass the rule.
          const has = tabletop.tokens.some(
            (t) =>
              t.kind === 'pc' &&
              t.ownerPlayerId === sender.id &&
              t.characterId === msg.characterId,
          )
          if (has) break
          // Explicit placement clears any tombstone so the auto-placer
          // manages this pair again after a future removal.
          removedPcKeysRef.current.delete(`${sender.id}|${msg.characterId}`)
          const cell = tabletop.grid.cellSize
          const index = tabletop.tokens.length
          // Shared default-placement rule (see `defaultPlacementOrigin`):
          // pcSpawn → map centre → grid first cell. With a background
          // map present this lands the requested PC near the middle of
          // the scene rather than the top-left.
          const origin = defaultPlacementOrigin(tabletop)
          // The client may send a snapshot of the character (name +
          // image) so the host can stamp it onto the token; pre-fix
          // clients omit it and the token simply has no snapshot.
          const name = typeof msg.characterName === 'string' ? msg.characterName : ''
          const image = typeof msg.image === 'string' ? msg.image : ''
          const snapshot = name || image ? { name, image } : undefined
          const rawPos = placementPosition(index, origin, cell)
          const pos = snapPlacementToGrid(rawPos.x, rawPos.y, tabletop.grid)
          const token: Token = {
            id: newTokenId(),
            kind: 'pc',
            x: pos.x,
            y: pos.y,
            ownerPlayerId: sender.id,
            characterId: msg.characterId,
            ...(snapshot ? { snapshot } : {}),
          }
          applyTabletop({
            ...tabletop,
            tokens: [...tabletop.tokens, token],
          })
          roomRef.current?.broadcast({ t: 'tokenUpsert', token: tokenForWire(token) })
          break
        }
        case 'mapTextAddRequest': {
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const next = validateMapTextAddRequest(msg, { id: sender.id })
          if (!next) break
          applyTabletop({
            ...tabletopRef.current,
            texts: applyMapTextUpsert(tabletopRef.current.texts, next),
          })
          roomRef.current?.broadcast({ t: 'mapTextUpsert', text: next })
          break
        }
        case 'mapTextUpdateRequest': {
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const existing = tabletopRef.current.texts.find((t) => t.id === msg.id)
          const next = validateMapTextUpdateRequest(
            msg,
            { id: sender.id },
            existing,
          )
          if (!next) break
          applyTabletop({
            ...tabletopRef.current,
            texts: applyMapTextUpsert(tabletopRef.current.texts, next),
          })
          roomRef.current?.broadcast({ t: 'mapTextUpsert', text: next })
          break
        }
        case 'mapTextRemoveRequest': {
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const existing = tabletopRef.current.texts.find((t) => t.id === msg.id)
          const id = validateMapTextRemoveRequest(msg, { id: sender.id }, existing)
          if (!id) break
          applyTabletop({
            ...tabletopRef.current,
            texts: applyMapTextRemove(tabletopRef.current.texts, id),
          })
          roomRef.current?.broadcast({ t: 'mapTextRemove', id })
          break
        }
        case 'drawStrokeAddRequest': {
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const next = validateDrawStrokeAddRequest(msg, { id: sender.id })
          if (!next) break
          applyTabletop({
            ...tabletopRef.current,
            strokes: applyDrawStrokeUpsert(tabletopRef.current.strokes, next),
          })
          roomRef.current?.broadcast({ t: 'drawStrokeAdd', stroke: next })
          break
        }
        case 'drawStrokeRemoveRequest': {
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          const existing = tabletopRef.current.strokes.find((s) => s.id === msg.id)
          const id = validateDrawStrokeRemoveRequest(
            msg,
            { id: sender.id },
            existing,
          )
          if (!id) break
          applyTabletop({
            ...tabletopRef.current,
            strokes: applyDrawStrokeRemove(tabletopRef.current.strokes, id),
          })
          roomRef.current?.broadcast({ t: 'drawStrokeRemove', id })
          break
        }
        case 'pingRequest': {
          // Any known participant may ping. Stamp the sender's id from the
          // trusted connection (so a client cannot spoof someone else's
          // colour) and re-broadcast. Coordinates are untrusted — drop a
          // NaN / Infinity before it corrupts a Konva transform.
          const sender = peerPlayersRef.current.get(peerId)
          if (!sender) break
          if (!isValidPingPoint(msg.x, msg.y)) break
          const ping: Ping = {
            id: newPingId(),
            x: msg.x,
            y: msg.y,
            playerId: sender.id,
          }
          setLastPing(ping)
          roomRef.current?.broadcast({ t: 'ping', ping })
          break
        }
      }
    },
    [
      addMarker,
      applyTabletop,
      appendChat,
      appendHistory,
      broadcastPlayers,
      buildRoster,
      ensurePcTokens,
      noteTyping,
      putPlayerImage,
      sendMapAsChunksTo,
    ],
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
          // Adopt the host's tabletop state. Pre-tabletop hosts omit the
          // field; in that case keep whatever (default / locally-restored)
          // state we already have rather than wiping it. Pre-PR-10 hosts
          // may also lack `npcLibrary` — default it so the renderer's
          // `.map` calls never trip.
          if (msg.snapshot.tabletop) {
            applyTabletop(fillTabletopDefaults(msg.snapshot.tabletop))
          }
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
        case 'gridChange':
          applyTabletop({ ...tabletopRef.current, grid: msg.grid })
          break
        case 'tokenMove': {
          const tokens = applyTokenMoveHelper(
            tabletopRef.current.tokens,
            msg.tokenId,
            msg.x,
            msg.y,
          )
          if (tokens !== tabletopRef.current.tokens) {
            applyTabletop({ ...tabletopRef.current, tokens })
          }
          break
        }
        case 'tokenUpsert': {
          const tokens = applyTokenUpsert(
            tabletopRef.current.tokens,
            msg.token,
          )
          applyTabletop({ ...tabletopRef.current, tokens })
          break
        }
        case 'tokenRemove': {
          const tokens = applyTokenRemove(
            tabletopRef.current.tokens,
            msg.tokenId,
          )
          if (tokens !== tabletopRef.current.tokens) {
            applyTabletop({ ...tabletopRef.current, tokens })
          }
          break
        }
        case 'mapMeta': {
          // Adopt the metadata immediately so the UI can show a
          // "loading map" placeholder, and prepare the buffer for the
          // chunks that follow. A new `mapMeta` mid-transfer wipes the
          // previous buffer — the new map is the authoritative one.
          pendingMapBufferRef.current = new ChunkBuffer(msg.chunkSpec)
          pendingMapMetaRef.current = msg.map
          const placeholder: MapBackground = { ...msg.map, dataUrl: '' }
          applyTabletop({ ...tabletopRef.current, map: placeholder })
          break
        }
        case 'mapChunk': {
          const buf = pendingMapBufferRef.current
          if (!buf) break
          const complete = buf.add(msg.chunk)
          if (!complete) break
          const dataUrl = buf.reassemble()
          const meta = pendingMapMetaRef.current
          pendingMapBufferRef.current = null
          pendingMapMetaRef.current = null
          if (!dataUrl || !meta) break
          applyTabletop({
            ...tabletopRef.current,
            map: { ...meta, dataUrl },
          })
          break
        }
        case 'mapCleared': {
          pendingMapBufferRef.current = null
          pendingMapMetaRef.current = null
          const next: TabletopState = { ...tabletopRef.current }
          delete next.map
          applyTabletop(next)
          break
        }
        case 'npcDefUpsert': {
          const existing = tabletopRef.current.npcLibrary
          const idx = existing.findIndex((d) => d.id === msg.def.id)
          const npcLibrary =
            idx < 0
              ? [...existing, msg.def]
              : existing.map((d) => (d.id === msg.def.id ? msg.def : d))
          applyTabletop({ ...tabletopRef.current, npcLibrary })
          break
        }
        case 'npcDefRemove': {
          const npcLibrary = tabletopRef.current.npcLibrary.filter(
            (d) => d.id !== msg.defId,
          )
          if (npcLibrary.length === tabletopRef.current.npcLibrary.length) break
          applyTabletop({ ...tabletopRef.current, npcLibrary })
          break
        }
        case 'tabletopState': {
          // Full state replace (templates / saves load on host). The
          // map's `dataUrl` arrives empty here — the host follows with
          // `mapMeta` + `mapChunk` to fill it back in, same path the
          // welcome snapshot uses.
          pendingMapBufferRef.current = null
          pendingMapMetaRef.current = null
          applyTabletop(fillTabletopDefaults(msg.state))
          break
        }
        case 'mapTextUpsert': {
          applyTabletop({
            ...tabletopRef.current,
            texts: applyMapTextUpsert(tabletopRef.current.texts, msg.text),
          })
          break
        }
        case 'mapTextRemove': {
          const texts = applyMapTextRemove(tabletopRef.current.texts, msg.id)
          if (texts === tabletopRef.current.texts) break
          applyTabletop({ ...tabletopRef.current, texts })
          break
        }
        case 'drawStrokeAdd': {
          applyTabletop({
            ...tabletopRef.current,
            strokes: applyDrawStrokeUpsert(tabletopRef.current.strokes, msg.stroke),
          })
          break
        }
        case 'drawStrokeRemove': {
          const strokes = applyDrawStrokeRemove(tabletopRef.current.strokes, msg.id)
          if (strokes === tabletopRef.current.strokes) break
          applyTabletop({ ...tabletopRef.current, strokes })
          break
        }
        case 'fogSet': {
          applyTabletop({
            ...tabletopRef.current,
            fog: { ...msg.fog, revealed: msg.fog.revealed.slice() },
          })
          break
        }
        case 'ping': {
          // Render an incoming ping if its coordinates are sane. This is
          // also the path the original sender (a client) takes — the host
          // echoes the ping back so every viewer, the sender included,
          // animates exactly one marker.
          if (isValidPingPoint(msg.ping.x, msg.ping.y)) setLastPing(msg.ping)
          break
        }
      }
    },
    [
      addMarker,
      applyTabletop,
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
        // Always try to restore the tabletop — `loadTabletop` returns
        // null for an unseen session, so a fresh `sid` is a no-op and
        // the previous in-memory grid carries over (matching how
        // history / chat survive across rooms).
        await restoreTabletopFromStorage(sid)
        // The host may have brought a character in from the offline
        // sandbox — make sure their own PC token exists before any
        // client joins (so the welcome snapshot already carries it).
        ensurePcTokens()
      } catch (err) {
        // A requested code already taken by another room is distinct from
        // a generic connection failure.
        setErrorKind(err === 'unavailable-id' ? 'codeTaken' : 'connect')
        goOffline()
      }
    },
    [addMarker, ensurePcTokens, ensureRoom, goOffline, restoreFeedFromLog, restoreTabletopFromStorage, selfPlayer],
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
        // Joining a *new* session — not a tab-resume of the same
        // room, not a re-entry into the still-open session for the
        // same code — means the previous in-memory feed belongs to
        // whichever room the player was in before. Clear it so the
        // joined room starts with its own welcome snapshot only.
        // `createRoom` deliberately does *not* clear, so a GM can
        // experiment locally before opening a room and carry that
        // scratch session into the hosted room.
        if (!resumeSessionId && !reused) {
          setHistory([])
          setChat([])
          setMarkers([])
          setOutbox([])
          // Reset the tabletop too — joining a *new* room means the host
          // sends an authoritative snapshot, so any in-memory grid from a
          // previous room should not flash before the welcome arrives.
          tabletopRef.current = EMPTY_TABLETOP_STATE
          setTabletop(EMPTY_TABLETOP_STATE)
        }
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
        // Same treatment for the tabletop: a re-join restores the grid
        // we last persisted, and the host's welcome may then update it.
        // For a fresh join `loadTabletop` finds nothing and the reset
        // above sticks.
        await restoreTabletopFromStorage(sid)
      } catch {
        // onError already surfaced the failure.
        goOffline()
      }
    },
    [addMarker, ensureRoom, goOffline, restoreFeedFromLog, restoreTabletopFromStorage, selfPlayer],
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
        await restoreTabletopFromStorage(sid)
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
    [joinRoom, markReconnecting, restoreFeedFromLog, restoreTabletopFromStorage],
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
        // Restore the tabletop state from the archive when present
        // (v6+ exports carry it). The map's data URL was re-inlined
        // by the importer, so `applyTabletop` can persist it through
        // the usual IndexedDB write — no chunked transfer needed
        // because there are no clients to receive one yet.
        if (data.tabletop) {
          applyTabletop(data.tabletop)
        }
      } catch (err) {
        setErrorKind(err === 'unavailable-id' ? 'codeTaken' : 'connect')
        goOffline()
      }
    },
    [applyTabletop, ensureRoom, goOffline, selfPlayer],
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
      const currentRole = roleRef.current
      const message: ChatMessage = {
        id: newChatId(),
        playerId,
        characterId: characterIdRef.current,
        isGM: currentRole === 'host',
        text: trimmed,
        timestamp: Date.now(),
        lang: langRef.current,
        mentions,
        mentionsAll,
        ...(file ? { file } : {}),
      }
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
      const characterChanged =
        patch.characterId !== undefined &&
        patch.characterId !== characterIdRef.current
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
      // If the host (or the offline sandbox player) just picked up a
      // character, mint the matching PC token so the next time the
      // table is opened it is already there.
      if (characterChanged) ensurePcTokens()
    },
    [ensurePcTokens, resyncIdentity],
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
    tabletop,
    updateGrid,
    moveTokenLive,
    moveTokenCommit,
    setMapBackground,
    setMapBackgroundFromUrl,
    clearMapBackground,
    addGmToken,
    removeToken,
    addPlayerToken,
    placeMyCharacterToken,
    updateGmToken,
    updateTokenNote,
    updateTokenPrivateNote,
    setTokenSize,
    setTokenFacing,
    setTokenHp,
    setTokenStatuses,
    addNpcDef,
    updateNpcDef,
    removeNpcDef,
    reorderNpcDef,
    reorderToken,
    syncOwnTokenSnapshots,
    placeNpcFromLibrary,
    tabletopLibrary,
    saveTabletopAs,
    loadTabletopFromLibrary,
    addLibraryAsScenes,
    overwriteTabletopInLibrary,
    deleteTabletopFromLibrary,
    addMapText,
    updateMapText,
    removeMapText,
    addDrawStroke,
    removeDrawStroke,
    setFogEnabled,
    paintFog,
    commitFog,
    setFog,
    setMapFromPreset,
    addScene,
    switchScene,
    renameScene,
    deleteScene,
    lastPing,
    sendPing,
  }
}
