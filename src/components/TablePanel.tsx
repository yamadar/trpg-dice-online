import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Shape,
  Stage,
  Text,
} from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import useImage from 'use-image'
import { useI18n } from '../i18n/useI18n'
import type { Session } from '../hooks/useSession'
import { playerColor } from '../players/colors'
import { avatarInitial } from '../players/identity'
import { characterImagesKey } from '../storage/roomLog'
import { canEditMapText, canEraseStroke, isCellRevealed } from '../tabletop/annotations'
import { canMoveToken } from '../tabletop/tokens'
import {
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_WIDTH,
  DEFAULT_TEXT_FONT_SIZE,
  TOKEN_SIZES,
  cellFromWorld,
  tokenSize,
  type DrawStroke,
  type FogState,
  type Grid,
  type MapText,
  type TabletopLibraryKind,
  type Token,
  type TokenSize,
} from '../tabletop/types'
import {
  hexCellCenter,
  hexCellPolygon,
  hexHeight,
  iterHexCellsInViewport,
} from '../tabletop/hexGrid'
import type { Character } from '../characters/types'
import { prepareNpcTokenImage } from '../characters/image'
import { ChatIcon, CloseIcon, DiceIcon, TrashIcon } from './icons'
import { Sheet } from './Sheet'
import { SpeechBubble } from './SpeechBubble'
import { TabletopDock } from './TabletopDock'
import { TabletopTutorial } from './TabletopTutorial'
import { TableToolbar } from './TableToolbar'
import { TableTools, type TableTool } from './TableTools'
import { loadPresetMapManifest } from '../tabletop/presetMaps'
import {
  isTabletopTutorialSeen,
  markTabletopTutorialSeen,
} from '../storage/tabletopTutorial'

interface Props {
  session: Session
  onClose: () => void
  /** Local player's characters (from `useCharacters`). Used by the
   *  toolbar to list "place my X" buttons and by the initial-centre
   *  logic to find the user's active character's token. */
  characters: ReadonlyArray<Character>
  /** Local player's active character id ('' when acting directly).
   *  The tabletop's first paint pans the stage to centre on a token
   *  for this character if one exists. */
  activeCharacterId: string
  /**
   * The feed + chat composer to render as a floating overlay when the
   * "chat" toggle is on. Owned by the parent so it shares one
   * `session` / `characters` / `flash` set with the rest of the app —
   * the tabletop is just a viewport for it here.
   */
  chatPanel?: ReactNode
  /**
   * The combined dice roller + saved-pattern list as a floating
   * overlay when the "rolls" toggle is on. Composed by the parent so
   * it can reuse the same draft state as the Dock-launched dice Sheet.
   * The compact pattern list keeps both sections within ~320 px wide
   * without the formula row overflowing.
   */
  rollsPanel?: ReactNode
  /** Open the character sheet on top of the tabletop. Used by the
   *  bottom-of-tabletop dock so the character button works there too;
   *  unlike chat / dice, the character sheet is App-owned (it shares
   *  state with the main app's Dock), so the click routes back up. */
  onOpenCharacter?: () => void
  /** Surface a flash message (forwarded to the toolbar). */
  onNotice?: (text: string, kind: 'success' | 'error') => void
  /** True when there are chat messages newer than what the user has
   *  seen. Drives the red dot on the bottom dock's chat icon. */
  hasUnreadChat?: boolean
  /** Fires when the user explicitly opens the chat overlay from the
   *  dock. App listens to clear the unread marker — opening the chat
   *  is a natural "I'm catching up" signal. */
  onChatOpened?: () => void
}

interface PanState {
  startClientX: number
  startClientY: number
  startStageX: number
  startStageY: number
}

interface PinchState {
  initialDistance: number
  initialScale: number
  initialCenterX: number
  initialCenterY: number
  initialStageX: number
  initialStageY: number
}

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const WHEEL_ZOOM_FACTOR = 1.1

/**
 * The tabletop full-screen mode.
 *
 * Renders a Konva Stage that hosts the grid (and, in later PRs, the
 * background map and tokens). The Stage's `scale` / `position` drive
 * pan / zoom for every layer at once. Pan is deliberately *not* a
 * single-finger drag so PR 4's token drag does not collide with it.
 */

/** How long a speech bubble lingers above its token (ms). */
const BUBBLE_TTL_MS = 6000
/** Distance from the token centre to the bubble centre at the default
 *  grid (cellSize 50, token radius ≈ 23). The real distance scales
 *  with `grid.cellSize` so large grids — where tokens are
 *  proportionally bigger — push the bubble farther out, avoiding any
 *  visible overlap with the token icon itself. */
const BUBBLE_OFFSET_BASE = 70
/** Approximate bubble half-width / half-height in world px at scale = 1.
 *  Used by the avoid-overlap check; matches SpeechBubble's constants. */
const BUBBLE_HALF_W = 80
const BUBBLE_HALF_H = 28

/**
 * Pick an offset direction for a new bubble that does not overlap any
 * other token's circle. Tries the 8 cardinal/diagonal directions
 * (starting from "up" and rotating clockwise) and returns the first
 * direction whose computed bubble bounding box has no token within it.
 * Falls back to the random direction if every direction is blocked.
 *
 * `cellSize` scales the offset so larger grids — which render larger
 * tokens — get a proportionally larger bubble distance.
 */
function pickBubbleOffset(
  speaker: Token,
  allTokens: Token[],
  cellSize: number,
): { x: number; y: number } {
  // Token radius (cellSize/2 - 2, clamped >= 8). Mirrors TokenView.
  const tokenRadius = Math.max(8, cellSize / 2 - 2)
  const offsetDist = Math.max(BUBBLE_OFFSET_BASE, tokenRadius * 2 + 24)
  // Order: up, up-right, right, down-right, down, down-left, left, up-left.
  // "Up" first because that's the conventional chat-bubble placement.
  const directions: Array<{ x: number; y: number }> = [
    { x: 0, y: -1 },
    { x: 0.7, y: -0.7 },
    { x: 1, y: 0 },
    { x: 0.7, y: 0.7 },
    { x: 0, y: 1 },
    { x: -0.7, y: 0.7 },
    { x: -1, y: 0 },
    { x: -0.7, y: -0.7 },
  ]
  // Randomise the start so multiple consecutive speakers don't pile
  // every bubble in the same "up" slot.
  const startAt = Math.floor(Math.random() * directions.length)
  // Inflate the overlap margin by the token's render radius so a
  // bubble that places a token JUST outside its bbox but whose circle
  // would still intrude is rejected.
  const margin = tokenRadius + 8
  for (let i = 0; i < directions.length; i += 1) {
    const dir = directions[(startAt + i) % directions.length]
    const offX = dir.x * offsetDist
    const offY = dir.y * offsetDist
    const cx = speaker.x + offX
    const cy = speaker.y + offY
    const blocked = allTokens.some((tk) => {
      if (tk.id === speaker.id) return false
      return (
        tk.x >= cx - BUBBLE_HALF_W - margin &&
        tk.x <= cx + BUBBLE_HALF_W + margin &&
        tk.y >= cy - BUBBLE_HALF_H - margin &&
        tk.y <= cy + BUBBLE_HALF_H + margin
      )
    })
    if (!blocked) return { x: offX, y: offY }
  }
  // Everything overlapped — return the first (randomised) direction
  // anyway. Better a slight overlap than no bubble at all.
  const fallback = directions[startAt]
  return {
    x: fallback.x * offsetDist,
    y: fallback.y * offsetDist,
  }
}

export function TablePanel({
  session,
  onClose,
  characters,
  activeCharacterId,
  chatPanel,
  rollsPanel,
  onOpenCharacter,
  onNotice,
  hasUnreadChat,
  onChatOpened,
}: Props) {
  const { t } = useI18n()
  const {
    tabletop,
    updateGrid,
    moveTokenLive,
    moveTokenCommit,
    addMapText,
    removeMapText,
    addDrawStroke,
    removeDrawStroke,
    paintFog,
    commitFog,
  } = session
  // Grid editing is GM-only when in a room, but always available when
  // offline so a player can experiment with the table on their own —
  // the saved state is harmless when there is no session id.
  const canEdit = session.role !== 'client'
  /** First-mount onboarding for the tabletop. Two coordinated effects:
   *  1. Auto-open the tutorial overlay (one-shot per device via
   *     localStorage; re-openable via the "?" button at the bottom of
   *     the right toolbar).
   *  2. Auto-load the `test-grid` preset map for editable users (host or
   *     offline sandbox) whose tabletop is genuinely empty, so the user
   *     lands on a non-blank canvas they can immediately interact with
   *     instead of "what do I do now?". */
  const [showTutorial, setShowTutorial] = useState(
    () => !isTabletopTutorialSeen(),
  )
  // Auto-load test-grid preset on the FIRST EVER open of the tabletop
  // per device (paired with the auto-tutorial, gated on the same
  // `isTabletopTutorialSeen` flag). Captured at mount so that the user
  // dismissing the tutorial — which flips the flag — does not affect
  // this run. Per user spec: "the initial state should be the test-grid
  // preset". Gated on `canEdit` because only host / offline can
  // broadcast a map; the empty-check ensures we never overwrite anyone's
  // existing content. After the first dismissal a host who clears the
  // map and re-opens the tabletop will NOT see test-grid jammed back in.
  const firstEverOpenRef = useRef(!isTabletopTutorialSeen())
  const autoPresetDoneRef = useRef(false)
  useEffect(() => {
    if (autoPresetDoneRef.current) return
    if (!canEdit) return
    if (!firstEverOpenRef.current) return
    autoPresetDoneRef.current = true
    const isEmpty =
      !tabletop.map &&
      tabletop.tokens.length === 0 &&
      tabletop.strokes.length === 0 &&
      tabletop.texts.length === 0
    if (!isEmpty) return
    let cancelled = false
    loadPresetMapManifest().then((list) => {
      if (cancelled) return
      const testGrid = list.find((p) => p.id === 'test-grid')
      if (!testGrid) return
      void session.setMapFromPreset(testGrid)
    })
    return () => {
      cancelled = true
    }
    // Only the first mount matters; deliberately empty deps so a later
    // change to `tabletop` does not retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /** Which of the bottom-left overlays is visible. Chat and dice are
   *  mutually exclusive — they share the same anchor — so a single
   *  state cleanly represents the rule (boolean pair would allow the
   *  invalid both-on state and forced ad-hoc `active=` derivation).
   *  `null` = canvas in the foreground. */
  const [overlay, setOverlay] = useState<'chat' | 'dice' | null>(null)
  /** True while the viewport is narrow enough to be considered a
   *  phone (matches the same 720px breakpoint our CSS uses). The
   *  mobile dice UI is a full-screen `<Sheet>`; desktop is a
   *  floating overlay above the canvas. */
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 720px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const toggleOverlay = (next: 'chat' | 'dice') => {
    setOverlay((prev) => {
      const result = prev === next ? null : next
      // Opening chat is a natural "user is now reading" signal —
      // tell App to clear the unread dot. (No-op when the chat is
      // already open, or when the toggle is closing it.)
      if (result === 'chat') onChatOpened?.()
      return result
    })
  }
  // When the local player commits a roll while the dice overlay is
  // open, swap to chat so the result is visible. Watching
  // `session.history` lets us react without entangling the App-owned
  // roll dispatch with TablePanel-owned state. Implemented as
  // render-phase "derived state" (the React-recommended escape hatch
  // — see https://react.dev/reference/react/useState#storing-
  // information-from-previous-renders) rather than an effect because
  // React 19's `set-state-in-effect` lint disallows the effect form.
  //
  // The initial value is the last roll already in history at mount so
  // re-opening the tabletop later does NOT see a stale roll as "new"
  // and immediately swap to chat. With this baseline the swap fires
  // on every genuinely new roll, including the very first one after
  // mounting with empty history.
  const [lastSeenRollId, setLastSeenRollId] = useState<string | null>(() =>
    session.history.length > 0
      ? session.history[session.history.length - 1].id
      : null,
  )
  const lastRoll =
    session.history.length > 0
      ? session.history[session.history.length - 1]
      : null
  if (lastRoll && lastSeenRollId !== lastRoll.id) {
    setLastSeenRollId(lastRoll.id)
    if (overlay === 'dice' && lastRoll.playerId === session.playerId) {
      setOverlay('chat')
    }
  }
  // --- Speech bubbles ---
  // Floating bubbles anchored above PC tokens for a few seconds when
  // their owner posts a chat message. Detection is the same render-
  // phase derived-state pattern the roll auto-swap above uses: track
  // the latest seen chat id and react to a fresh one without an
  // effect, which React 19's `set-state-in-effect` lint would reject.
  const [bubbles, setBubbles] = useState<
    Array<{
      key: string
      tokenId: string
      text: string
      offsetX: number
      offsetY: number
      createdAt: number
    }>
  >([])
  const [lastSeenChatBubbleId, setLastSeenChatBubbleId] = useState<
    string | null
  >(() =>
    session.chat.length > 0 ? session.chat[session.chat.length - 1].id : null,
  )
  const lastChat =
    session.chat.length > 0 ? session.chat[session.chat.length - 1] : null
  if (lastChat && lastChat.id !== lastSeenChatBubbleId) {
    setLastSeenChatBubbleId(lastChat.id)
    // Only bubble character speech anchored to a placed PC token —
    // GM-as-self / player-as-self messages (characterId='') and chat
    // from players without a token on the table are silent.
    if (lastChat.characterId !== '' && lastChat.text.trim().length > 0) {
      const token = tabletop.tokens.find(
        (tk) =>
          tk.kind === 'pc' &&
          tk.ownerPlayerId === lastChat.playerId &&
          tk.characterId === lastChat.characterId,
      )
      if (token) {
        const offset = pickBubbleOffset(
          token,
          tabletop.tokens,
          tabletop.grid.cellSize,
        )
        setBubbles((prev) => [
          ...prev,
          {
            key: lastChat.id,
            tokenId: token.id,
            text: lastChat.text,
            offsetX: offset.x,
            offsetY: offset.y,
            createdAt: Date.now(),
          },
        ])
      }
    }
  }
  // Schedule per-bubble removal. The effect re-runs whenever the
  // bubble set changes so brand-new bubbles each get their own timer;
  // already-scheduled ones are cleaned up + re-scheduled with their
  // remaining time, which is idempotent in practice.
  useEffect(() => {
    if (bubbles.length === 0) return
    const timers = bubbles.map((b) => {
      const remaining = b.createdAt + BUBBLE_TTL_MS - Date.now()
      return window.setTimeout(() => {
        setBubbles((prev) => prev.filter((p) => p.key !== b.key))
      }, Math.max(0, remaining))
    })
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [bubbles])
  // Mirrors the wire-level permission: a non-host can drag their own
  // PC tokens; a host (or offline sandbox) can drag anything. Wrapped
  // here so the `draggable` prop on each `TokenView` reads it
  // synchronously.
  const tokenActor = useMemo(
    () => ({ playerId: session.playerId, isHost: canEdit }),
    [session.playerId, canEdit],
  )

  /**
   * The token whose edit popover is currently open. Cleared by:
   *   - clicking an empty area of the stage,
   *   - tapping the same token again (toggle off),
   *   - pressing the popover's close button,
   *   - the underlying token being removed (the popover render bails
   *     out when it cannot find the token in the list).
   */
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  // Close the popover when the user presses ANYWHERE outside the
  // popover itself and outside the Konva-rendered map area (left
  // tool palette, right toolbar, bottom dock, tutorial overlay,
  // etc.). Konva area presses are excluded so Konva's own click
  // handlers (empty stage => clear, token tap => re-select) drive
  // selection — using the `.konvajs-content` wrapper that Konva
  // emits around its canvas elements is precise because the left
  // / right toolbars and overlays are siblings inside the SAME
  // `.tabletop-canvas` div, so an over-broad `.tabletop-canvas`
  // match would prevent toolbar clicks from closing the popover.
  useEffect(() => {
    if (!selectedTokenId) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      if (target.closest('.tabletop-token-popover')) return
      if (target.closest('.konvajs-content')) return
      setSelectedTokenId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [selectedTokenId])
  /** A one-shot "look here!" pulse anchored to a token's position.
   *  Driven from the placed-tokens list focus action (so the user can
   *  see WHICH token the list row referred to without us also popping
   *  the edit popover). `key` increments per trigger so re-clicking the
   *  same row replays the animation. `phase` runs 0→1 over the
   *  animation's lifetime. */
  const [pulse, setPulse] = useState<{
    tokenId: string
    key: number
    phase: number
  } | null>(null)
  useEffect(() => {
    if (!pulse) return
    // Skip if this effect run is for a finished animation — we only
    // start a new RAF loop when `key` ticks.
    if (pulse.phase >= 1) return
    let raf = 0
    const start = performance.now()
    const DURATION_MS = 720
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      setPulse((cur) =>
        cur && cur.key === pulse.key ? { ...cur, phase: t } : cur,
      )
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // Only the `key` change should restart the animation — `phase`
    // updates from inside the loop must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse?.key])
  const selectedToken = useMemo(
    () =>
      selectedTokenId === null
        ? null
        : tabletop.tokens.find((t) => t.id === selectedTokenId) ?? null,
    [selectedTokenId, tabletop.tokens],
  )

  /** Whether the first-paint centring step has already fired this
   *  mount. State (not a ref) so the React 19 lint rule that forbids
   *  ref writes during render is honoured; once flipped, the
   *  condition guarding the camera write goes false and no further
   *  re-pan happens. */
  const [initialCenterDone, setInitialCenterDone] = useState(false)
  /** Map id the camera was last re-centered on. Tracked separately
   *  from `initialCenterDone` so a *new* map (fresh upload, swap, or
   *  template load) re-centers the view even after the user has
   *  panned around — the world origin (top-left of the loaded image)
   *  used to anchor the scene, which pushed every new placement off
   *  to the corner. */
  const [centeredMapId, setCenteredMapId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [stageX, setStageX] = useState(0)
  const [stageY, setStageY] = useState(0)
  const [stageScale, setStageScale] = useState(1)
  const spaceDownRef = useRef(false)
  const panStateRef = useRef<PanState | null>(null)
  const pinchStateRef = useRef<PinchState | null>(null)

  // --- Tool state -------------------------------------------------------
  /**
   * The active "tool" for left-mouse / single-touch input on the
   * stage. `select` keeps the existing token-drag behaviour; other
   * tools take over the gesture (see TableTools comment for the menu).
   * The default is `select` so a freshly-opened tabletop feels the
   * same as before this PR.
   */
  const [tool, setTool] = useState<TableTool>('select')
  /** Sticky pen / text color (hex). Re-used across mode switches. */
  const [toolColor, setToolColor] = useState(DEFAULT_PEN_COLOR)
  /** Sticky pen stroke width (world px). */
  const [penWidth, setPenWidth] = useState(DEFAULT_PEN_WIDTH)
  /** Sticky text font size (world px). */
  const [textSize, setTextSize] = useState(DEFAULT_TEXT_FONT_SIZE)

  /** In-progress pen stroke. `null` between strokes. */
  const [drawingPoints, setDrawingPoints] = useState<number[] | null>(null)
  // Refs for in-flight drawing / fog painting; the gesture lives across
  // multiple events so we cannot rely on closure state alone.
  const drawingRef = useRef<number[] | null>(null)
  const fogPaintingRef = useRef<'reveal' | 'conceal' | null>(null)
  /** Pending text input: world coords where the user clicked. The
   *  actual draft *value* lives in `TextDraftInput`'s local state so a
   *  keystroke does not re-render the whole tabletop (and every Konva
   *  layer along with it). */
  const [textDraft, setTextDraft] = useState<{ x: number; y: number } | null>(
    null,
  )

  // Track the container's pixel size so the Stage matches the
  // available viewport. ResizeObserver covers window resizes plus the
  // mobile address bar collapsing / expanding.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width: Math.floor(width), height: Math.floor(height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Space-bar pan is a desktop affordance — track the key state so the
  // mousedown handler can decide whether to start a pan or pass the
  // event through. `repeat` events are ignored so holding Space does
  // not retrigger.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) spaceDownRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Escape closes the panel — matches the Sheet convention.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Auto-revert the active tool to 'select' during render whenever
  // the fog brush's pre-conditions disappear — a non-GM viewer or
  // fog turned off means the brush cannot paint, so leaving it
  // selected gives the user a "stuck" palette button until they
  // manually pick another tool. Using the "adjust state during
  // render" pattern (rather than an effect) because the React 19
  // `set-state-in-effect` lint rule disallows the effect form, and
  // this is the documented escape hatch for derived state.
  const fogToolInvalid =
    (tool === 'fog-reveal' || tool === 'fog-conceal') &&
    (!canEdit || !tabletop.fog.enabled)
  if (fogToolInvalid) {
    setTool('select')
  }

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const direction = e.evt.deltaY > 0 ? -1 : 1
      const oldScale = stageScale
      const next =
        direction > 0
          ? oldScale * WHEEL_ZOOM_FACTOR
          : oldScale / WHEEL_ZOOM_FACTOR
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next))
      // Zoom centred on the cursor: solve for the new stage offset such
      // that the world point under the pointer stays put.
      const worldX = (pointer.x - stageX) / oldScale
      const worldY = (pointer.y - stageY) / oldScale
      setStageScale(newScale)
      setStageX(pointer.x - worldX * newScale)
      setStageY(pointer.y - worldY * newScale)
    },
    [stageScale, stageX, stageY],
  )

  // ----- Tool gesture helpers ------------------------------------------------
  /**
   * Compute the world-space coordinates of the current pointer. Used by
   * every tool-aware event handler so that pan / zoom is automatically
   * compensated — the result lives in the same coordinate space as
   * tokens, strokes and text labels.
   */
  const worldFromPointer = useCallback((): { x: number; y: number } | null => {
    const stage = stageRef.current
    if (!stage) return null
    const ptr = stage.getPointerPosition()
    if (!ptr) return null
    return {
      x: (ptr.x - stageX) / stageScale,
      y: (ptr.y - stageY) / stageScale,
    }
  }, [stageX, stageY, stageScale])

  // Cells painted during the current fog-paint drag. Used to skip
  // duplicate paints when the cursor stays inside a cell across many
  // mousemove events — keeps the broadcast count proportional to the
  // number of unique cells the gesture actually touches.
  const fogGestureCellsRef = useRef<Set<string>>(new Set())

  const startDrawing = useCallback((w: { x: number; y: number }) => {
    drawingRef.current = [w.x, w.y]
    setDrawingPoints([w.x, w.y])
  }, [])

  const continueDrawing = useCallback((w: { x: number; y: number }) => {
    const pts = drawingRef.current
    if (!pts) return
    const lastX = pts[pts.length - 2]
    const lastY = pts[pts.length - 1]
    // Skip points that have barely moved — keeps the stroke array
    // bounded for fast brushwork. The 1-world-px threshold renders
    // close enough to the cursor at any zoom level.
    if (Math.abs(lastX - w.x) < 1 && Math.abs(lastY - w.y) < 1) return
    pts.push(w.x, w.y)
    // Trigger a re-render with a fresh slice so React notices the
    // change (the ref array itself is mutated in place).
    setDrawingPoints(pts.slice())
  }, [])

  const finishDrawing = useCallback(() => {
    const pts = drawingRef.current
    drawingRef.current = null
    setDrawingPoints(null)
    if (!pts || pts.length < 4) return
    addDrawStroke(pts, { color: toolColor, width: penWidth })
  }, [addDrawStroke, toolColor, penWidth])

  const paintFogAt = useCallback(
    (w: { x: number; y: number }, reveal: boolean) => {
      if (tabletop.grid.kind !== 'square') return
      const cell = cellFromWorld(w.x, w.y, tabletop.grid)
      const key = `${cell.col},${cell.row}`
      if (fogGestureCellsRef.current.has(key)) return
      fogGestureCellsRef.current.add(key)
      // Live path: throttled broadcast + no IDB save. `commitFog` at
      // drag-end flushes the final state to the wire and disk.
      paintFog([cell], reveal, { live: true })
    },
    [paintFog, tabletop.grid],
  )

  /**
   * Non-GM clicks on fogged cells are silently ignored for pen / text
   * tools. The cell is invisible to them, so adding a stroke or label
   * there would result in untraceable hidden content. Eraser is
   * already blocked by the listening fog layer; this check covers the
   * tools that go through the stage's mousedown handler regardless of
   * what was hit (clicks always bubble to the stage).
   */
  const isHiddenByFog = useCallback(
    (w: { x: number; y: number }): boolean => {
      if (canEdit) return false
      const fog = tabletop.fog
      if (!fog.enabled) return false
      if (tabletop.grid.kind !== 'square') return false
      const cell = cellFromWorld(w.x, w.y, tabletop.grid)
      return !isCellRevealed(fog, cell.col, cell.row)
    },
    [canEdit, tabletop.fog, tabletop.grid],
  )

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const ev = e.evt
      // Pan when the user presses the right button, or holds Space.
      // Always wins regardless of the current tool so the user can
      // adjust their viewport in any mode.
      if (ev.button === 2 || (ev.button === 0 && spaceDownRef.current)) {
        ev.preventDefault()
        panStateRef.current = {
          startClientX: ev.clientX,
          startClientY: ev.clientY,
          startStageX: stageX,
          startStageY: stageY,
        }
        return
      }
      if (ev.button !== 0) return
      // Left-click. Tool-specific behaviour for everything except
      // 'select' (which lets Konva handle token-drag natively) and
      // 'eraser' (per-shape onClick handlers do the work).
      if (tool === 'select' || tool === 'eraser') return
      const w = worldFromPointer()
      if (!w) return
      if (tool === 'pen') {
        if (isHiddenByFog(w)) return
        startDrawing(w)
      } else if (tool === 'text') {
        if (isHiddenByFog(w)) return
        setTextDraft({ x: w.x, y: w.y })
      } else if (tool === 'fog-reveal' || tool === 'fog-conceal') {
        if (!canEdit) return
        // Grid must be square for the cell math; if it is not we
        // refuse to start the gesture so mouseup does not emit a
        // pointless commit broadcast. The TableTools palette also
        // disables the buttons in this state — this is defence in
        // depth for keyboard / programmatic activation.
        if (tabletop.grid.kind !== 'square') return
        fogPaintingRef.current = tool === 'fog-reveal' ? 'reveal' : 'conceal'
        fogGestureCellsRef.current = new Set()
        paintFogAt(w, tool === 'fog-reveal')
      }
    },
    [
      stageX,
      stageY,
      tool,
      canEdit,
      tabletop.grid.kind,
      worldFromPointer,
      startDrawing,
      paintFogAt,
      isHiddenByFog,
    ],
  )

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Pan in progress.
      const ps = panStateRef.current
      if (ps) {
        setStageX(ps.startStageX + (e.evt.clientX - ps.startClientX))
        setStageY(ps.startStageY + (e.evt.clientY - ps.startClientY))
        return
      }
      // Drawing or fog-painting in progress.
      if (!drawingRef.current && !fogPaintingRef.current) return
      const w = worldFromPointer()
      if (!w) return
      if (drawingRef.current) continueDrawing(w)
      if (fogPaintingRef.current) paintFogAt(w, fogPaintingRef.current === 'reveal')
    },
    [worldFromPointer, continueDrawing, paintFogAt],
  )

  const handleMouseUp = useCallback(() => {
    panStateRef.current = null
    if (drawingRef.current) finishDrawing()
    if (fogPaintingRef.current) {
      // Flush the throttled fog drag to the wire / disk.
      commitFog()
    }
    fogPaintingRef.current = null
    fogGestureCellsRef.current.clear()
  }, [finishDrawing, commitFog])

  // Two-finger pinch + pan. A single touch is the active tool's
  // gesture: token drag for 'select', stroke / text / fog for the
  // others. The pinch handler aborts any in-flight stroke / fog
  // paint so the gesture cannot bleed into the zoom.
  const handleTouchStart = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches
      if (touches.length === 2) {
        e.evt.preventDefault()
        // A pinch arriving mid-pen-stroke aborts the line — the
        // points haven't been committed yet, so discarding them
        // matches the user's likely "I'm switching to zoom" intent.
        if (drawingRef.current) {
          drawingRef.current = null
          setDrawingPoints(null)
        }
        // Fog paints are different: each cell was already applied
        // locally (and broadcast through the throttled live path)
        // during the drag, so commit the partial work to push the
        // final state to the wire / disk before yielding to the
        // pinch. Otherwise the throttle could have dropped the last
        // few cells and clients would be left out of sync.
        if (fogPaintingRef.current) commitFog()
        fogPaintingRef.current = null
        fogGestureCellsRef.current.clear()
        const t1 = touches[0]
        const t2 = touches[1]
        const dx = t1.clientX - t2.clientX
        const dy = t1.clientY - t2.clientY
        pinchStateRef.current = {
          initialDistance: Math.hypot(dx, dy),
          initialScale: stageScale,
          initialCenterX: (t1.clientX + t2.clientX) / 2,
          initialCenterY: (t1.clientY + t2.clientY) / 2,
          initialStageX: stageX,
          initialStageY: stageY,
        }
        return
      }
      if (touches.length !== 1) return
      if (tool === 'select' || tool === 'eraser') return
      const w = worldFromPointer()
      if (!w) return
      e.evt.preventDefault()
      if (tool === 'pen') {
        if (isHiddenByFog(w)) return
        startDrawing(w)
      } else if (tool === 'text') {
        if (isHiddenByFog(w)) return
        setTextDraft({ x: w.x, y: w.y })
      } else if (tool === 'fog-reveal' || tool === 'fog-conceal') {
        if (!canEdit) return
        if (tabletop.grid.kind !== 'square') return
        fogPaintingRef.current = tool === 'fog-reveal' ? 'reveal' : 'conceal'
        fogGestureCellsRef.current = new Set()
        paintFogAt(w, tool === 'fog-reveal')
      }
    },
    [
      stageScale,
      stageX,
      stageY,
      tool,
      canEdit,
      tabletop.grid.kind,
      worldFromPointer,
      startDrawing,
      paintFogAt,
      isHiddenByFog,
      commitFog,
    ],
  )

  const handleTouchMove = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const ps = pinchStateRef.current
      if (ps) {
        const touches = e.evt.touches
        if (touches.length !== 2) return
        e.evt.preventDefault()
        const t1 = touches[0]
        const t2 = touches[1]
        const dx = t1.clientX - t2.clientX
        const dy = t1.clientY - t2.clientY
        const distance = Math.hypot(dx, dy)
        const cx = (t1.clientX + t2.clientX) / 2
        const cy = (t1.clientY + t2.clientY) / 2
        const ratio = distance / (ps.initialDistance || 1)
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, ps.initialScale * ratio),
        )
        // Pan by the centre delta; the scale change is "centred on the
        // initial midpoint" by virtue of starting from the original
        // stage offset.
        setStageScale(newScale)
        setStageX(ps.initialStageX + (cx - ps.initialCenterX))
        setStageY(ps.initialStageY + (cy - ps.initialCenterY))
        return
      }
      // Tool drag in progress.
      if (!drawingRef.current && !fogPaintingRef.current) return
      e.evt.preventDefault()
      const w = worldFromPointer()
      if (!w) return
      if (drawingRef.current) continueDrawing(w)
      if (fogPaintingRef.current) paintFogAt(w, fogPaintingRef.current === 'reveal')
    },
    [worldFromPointer, continueDrawing, paintFogAt],
  )

  const handleTouchEnd = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      // Drop the pinch state once any finger lifts — the remaining
      // touch (if any) should not keep moving the stage.
      if (e.evt.touches.length < 2) pinchStateRef.current = null
      // The tool drag is also over when the last finger lifts.
      if (e.evt.touches.length === 0) {
        if (drawingRef.current) finishDrawing()
        if (fogPaintingRef.current) commitFog()
        fogPaintingRef.current = null
        fogGestureCellsRef.current.clear()
      }
    },
    [finishDrawing, commitFog],
  )

  // Compute the visible world rectangle so the grid renderer only draws
  // lines that intersect it (vs. drawing an infinite grid which would
  // be wasteful when zoomed in).
  const viewport = useMemo(
    () => ({
      x: -stageX / stageScale,
      y: -stageY / stageScale,
      width: size.width / stageScale,
      height: size.height / stageScale,
    }),
    [stageX, stageY, stageScale, size.width, size.height],
  )

  /**
   * Character ids the local player has already placed on the map. The
   * toolbar uses this to disable per-character "place" buttons so the
   * one-token-per-character rule shows up in the UI instead of the
   * click silently no-op'ing.
   */
  const placedCharacterIds = useMemo(() => {
    const ids = new Set<string>()
    for (const tok of tabletop.tokens) {
      if (tok.kind === 'pc' && tok.ownerPlayerId === session.playerId) {
        ids.add(tok.characterId)
      }
    }
    return ids
  }, [tabletop.tokens, session.playerId])

  /**
   * Pre-enrich every placed token with the portrait + label the
   * renderer already computes. The toolbar's "placed tokens" section
   * uses this so it does not have to duplicate
   * `portraitForToken` / `labelForToken` (which depend on
   * `session.sessionCharacters`).
   */
  const placedTokens = useMemo(
    () =>
      tabletop.tokens.map((token) => ({
        token,
        portrait: portraitForToken(token, session),
        label: labelForToken(token, session),
      })),
    [tabletop.tokens, session],
  )

  /**
   * Find the local player's PC token for their active character so the
   * first paint can centre on it. `null` when none exists (no
   * character set, or no placement yet) — the centring effect
   * short-circuits and the user starts at (0, 0).
   */
  const myActiveToken = useMemo(() => {
    if (!activeCharacterId) return null
    return (
      tabletop.tokens.find(
        (tok) =>
          tok.kind === 'pc' &&
          tok.ownerPlayerId === session.playerId &&
          tok.characterId === activeCharacterId,
      ) ?? null
    )
  }, [tabletop.tokens, activeCharacterId, session.playerId])

  // Pan the camera so the user lands looking at "the right place" —
  // not at the world's top-left, which is what stageX/Y = 0 means.
  // React's "derive state during render" pattern: state guards
  // (`initialCenterDone` / `centeredMapId`) flip synchronously, the
  // next render skips this block, no loop. The user's later panning
  // is never overridden once they have a stable view.
  //
  // Three triggers, in priority order:
  //  (a) Map identity changed (fresh upload, swap, template load).
  //      Always re-center on the new map's middle so it never lands
  //      partially off-screen, and so a subsequent token placement
  //      (which also uses the map centre as its default origin)
  //      appears under the cursor instead of in the corner.
  //  (b) First paint with an existing active token: center on it.
  //  (c) First paint with no token but a map present: center on map.
  // Without any of these the camera stays at (0, 0) (world origin at
  // the screen's top-left), matching the "blank whiteboard" baseline.
  if (size.width > 0 && size.height > 0) {
    const mapId = tabletop.map?.id ?? null
    if (tabletop.map && mapId !== centeredMapId) {
      setCenteredMapId(mapId)
      setInitialCenterDone(true)
      const cx = tabletop.map.width / 2
      const cy = tabletop.map.height / 2
      setStageX(size.width / 2 - cx * stageScale)
      setStageY(size.height / 2 - cy * stageScale)
    } else if (!initialCenterDone && myActiveToken) {
      setInitialCenterDone(true)
      setCenteredMapId(mapId)
      setStageX(size.width / 2 - myActiveToken.x * stageScale)
      setStageY(size.height / 2 - myActiveToken.y * stageScale)
    } else if (!initialCenterDone) {
      // No token and no map: mark the first paint as resolved so
      // future map changes flow through trigger (a). Camera stays
      // where it is.
      setInitialCenterDone(true)
      setCenteredMapId(mapId)
    }
  }

  return (
    <div
      className="tabletop-layer"
      role="dialog"
      aria-modal="true"
      aria-label={t('tabletop.title')}
    >
      {/* The top header (title + view toggles + close) used to live
          here; it has been replaced by the bottom `TabletopDock`,
          which mirrors the main app's bottom-Dock metaphors so the
          user does not have to relearn the layout when the tabletop
          opens. */}
      <div
        ref={containerRef}
        className="tabletop-canvas"
        onContextMenu={(e) => e.preventDefault()}
      >
        {size.width > 0 && size.height > 0 && (
          <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}
            x={stageX}
            y={stageY}
            scaleX={stageScale}
            scaleY={stageScale}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => {
              // A tap that lands on the Stage itself (not a shape)
              // means the user clicked outside any token — close the
              // edit popover. The check is `target === stage`, not a
              // listening flag, so a layer the user has chosen not to
              // make interactive still counts as "background" here.
              if (e.target === e.target.getStage()) setSelectedTokenId(null)
            }}
            onTap={(e) => {
              if (e.target === e.target.getStage()) setSelectedTokenId(null)
            }}
          >
            <Layer listening={false}>
              {tabletop.map?.dataUrl && (
                <MapImage
                  src={tabletop.map.dataUrl}
                  width={tabletop.map.width}
                  height={tabletop.map.height}
                />
              )}
            </Layer>
            <Layer listening={false}>
              <GridLines
                grid={tabletop.grid}
                viewport={viewport}
                scale={stageScale}
              />
            </Layer>
            {/* Pen strokes — above background / grid, below tokens. The
                layer listens for events only in eraser mode so other
                tools can pass clicks through to the stage. */}
            <Layer listening={tool === 'eraser'}>
              {tabletop.strokes.map((stroke) => (
                <StrokeView
                  key={stroke.id}
                  stroke={stroke}
                  scale={stageScale}
                  erasable={
                    tool === 'eraser' &&
                    canEraseStroke(stroke, {
                      playerId: session.playerId,
                      isHost: canEdit,
                    })
                  }
                  onErase={() => removeDrawStroke(stroke.id)}
                />
              ))}
              {drawingPoints && drawingPoints.length >= 4 && (
                // Live preview of the in-progress stroke. Only on the
                // local screen — the committed stroke lands in
                // `tabletop.strokes` on mouseup via `addDrawStroke`.
                <Line
                  points={drawingPoints}
                  stroke={toolColor}
                  strokeWidth={penWidth}
                  tension={0.4}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              )}
            </Layer>
            {/* Tokens. Listen for events only when 'select' (or any
                non-eraser tool that the user might want to drag
                tokens with) is active. In eraser mode the layer is
                listening-free so a click reaches the stroke layer
                directly underneath a token, otherwise a stroke
                hidden under a token would be impossible to erase. */}
            <Layer listening={tool !== 'eraser'}>
              {tabletop.tokens.map((token) => (
                <TokenView
                  key={token.id}
                  token={token}
                  grid={tabletop.grid}
                  scale={stageScale}
                  draggable={
                    tool === 'select' && canMoveToken(token, tokenActor)
                  }
                  portrait={portraitForToken(token, session)}
                  label={labelForToken(token, session)}
                  // For non-GM viewers, fade the tokens they cannot
                  // move so they can tell at a glance which are theirs
                  // to operate. GMs always see full opacity (every
                  // token is theirs to move).
                  dimmed={!canEdit && !canMoveToken(token, tokenActor)}
                  onDragMove={moveTokenLive}
                  onDragEnd={moveTokenCommit}
                  onSelect={
                    tool === 'select' && canEdit
                      ? setSelectedTokenId
                      : undefined
                  }
                />
              ))}
            </Layer>
            {/* Focus pulse — a single short-lived ring that expands
                and fades, anchored to whichever token was just focused
                via the placed-tokens list. Sits above the token layer
                so it overlays the disc, and below labels / fog so the
                ring never gets clipped. `listening={false}` keeps the
                ring out of pointer events. */}
            {pulse &&
              (() => {
                const tk = tabletop.tokens.find(
                  (t) => t.id === pulse.tokenId,
                )
                if (!tk) return null
                return (
                  <Layer listening={false}>
                    <FocusPulse
                      x={tk.x}
                      y={tk.y}
                      grid={tabletop.grid}
                      scale={stageScale}
                      phase={pulse.phase}
                    />
                  </Layer>
                )
              })()}
            {/* Speech bubbles — above tokens so a bubble never hides
                under the token icon it belongs to. listening=false
                so the bubbles never intercept clicks meant for
                tokens / map text below. */}
            {bubbles.length > 0 && (
              <Layer listening={false}>
                {bubbles.map((b) => {
                  const tk = tabletop.tokens.find((t) => t.id === b.tokenId)
                  if (!tk) return null
                  return (
                    <SpeechBubble
                      key={b.key}
                      token={tk}
                      text={b.text}
                      offsetX={b.offsetX}
                      offsetY={b.offsetY}
                      scale={stageScale}
                    />
                  )
                })}
              </Layer>
            )}
            {/* Text labels — above tokens. Listens for clicks in
                eraser mode so the owner / GM can remove their own. */}
            <Layer listening={tool === 'eraser'}>
              {tabletop.texts.map((label) => (
                <MapTextView
                  key={label.id}
                  label={label}
                  scale={stageScale}
                  erasable={
                    tool === 'eraser' &&
                    canEditMapText(label, {
                      playerId: session.playerId,
                      isHost: canEdit,
                    })
                  }
                  onErase={() => removeMapText(label.id)}
                />
              ))}
            </Layer>
            {/* Fog of war — top layer. For the GM (or offline
                sandbox), listening=false so the fog tools can paint
                straight through to the stage's mousedown handler.
                For non-GM, listening=true so the opaque fog also
                blocks hit-testing on the layers beneath — a token
                hidden under fog stays uninteractable, matching the
                "players cannot see fogged areas" requirement. */}
            {tabletop.fog.enabled && (
              <Layer listening={!canEdit}>
                <FogLayer
                  fog={tabletop.fog}
                  grid={tabletop.grid}
                  mapWidth={tabletop.map?.width}
                  mapHeight={tabletop.map?.height}
                  viewport={viewport}
                  isGM={canEdit}
                />
              </Layer>
            )}
          </Stage>
        )}
        {canEdit && selectedToken && (
          <TokenPopover
            // Key on token id so a selection swap remounts the popover
            // and `useState(initialLabel)` reseeds for the new token —
            // avoids a render-phase ref write that the React 19 lint
            // rule forbids.
            key={selectedToken.id}
            token={selectedToken}
            stageX={stageX}
            stageY={stageY}
            stageScale={stageScale}
            onClose={() => setSelectedTokenId(null)}
            onRename={(label) =>
              session.updateGmToken(selectedToken.id, { label })
            }
            onChangeImage={(image) =>
              session.updateGmToken(selectedToken.id, { image })
            }
            onChangeSize={(size) => session.setTokenSize(selectedToken.id, size)}
            onRemove={() => {
              session.removeToken(selectedToken.id)
              setSelectedTokenId(null)
            }}
          />
        )}
        {textDraft && (
          <TextDraftInput
            // Key on position so a fresh click in text mode remounts
            // the input — the local value state resets to '' even
            // when the parent's `textDraft` reference happens to
            // change in place.
            key={`${textDraft.x},${textDraft.y}`}
            stageX={stageX}
            stageY={stageY}
            stageScale={stageScale}
            worldX={textDraft.x}
            worldY={textDraft.y}
            color={toolColor}
            fontSize={textSize}
            onCommit={(value) => {
              const trimmed = value.trim()
              if (trimmed) {
                addMapText(trimmed, textDraft.x, textDraft.y, {
                  color: toolColor,
                  fontSize: textSize,
                })
              }
              setTextDraft(null)
            }}
            onCancel={() => setTextDraft(null)}
          />
        )}
        {/* TableTools / TableToolbar / chat / dice overlays sit
            INSIDE the canvas div so their `position: absolute`
            anchors to the canvas's box rather than the whole
            tabletop layer. That keeps them above the canvas but
            below the bottom-of-layer `TabletopDock` (a sibling
            of canvas in normal flow), which would otherwise be
            covered by an absolute child of the layer. */}
        <TableTools
        tool={tool}
        onToolChange={setTool}
        color={toolColor}
        onColorChange={setToolColor}
        penWidth={penWidth}
        onPenWidthChange={setPenWidth}
        textSize={textSize}
        onTextSizeChange={setTextSize}
        canEditFog={canEdit}
        // Brush is gated on fog enabled (not on grid kind) per UX
        // request: "control by fog ON/OFF". The toolbar's fog section
        // already locks `fog.enabled` to false while the grid is
        // 'none', so this single flag covers both cases in practice.
        fogPaintReady={tabletop.fog.enabled}
      />
      {/* Map ops toolbar is always rendered now (the old top-header
          toggle is gone). Its right-edge icon strip is reachable at
          all times, and only the optional side-expanding panel
          consumes screen space. */}
      <TableToolbar
          grid={tabletop.grid}
          onChange={updateGrid}
          map={tabletop.map}
          onSetMap={session.setMapBackground}
          onSetMapFromUrl={session.setMapBackgroundFromUrl}
          onClearMap={session.clearMapBackground}
          characters={characters}
          // One PC token per character — collect the local player's
          // already-placed characterIds so the toolbar can disable
          // their "place" button instead of letting the click no-op.
          placedCharacterIds={placedCharacterIds}
          onPlaceMyCharacter={session.placeMyCharacterToken}
          npcLibrary={tabletop.npcLibrary}
          onAddNpcDef={session.addNpcDef}
          onUpdateNpcDef={session.updateNpcDef}
          onRemoveNpcDef={session.removeNpcDef}
          onPlaceNpcFromLibrary={session.placeNpcFromLibrary}
          placedTokens={placedTokens}
          onRemoveToken={session.removeToken}
          onFocusToken={(tokenId) => {
            const tok = tabletop.tokens.find((t) => t.id === tokenId)
            if (!tok) return
            // Centre the viewport on the token without changing the
            // current zoom — same formula the render-phase "centre on
            // map" path uses (size/2 - worldCoord * scale).
            setStageX(size.width / 2 - tok.x * stageScale)
            setStageY(size.height / 2 - tok.y * stageScale)
            // Trigger a brief pulse ring at the token's position so the
            // user can spot which token the list row referred to.
            // Intentionally does NOT set `selectedTokenId` — the edit
            // popover stays reserved for direct taps on the token on
            // the canvas; tapping a list row only "draws attention".
            setPulse((prev) => ({
              tokenId,
              key: (prev?.key ?? 0) + 1,
              phase: 0,
            }))
          }}
          isHost={canEdit}
          tabletopLibrary={session.tabletopLibrary}
          onLoadPresetMap={session.setMapFromPreset}
          fog={tabletop.fog}
          onFogEnabledChange={session.setFogEnabled}
          onFogReplace={session.setFog}
          onSaveTabletopAs={(name, kind: TabletopLibraryKind) => {
            // Templates need a PC spawn point — pass the world-space
            // centre of the current viewport so a load drops PCs where
            // the GM is currently looking. Saves do not use it.
            const viewportCenter =
              kind === 'template'
                ? {
                    x: -stageX / stageScale + size.width / 2 / stageScale,
                    y: -stageY / stageScale + size.height / 2 / stageScale,
                  }
                : undefined
            return session.saveTabletopAs(name, kind, viewportCenter)
          }}
          onLoadTabletopFromLibrary={session.loadTabletopFromLibrary}
          onDeleteTabletopFromLibrary={session.deleteTabletopFromLibrary}
          onNotice={onNotice}
          onOpenTutorial={() => setShowTutorial(true)}
        />
      {chatPanel && overlay === 'chat' && (
        // Chat opens as a `<Sheet>` (same chrome the Dock-launched
        // character / dice sheets use) so backdrop click + Escape
        // close behaviour is shared. On mobile it covers the dock
        // ("snap to the very bottom") just like the others.
        <Sheet
          title={t('tabletop.dock.chat')}
          titleIcon={<ChatIcon size={20} />}
          onClose={() => setOverlay(null)}
        >
          {chatPanel}
        </Sheet>
      )}
      {rollsPanel && overlay === 'dice' &&
        // On mobile the dice overlay re-uses the same `<Sheet>`
        // chrome the Dock-launched dice sheet does so the UX is
        // identical between the two entry points (header + close
        // button, full-screen body). On desktop it stays a floating
        // anchored overlay so the canvas is still visible behind it.
        (isMobile ? (
          <Sheet
            title={t('tabletop.dock.dice')}
            titleIcon={<DiceIcon size={20} />}
            onClose={() => setOverlay(null)}
          >
            {rollsPanel}
          </Sheet>
        ) : (
          <aside
            className="tabletop-overlay tabletop-overlay-rolls"
            aria-label={t('tabletop.dock.dice')}
          >
            {rollsPanel}
          </aside>
        ))}
      </div>
      <TabletopDock
        active={overlay}
        unreadChat={hasUnreadChat && overlay !== 'chat'}
        onSelect={(id) => {
          if (id === 'chat' || id === 'dice') toggleOverlay(id)
          else if (id === 'character') onOpenCharacter?.()
          else if (id === 'returnToRoom') onClose()
        }}
      />
      {showTutorial && (
        <TabletopTutorial
          onClose={() => {
            setShowTutorial(false)
            markTabletopTutorialSeen()
          }}
        />
      )}
    </div>
  )
}

interface TokenPopoverProps {
  token: Token
  stageX: number
  stageY: number
  stageScale: number
  onClose: () => void
  /** GM-only: change the GM token's label. PC tokens use the character
   *  record so the popover hides the label field for them. */
  onRename: (label: string) => void
  /** GM-only: replace the GM token's image. */
  onChangeImage: (image: string) => void
  /** GM-only: change the token's grid size. */
  onChangeSize: (size: TokenSize) => void
  /** GM-only: remove the token. */
  onRemove: () => void
}

/**
 * Edit menu that floats next to the selected token. DOM (not Konva)
 * so the inputs use the browser's native chrome, with absolute
 * positioning over the canvas to keep the popover anchored as the
 * stage pans / zooms.
 */
function TokenPopover({
  token,
  stageX,
  stageY,
  stageScale,
  onClose,
  onRename,
  onChangeImage,
  onChangeSize,
  onRemove,
}: TokenPopoverProps) {
  const { t } = useI18n()
  // Local edit buffer so the input stays responsive while waiting for
  // the host commit to echo back. Commits on blur / Enter, so a typing
  // burst is a single network update. The parent keys this component
  // on `token.id`, so a new selection remounts and reseeds this state.
  const initialLabel = token.kind === 'gm' ? token.label ?? '' : ''
  const [labelDraft, setLabelDraft] = useState(initialLabel)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  // Anchor: 12 px to the right of the token's right edge in screen
  // space. The radius lookup matches the renderer's `cellSize / 2 - 2`
  // shape (with the 8 px floor) so the popover sits flush with the
  // outer ring.
  const screenX = token.x * stageScale + stageX
  const screenY = token.y * stageScale + stageY

  const commitLabel = () => {
    if (labelDraft === initialLabel) return
    onRename(labelDraft)
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const next = await prepareNpcTokenImage(file)
    if (next) onChangeImage(next)
  }

  return (
    <div
      className="tabletop-token-popover"
      style={{
        left: `${Math.round(screenX)}px`,
        top: `${Math.round(screenY)}px`,
      }}
    >
      <header className="tabletop-token-popover-header">
        <span className="tabletop-token-popover-title">
          {token.kind === 'gm'
            ? t('tabletop.tokenEdit.titleGm')
            : t('tabletop.tokenEdit.titlePc')}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('tabletop.tokenEdit.close')}
          onClick={onClose}
        >
          <CloseIcon size={14} />
        </button>
      </header>
      {token.kind === 'gm' && (
        <>
          <label className="tabletop-token-popover-row">
            <span>{t('tabletop.tokenEdit.label')}</span>
            <input
              type="text"
              value={labelDraft}
              maxLength={32}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitLabel()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
            />
          </label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImagePick}
          />
          <button
            type="button"
            className="tabletop-toolbar-button outline"
            onClick={() => imageInputRef.current?.click()}
          >
            {t('tabletop.tokenEdit.changeImage')}
          </button>
        </>
      )}
      <div className="tabletop-token-popover-row">
        <span>{t('tabletop.tokenEdit.size')}</span>
        <div
          className="tabletop-token-size-group"
          role="radiogroup"
          aria-label={t('tabletop.tokenEdit.size')}
        >
          {TOKEN_SIZES.map((s) => {
            const active = tokenSize(token) === s
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                className={`tabletop-token-size-btn${active ? ' active' : ''}`}
                onClick={() => onChangeSize(s)}
              >
                {String(s)}
              </button>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        className="tabletop-toolbar-button outline danger"
        onClick={onRemove}
      >
        <TrashIcon />
        <span>{t('tabletop.tokenEdit.remove')}</span>
      </button>
    </div>
  )
}

/**
 * Background map rendered at world origin (0, 0). Kept on its own
 * layer below the grid + tokens so panning / zooming the Stage is
 * what moves it — there is no per-image transform to maintain.
 */
function MapImage({
  src,
  width,
  height,
}: {
  src: string
  width: number
  height: number
}) {
  const [image, status] = useImage(src)
  // Defensive: a corrupted dataUrl arriving over the wire, an image
  // the browser cannot decode, or invalid dimensions from a malformed
  // sync would otherwise reach Konva / canvas and could throw. Guard
  // each so the ErrorBoundary stays a true safety net rather than the
  // primary handler.
  if (!src) return null
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  if (status === 'failed') return null
  if (!image) return null
  return <KonvaImage image={image} x={0} y={0} width={width} height={height} />
}

/** Resolve the portrait to render on a token, or `undefined`. */
function portraitForToken(token: Token, session: Session): string | undefined {
  if (token.kind === 'pc') {
    const key = characterImagesKey(token.ownerPlayerId, token.characterId)
    // Prefer the live record so a portrait edit on the active character
    // propagates instantly; fall back to the token's place-time
    // snapshot for non-active characters (which never land in
    // sessionCharacters), keeping the second-and-onwards-character
    // tokens visible.
    return (
      session.sessionCharacters[key]?.image ||
      token.snapshot?.image ||
      undefined
    )
  }
  // GM tokens carry their own image inline (set by the GM upload UI in PR 6).
  return token.image || undefined
}

/**
 * Resolve the display label for a token. GM tokens carry their own
 * label; PC tokens read the character name (or, when the player is
 * acting directly, the composed player display name) from the live
 * `sessionCharacters` record, with the token's place-time snapshot as
 * a fallback for non-active characters. Returns `undefined` for tokens
 * with no usable label so the renderer can skip drawing it.
 */
function labelForToken(token: Token, session: Session): string | undefined {
  if (token.kind === 'gm') return token.label || undefined
  const key = characterImagesKey(token.ownerPlayerId, token.characterId)
  const record = session.sessionCharacters[key]
  if (record) {
    // For a character-bound PC token, prefer the character name itself —
    // the GM-displayed "name" is the character, not the player.
    // For a player acting directly (no characterId), fall back to the
    // composed player display name.
    const live = token.characterId ? record.characterName : record.playerName
    if (live) return live
  }
  // No live record (or it has no usable name): fall back to the
  // snapshot captured at place time. This is how a non-active
  // character of the same player gets a label rendered.
  return token.snapshot?.name || undefined
}

interface FocusPulseProps {
  /** Token centre, world coords. */
  x: number
  y: number
  grid: Grid
  scale: number
  /** Animation progress 0..1. The component is mounted while phase < 1
   *  and unmounted by the parent when the run completes. */
  phase: number
}

/**
 * One-shot "look here!" ring anchored on a token. Rendered when the
 * user picks a token row from the right-side placed-tokens list — a
 * subtle alternative to opening the edit popover that just helps the
 * eye find the token after the camera re-centres on it.
 *
 * Two concentric rings expand and fade with a cubic ease-out so the
 * motion feels like a quick "tap" rather than a slow throb.
 */
function FocusPulse({ x, y, grid, scale, phase }: FocusPulseProps) {
  const baseRadius = Math.max(8, grid.cellSize / 2 - 2)
  // Cubic ease-out — fast initial expansion that decelerates.
  const eased = 1 - Math.pow(1 - phase, 3)
  // World-coord stroke widths shrink with scale so the line stays
  // about the same on-screen weight regardless of zoom.
  const px = (v: number) => v / scale
  const outerRadius = baseRadius * (1 + eased * 1.4)
  const outerOpacity = 1 - eased
  const innerRadius = baseRadius * (1 + eased * 0.7)
  const innerOpacity = (1 - eased) * 0.6
  return (
    <Group x={x} y={y} listening={false}>
      <Circle
        radius={outerRadius}
        stroke="#fde68a"
        strokeWidth={px(3.5)}
        opacity={outerOpacity}
      />
      <Circle
        radius={innerRadius}
        stroke="#ffffff"
        strokeWidth={px(2)}
        opacity={innerOpacity}
      />
    </Group>
  )
}

interface TokenViewProps {
  token: Token
  grid: Grid
  scale: number
  draggable: boolean
  portrait: string | undefined
  /** Display label rendered below the circle. For PC tokens this is
   *  the character (or composed player) name; for GM tokens it is the
   *  GM-typed label. `undefined` skips the text node entirely. */
  label: string | undefined
  onDragMove: (tokenId: string, x: number, y: number) => void
  onDragEnd: (tokenId: string, x: number, y: number) => void
  /** Called on a tap / click that is not the start of a drag. Used to
   *  open the token-edit popover. `undefined` when the viewer has no
   *  edit permission so the click is a no-op. */
  onSelect?: (tokenId: string) => void
  /** True for tokens the local viewer cannot move (other players' PCs
   *  or NPCs while not GM). Dims the rendering so the viewer can tell
   *  at a glance which tokens are theirs to operate. GMs see every
   *  token as interactive, so this flag is always false for them. */
  dimmed?: boolean
}

/**
 * One token on the table. PC tokens render the character portrait
 * inside a circular clip with a colored ring; tokens without a
 * portrait fall back to a flat disc tinted by the player's color. The
 * group itself is the draggable node, so the position the drag
 * callbacks report is the token's centre.
 */
function TokenView({
  token,
  grid,
  scale,
  draggable,
  portrait,
  label,
  onDragMove,
  onDragEnd,
  onSelect,
  dimmed = false,
}: TokenViewProps) {
  // Token radius scales with the token's grid size (1, 2, 3, 4 are
  // multiples of a cell; 0.6 is a sub-cell). The `- 2` keeps a small
  // visual gap so adjacent same-size tokens don't touch their borders.
  const radius = Math.max(8, (grid.cellSize * tokenSize(token)) / 2 - 2)
  const handleSelect = useCallback(() => {
    onSelect?.(token.id)
  }, [onSelect, token.id])
  const handleDragMove = useCallback(
    (e: KonvaEventObject<Event>) => {
      onDragMove(token.id, e.target.x(), e.target.y())
    },
    [onDragMove, token.id],
  )
  const handleDragEnd = useCallback(
    (e: KonvaEventObject<Event>) => {
      // Konva keeps its own x/y on the node during a drag. Read the
      // final position here, but let the parent snap (so the rule for
      // "where does the drop land" stays in one place).
      onDragEnd(token.id, e.target.x(), e.target.y())
    },
    [onDragEnd, token.id],
  )
  const fallback = token.kind === 'pc' ? playerColor(token.ownerPlayerId) : '#888'
  // Strokes / dashes are given in world coords; scale them down so they
  // render about one device pixel regardless of zoom.
  const strokeWidth = 2 / scale
  // Label sizing: pick world-space units that render around 14 device
  // pixels regardless of zoom.
  const labelFontSize = 14 / scale
  const labelStroke = 2 / scale
  const labelGap = 6 / scale
  // Reserve a wide box so the centred `align` has room to centre; the
  // box itself has no fill, so an empty side just paints nothing.
  const labelWidth = radius * 4
  // Fallback "initial" rendered inside the circle when no portrait is
  // set. Mirrors the feed avatar (FeedList) so the same character has
  // the same one-character glyph wherever it appears. World-space
  // diameter sized box so Konva's `verticalAlign='middle'` can centre
  // the glyph against the disc.
  const initial = !portrait ? avatarInitial(label) : ''
  const initialFontSize = radius * 1.05
  return (
    <Group
      x={token.x}
      y={token.y}
      draggable={draggable}
      opacity={dimmed ? 0.6 : 1}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleSelect}
      onTap={handleSelect}
    >
      {portrait ? (
        <ClippedPortrait src={portrait} radius={radius} fallback={fallback} />
      ) : (
        <Circle radius={radius} fill={fallback} />
      )}
      {initial && (
        <Text
          text={initial}
          x={-radius}
          y={-radius}
          width={radius * 2}
          height={radius * 2}
          align="center"
          verticalAlign="middle"
          fontSize={initialFontSize}
          fontStyle="bold"
          fill="#fff"
          listening={false}
        />
      )}
      <Circle radius={radius} stroke={fallback} strokeWidth={strokeWidth} />
      {label && (
        <Text
          text={label}
          x={-labelWidth / 2}
          y={radius + labelGap}
          width={labelWidth}
          align="center"
          fontSize={labelFontSize}
          fontStyle="bold"
          fill="#fff"
          stroke="#000"
          strokeWidth={labelStroke}
          fillAfterStrokeEnabled
          listening={false}
        />
      )}
    </Group>
  )
}

interface ClippedPortraitProps {
  src: string
  radius: number
  fallback: string
}

/**
 * Render a data URL portrait inside a circular clip. Falls back to a
 * coloured disc while the image is loading or unavailable.
 *
 * The image is sized with a CSS-`object-fit: cover` analogue — scale
 * so the shorter side fills the circle, then center the overflow —
 * which is then cropped by the circular `clipFunc`. The pre-fix code
 * hard-set width = height = 2r and stretched non-square sources;
 * users reported "potrait gets squashed" for landscape / portrait
 * uploads (NPC images and PC portraits that were not 1:1).
 *
 * `use-image` is the canonical Konva image loader (and what their
 * docs recommend) — it bridges the async load to React state without
 * tripping React 19's "no setState inside useEffect" lint rule that
 * a hand-rolled equivalent would otherwise need to suppress.
 */
function ClippedPortrait({ src, radius, fallback }: ClippedPortraitProps) {
  const [image] = useImage(src)
  if (!image) return <Circle radius={radius} fill={fallback} />
  const diameter = radius * 2
  // Source pixel size. `naturalWidth` / `naturalHeight` are not on
  // `HTMLImageElement`'s Konva-typed view; `width` / `height` are the
  // intrinsic size of the loaded resource here.
  const sw = image.width || diameter
  const sh = image.height || diameter
  // "cover" scale: shorter side fills the circle, longer side
  // overflows symmetrically and gets cropped by the clipFunc.
  const scale = Math.max(diameter / sw, diameter / sh)
  const renderW = sw * scale
  const renderH = sh * scale
  return (
    <Group
      clipFunc={(ctx) => {
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0, Math.PI * 2, false)
        ctx.closePath()
      }}
    >
      <KonvaImage
        image={image}
        x={-renderW / 2}
        y={-renderH / 2}
        width={renderW}
        height={renderH}
      />
    </Group>
  )
}

interface GridLinesProps {
  grid: Grid
  viewport: { x: number; y: number; width: number; height: number }
  scale: number
}

interface StrokeViewProps {
  stroke: DrawStroke
  scale: number
  /** True when the local actor is allowed to delete the stroke and the
   *  eraser tool is active. Click to remove; the underlying shape is
   *  otherwise listening-free so other tools pass clicks through. */
  erasable: boolean
  onErase: () => void
}

/**
 * One pen stroke on the canvas. Renders the world-space points as a
 * Konva Line; in eraser mode the parent layer turns `listening` on and
 * this shape exposes a click handler that removes it. `hitStrokeWidth`
 * is widened to a comfortable minimum so a thin stroke is still easy
 * to tap on touch.
 */
function StrokeView({ stroke, scale, erasable, onErase }: StrokeViewProps) {
  const hit = Math.max(stroke.width, 14 / scale)
  return (
    <Line
      points={stroke.points}
      stroke={stroke.color}
      strokeWidth={stroke.width}
      tension={0.4}
      lineCap="round"
      lineJoin="round"
      hitStrokeWidth={hit}
      listening={erasable}
      onClick={erasable ? onErase : undefined}
      onTap={erasable ? onErase : undefined}
    />
  )
}

interface MapTextViewProps {
  label: MapText
  scale: number
  erasable: boolean
  onErase: () => void
}

/**
 * One map text label. Stroke + fill so the text reads on light and
 * dark backgrounds alike. Eraser mode exposes the click handler;
 * otherwise the label is listening-free.
 */
function MapTextView({ label, scale, erasable, onErase }: MapTextViewProps) {
  const stroke = Math.max(1, label.fontSize * 0.08)
  return (
    <Text
      x={label.x}
      y={label.y}
      text={label.text}
      fontSize={label.fontSize}
      fontStyle="bold"
      fill={label.color}
      stroke="#000"
      strokeWidth={stroke}
      fillAfterStrokeEnabled
      // `hitStrokeWidth` widens the hit area beyond the visible glyph
      // edge so a thin font is still tap-friendly.
      hitStrokeWidth={Math.max(6 / scale, stroke)}
      listening={erasable}
      onClick={erasable ? onErase : undefined}
      onTap={erasable ? onErase : undefined}
    />
  )
}

interface FogLayerProps {
  fog: FogState
  grid: Grid
  /** Map width / height when a background is set — fog covers the map
   *  bounding box rather than the entire viewport so it does not
   *  bleed off the edge of the scene. `undefined` when whiteboard
   *  mode is in use; the fog then covers the visible viewport. */
  mapWidth: number | undefined
  mapHeight: number | undefined
  viewport: { x: number; y: number; width: number; height: number }
  /** GM sees semi-transparent fog (so they can paint through it);
   *  everyone else sees fully opaque fog (which hides what's
   *  beneath). */
  isGM: boolean
}

/**
 * Grid-cell fog of war. Renders one shape per un-revealed cell within
 * the bounding box (map dimensions if present, else viewport):
 *   - square grid → axis-aligned `<Rect>` per cell.
 *   - hex grid    → flat-top hex `<Line closed />` per cell.
 *   - no grid     → single full-bounds `<Rect>` as a "hide everything"
 *                   panic-button fallback (no cell paint possible).
 */
function FogLayer({
  fog,
  grid,
  mapWidth,
  mapHeight,
  viewport,
  isGM,
}: FogLayerProps) {
  const opacity = isGM ? 0.5 : 1
  const color = '#202028'
  // Bounding box of where the fog can land. With a map, cover the map
  // area only; without one, cover the visible viewport so the GM still
  // sees the fog effect on a whiteboard scene.
  const boundsX = mapWidth !== undefined ? 0 : viewport.x
  const boundsY = mapHeight !== undefined ? 0 : viewport.y
  const boundsW = mapWidth ?? viewport.width
  const boundsH = mapHeight ?? viewport.height
  if (grid.kind === 'none' || grid.cellSize <= 0) {
    // No grid — fall back to a single rect covering the bounds.
    // The GM cannot paint cells in this mode but the toggle still
    // makes "hide everything" possible as a panic button.
    if (fog.revealed.length > 0) return null
    return (
      <Rect
        x={boundsX}
        y={boundsY}
        width={boundsW}
        height={boundsH}
        fill={color}
        opacity={opacity}
      />
    )
  }
  // Intersect bounds with viewport to cap the cell-render count when
  // zoomed in. Without this, an off-screen 30×30 map would still
  // render hundreds of shapes every frame.
  const visX0 = Math.max(boundsX, viewport.x)
  const visY0 = Math.max(boundsY, viewport.y)
  const visX1 = Math.min(boundsX + boundsW, viewport.x + viewport.width)
  const visY1 = Math.min(boundsY + boundsH, viewport.y + viewport.height)
  if (visX1 <= visX0 || visY1 <= visY0) return null
  const visViewport = {
    x: visX0,
    y: visY0,
    width: visX1 - visX0,
    height: visY1 - visY0,
  }
  const revealedSet = new Set(fog.revealed)
  if (grid.kind === 'hex') {
    // Gather every unrevealed hex inside the visible portion of the
    // fog bounds. The list is then drawn as a SINGLE filled path so
    // adjacent cells share an edge instead of double-painting it
    // (drawing each hex as its own polygon would composite the
    // shared edge twice, producing visible "scars" at GM opacity).
    const h = hexHeight(grid.cellSize)
    const cells: Array<{ col: number; row: number }> = []
    for (const { col, row } of iterHexCellsInViewport(visViewport, grid)) {
      const key = `${col},${row}`
      if (revealedSet.has(key)) continue
      const center = hexCellCenter(col, row, grid)
      if (mapWidth !== undefined) {
        if (center.x + grid.cellSize / 2 <= 0 || center.x - grid.cellSize / 2 >= mapWidth) continue
        if (center.y + h / 2 <= 0 || center.y - h / 2 >= mapHeight!) continue
      }
      cells.push({ col, row })
    }
    if (cells.length === 0) return null
    return (
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath()
          for (const { col, row } of cells) {
            const poly = hexCellPolygon(col, row, grid)
            ctx.moveTo(poly[0], poly[1])
            for (let i = 2; i < poly.length; i += 2) {
              ctx.lineTo(poly[i], poly[i + 1])
            }
            ctx.closePath()
          }
          ctx.fillStrokeShape(shape)
        }}
        fill={color}
        opacity={opacity}
        listening={false}
      />
    )
  }
  const cell = grid.cellSize
  const startCol = Math.floor((visX0 - grid.originX) / cell)
  const endCol = Math.ceil((visX1 - grid.originX) / cell) - 1
  const startRow = Math.floor((visY0 - grid.originY) / cell)
  const endRow = Math.ceil((visY1 - grid.originY) / cell) - 1
  const rects: ReactNode[] = []
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const key = `${col},${row}`
      if (revealedSet.has(key)) continue
      const x = grid.originX + col * cell
      const y = grid.originY + row * cell
      // Skip cells outside the map's bounding box so fog never bleeds
      // past the edge of the scene.
      if (mapWidth !== undefined) {
        if (x + cell <= 0 || x >= mapWidth) continue
        if (y + cell <= 0 || y >= mapHeight!) continue
      }
      rects.push(
        <Rect
          key={key}
          x={x}
          y={y}
          width={cell}
          height={cell}
          fill={color}
          opacity={opacity}
        />,
      )
    }
  }
  return <>{rects}</>
}

interface TextDraftInputProps {
  stageX: number
  stageY: number
  stageScale: number
  worldX: number
  worldY: number
  color: string
  fontSize: number
  /** Commit the current draft text. The parent decides whether an
   *  empty string cancels or no-ops (currently: cancel). */
  onCommit: (value: string) => void
  onCancel: () => void
}

/**
 * Floating HTML text input shown while the user is typing a new map
 * label. Positioned in screen coords matching the world-space click
 * point so the input visually replaces the label that will be
 * committed. Enter places it; Escape cancels.
 *
 * The draft text lives in this component's local state — bubbling
 * every keystroke up to `TablePanel` would re-render the Konva stage
 * on each character, which is wasteful (the stage doesn't depend on
 * the draft). The parent re-keys this component on click position
 * so a fresh placement starts with an empty input.
 */
function TextDraftInput({
  stageX,
  stageY,
  stageScale,
  worldX,
  worldY,
  color,
  fontSize,
  onCommit,
  onCancel,
}: TextDraftInputProps) {
  const { t } = useI18n()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [value, setValue] = useState('')
  const screenX = worldX * stageScale + stageX
  const screenY = worldY * stageScale + stageY
  // Outside-click commits the draft so the user does not have to hit
  // the explicit "place" button (or Enter) after typing. The effect
  // re-binds when `value` or `onCommit` change so the listener always
  // has fresh closures — a DOM listener rebind is cheap and avoids
  // the React 19 "no ref writes during render" rule that a ref-based
  // workaround would trip. `onCommit` decides commit-vs-cancel based
  // on the value it receives.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = wrapperRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      onCommit(value)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [value, onCommit])
  return (
    <div
      ref={wrapperRef}
      className="tabletop-text-draft"
      style={{
        left: `${Math.round(screenX)}px`,
        top: `${Math.round(screenY)}px`,
      }}
    >
      <input
        autoFocus
        type="text"
        maxLength={200}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit(value)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        placeholder={t('tabletop.tools.textPlaceholder')}
        style={{
          color,
          fontSize: `${Math.max(12, fontSize * stageScale)}px`,
        }}
      />
      <div className="tabletop-text-draft-actions">
        <button
          type="button"
          className="tabletop-toolbar-button"
          onClick={() => onCommit(value)}
        >
          {t('tabletop.tools.textOk')}
        </button>
        <button
          type="button"
          className="tabletop-toolbar-button outline"
          onClick={onCancel}
        >
          {t('tabletop.tools.textCancel')}
        </button>
      </div>
    </div>
  )
}

/**
 * Render the visible portion of the grid as a set of Konva Lines.
 * Computing per-frame `col / row` bounds avoids drawing lines that lie
 * outside the viewport — important when the user zooms far in.
 */
function GridLines({ grid, viewport, scale }: GridLinesProps) {
  if (grid.kind === 'none') return null
  const cell = grid.cellSize
  if (cell <= 0) return null
  // Stroke width is given in world coordinates, so scale it down so it
  // always renders ~1 device pixel regardless of zoom.
  const strokeWidth = 1 / scale
  if (grid.kind === 'hex') {
    // Draw an outlined polygon per visible hex. Shared edges get
    // painted twice (each hex paints its own outline) which is
    // visually fine and keeps the loop trivial.
    const lines: ReactNode[] = []
    for (const { col, row } of iterHexCellsInViewport(viewport, grid)) {
      lines.push(
        <Line
          key={`h-${col},${row}`}
          points={hexCellPolygon(col, row, grid)}
          stroke={grid.strokeColor}
          strokeWidth={strokeWidth}
          opacity={grid.strokeOpacity}
          closed
          listening={false}
        />,
      )
    }
    return <>{lines}</>
  }
  // Square grid: vertical + horizontal scan lines.
  const startCol = Math.floor((viewport.x - grid.originX) / cell) - 1
  const endCol = Math.ceil((viewport.x + viewport.width - grid.originX) / cell) + 1
  const startRow = Math.floor((viewport.y - grid.originY) / cell) - 1
  const endRow = Math.ceil((viewport.y + viewport.height - grid.originY) / cell) + 1
  const minX = grid.originX + startCol * cell
  const maxX = grid.originX + endCol * cell
  const minY = grid.originY + startRow * cell
  const maxY = grid.originY + endRow * cell
  const verticals: number[][] = []
  const horizontals: number[][] = []
  for (let col = startCol; col <= endCol; col++) {
    const x = grid.originX + col * cell
    verticals.push([x, minY, x, maxY])
  }
  for (let row = startRow; row <= endRow; row++) {
    const y = grid.originY + row * cell
    horizontals.push([minX, y, maxX, y])
  }
  return (
    <>
      {verticals.map((points, i) => (
        <Line
          key={`v-${i}`}
          points={points}
          stroke={grid.strokeColor}
          strokeWidth={strokeWidth}
          opacity={grid.strokeOpacity}
          listening={false}
        />
      ))}
      {horizontals.map((points, i) => (
        <Line
          key={`h-${i}`}
          points={points}
          stroke={grid.strokeColor}
          strokeWidth={strokeWidth}
          opacity={grid.strokeOpacity}
          listening={false}
        />
      ))}
    </>
  )
}
