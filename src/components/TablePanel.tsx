import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Stage,
  Text,
} from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import useImage from 'use-image'
import { useI18n } from '../i18n/useI18n'
import type { Session } from '../hooks/useSession'
import { playerColor } from '../players/colors'
import { characterImagesKey } from '../storage/roomLog'
import { canMoveToken } from '../tabletop/tokens'
import type { Grid, Token } from '../tabletop/types'
import { prepareNpcTokenImage } from '../characters/image'
import { ChatIcon, CloseIcon, DiceIcon, TabletopIcon, TrashIcon } from './icons'
import { TableToolbar } from './TableToolbar'

interface Props {
  session: Session
  onClose: () => void
  /**
   * The feed + chat composer to render as a floating overlay when the
   * "chat" toggle is on. Owned by the parent so it shares one
   * `session` / `characters` / `flash` set with the rest of the app —
   * the tabletop is just a viewport for it here.
   */
  chatPanel?: ReactNode
  /**
   * The dice roller (and pattern list) to render as a floating overlay
   * when the "dice" toggle is on. Composed by the parent so it can
   * reuse the same draft state as the Dock-launched dice Sheet.
   */
  dicePanel?: ReactNode
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
export function TablePanel({ session, onClose, chatPanel, dicePanel }: Props) {
  const { t } = useI18n()
  const { tabletop, updateGrid, moveTokenLive, moveTokenCommit } = session
  // Grid editing is GM-only when in a room, but always available when
  // offline so a player can experiment with the table on their own —
  // the saved state is harmless when there is no session id.
  const canEdit = session.role !== 'client'
  /**
   * Independent show/hide toggles for the three overlays. Map ops
   * defaults ON for editable users (matches the prior always-on
   * toolbar). Chat / dice default OFF — they belong to the rest of
   * the app and should not block the canvas on a first look.
   */
  const [showMapOps, setShowMapOps] = useState(true)
  const [showChat, setShowChat] = useState(false)
  const [showDice, setShowDice] = useState(false)
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
  const selectedToken = useMemo(
    () =>
      selectedTokenId === null
        ? null
        : tabletop.tokens.find((t) => t.id === selectedTokenId) ?? null,
    [selectedTokenId, tabletop.tokens],
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [stageX, setStageX] = useState(0)
  const [stageY, setStageY] = useState(0)
  const [stageScale, setStageScale] = useState(1)
  const spaceDownRef = useRef(false)
  const panStateRef = useRef<PanState | null>(null)
  const pinchStateRef = useRef<PinchState | null>(null)

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

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const ev = e.evt
      // Pan when the user presses the right button, or holds Space.
      // Left-click is reserved for PR 4's token drag, so it must not
      // start a pan here.
      if (ev.button === 2 || (ev.button === 0 && spaceDownRef.current)) {
        ev.preventDefault()
        panStateRef.current = {
          startClientX: ev.clientX,
          startClientY: ev.clientY,
          startStageX: stageX,
          startStageY: stageY,
        }
      }
    },
    [stageX, stageY],
  )

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const ps = panStateRef.current
    if (!ps) return
    setStageX(ps.startStageX + (e.evt.clientX - ps.startClientX))
    setStageY(ps.startStageY + (e.evt.clientY - ps.startClientY))
  }, [])

  const handleMouseUp = useCallback(() => {
    panStateRef.current = null
  }, [])

  // Two-finger pinch + pan. A single touch is intentionally a no-op
  // here — that gesture will become "drag the token under the finger"
  // in PR 4. Konva passes the same event for the two-finger case as a
  // `KonvaEventObject<TouchEvent>` whose `evt.touches` has length 2.
  const handleTouchStart = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches
      if (touches.length !== 2) return
      e.evt.preventDefault()
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
    },
    [stageScale, stageX, stageY],
  )

  const handleTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    const ps = pinchStateRef.current
    if (!ps) return
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
    // initial midpoint" by virtue of starting from the original stage
    // offset (the user can then zoom + pan together without the world
    // point under the midpoint drifting too far).
    setStageScale(newScale)
    setStageX(ps.initialStageX + (cx - ps.initialCenterX))
    setStageY(ps.initialStageY + (cy - ps.initialCenterY))
  }, [])

  const handleTouchEnd = useCallback((e: KonvaEventObject<TouchEvent>) => {
    // Drop the pinch state once any finger lifts — the remaining touch
    // (if any) should not keep moving the stage.
    if (e.evt.touches.length < 2) pinchStateRef.current = null
  }, [])

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

  return (
    <div
      className="tabletop-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tabletop-title"
    >
      <header className="tabletop-header">
        <h2 id="tabletop-title" className="tabletop-title">
          <span className="panel-icon">
            <TabletopIcon size={20} />
          </span>
          {t('tabletop.title')}
        </h2>
        <nav
          className="tabletop-toggles"
          aria-label={t('tabletop.toggle.nav')}
        >
          {canEdit && (
            <button
              type="button"
              className={`tabletop-toggle-btn${showMapOps ? ' active' : ''}`}
              aria-pressed={showMapOps}
              title={t('tabletop.toggle.mapOps')}
              onClick={() => setShowMapOps((v) => !v)}
            >
              <TabletopIcon size={18} />
              <span className="tabletop-toggle-label">
                {t('tabletop.toggle.mapOps')}
              </span>
            </button>
          )}
          {chatPanel && (
            <button
              type="button"
              className={`tabletop-toggle-btn${showChat ? ' active' : ''}`}
              aria-pressed={showChat}
              title={t('tabletop.toggle.chat')}
              onClick={() => setShowChat((v) => !v)}
            >
              <ChatIcon size={18} />
              <span className="tabletop-toggle-label">
                {t('tabletop.toggle.chat')}
              </span>
            </button>
          )}
          {dicePanel && (
            <button
              type="button"
              className={`tabletop-toggle-btn${showDice ? ' active' : ''}`}
              aria-pressed={showDice}
              title={t('tabletop.toggle.dice')}
              onClick={() => setShowDice((v) => !v)}
            >
              <DiceIcon size={18} />
              <span className="tabletop-toggle-label">
                {t('tabletop.toggle.dice')}
              </span>
            </button>
          )}
        </nav>
        <button
          type="button"
          className="sheet-close icon-btn"
          onClick={onClose}
          aria-label={t('tabletop.close')}
        >
          <CloseIcon />
        </button>
      </header>
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
            <Layer>
              {tabletop.tokens.map((token) => (
                <TokenView
                  key={token.id}
                  token={token}
                  grid={tabletop.grid}
                  scale={stageScale}
                  draggable={canMoveToken(token, tokenActor)}
                  portrait={portraitForToken(token, session)}
                  label={labelForToken(token, session)}
                  onDragMove={moveTokenLive}
                  onDragEnd={moveTokenCommit}
                  onSelect={canEdit ? setSelectedTokenId : undefined}
                />
              ))}
            </Layer>
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
            onRemove={() => {
              session.removeToken(selectedToken.id)
              setSelectedTokenId(null)
            }}
          />
        )}
      </div>
      {canEdit && showMapOps && (
        <TableToolbar
          grid={tabletop.grid}
          onChange={updateGrid}
          map={tabletop.map}
          onSetMap={session.setMapBackground}
          onClearMap={session.clearMapBackground}
          tokens={tabletop.tokens}
          players={session.players}
          onAddGmToken={session.addGmToken}
          onAddPlayerToken={session.addPlayerToken}
          onRemoveToken={session.removeToken}
        />
      )}
      {chatPanel && showChat && (
        <aside
          className="tabletop-overlay tabletop-overlay-chat"
          aria-label={t('tabletop.toggle.chat')}
        >
          {chatPanel}
        </aside>
      )}
      {dicePanel && showDice && (
        <aside
          className="tabletop-overlay tabletop-overlay-dice"
          aria-label={t('tabletop.toggle.dice')}
        >
          {dicePanel}
        </aside>
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
  const [image] = useImage(src)
  if (!image) return null
  return <KonvaImage image={image} x={0} y={0} width={width} height={height} />
}

/** Resolve the portrait to render on a token, or `undefined`. */
function portraitForToken(token: Token, session: Session): string | undefined {
  if (token.kind === 'pc') {
    const key = characterImagesKey(token.ownerPlayerId, token.characterId)
    return session.sessionCharacters[key]?.image || undefined
  }
  // GM tokens carry their own image inline (set by the GM upload UI in PR 6).
  return token.image || undefined
}

/**
 * Resolve the display label for a token. GM tokens carry their own
 * label; PC tokens read the character name (or, when the player is
 * acting directly, the composed player display name) from the live
 * `sessionCharacters` record. Returns `undefined` for tokens with no
 * usable label so the renderer can skip drawing it.
 */
function labelForToken(token: Token, session: Session): string | undefined {
  if (token.kind === 'gm') return token.label || undefined
  const key = characterImagesKey(token.ownerPlayerId, token.characterId)
  const record = session.sessionCharacters[key]
  if (!record) return undefined
  // For a character-bound PC token, prefer the character name itself —
  // the GM-displayed "name" is the character, not the player.
  // For a player acting directly (no characterId), fall back to the
  // composed player display name.
  return (token.characterId ? record.characterName : record.playerName) || undefined
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
}: TokenViewProps) {
  const radius = Math.max(8, grid.cellSize / 2 - 2)
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
  return (
    <Group
      x={token.x}
      y={token.y}
      draggable={draggable}
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
 * `use-image` is the canonical Konva image loader (and what their
 * docs recommend) — it bridges the async load to React state without
 * tripping React 19's "no setState inside useEffect" lint rule that
 * a hand-rolled equivalent would otherwise need to suppress.
 */
function ClippedPortrait({ src, radius, fallback }: ClippedPortraitProps) {
  const [image] = useImage(src)
  if (!image) return <Circle radius={radius} fill={fallback} />
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
        x={-radius}
        y={-radius}
        width={radius * 2}
        height={radius * 2}
      />
    </Group>
  )
}

interface GridLinesProps {
  grid: Grid
  viewport: { x: number; y: number; width: number; height: number }
  scale: number
}

/**
 * Render the visible portion of the grid as a set of Konva Lines.
 * Computing per-frame `col / row` bounds avoids drawing lines that lie
 * outside the viewport — important when the user zooms far in.
 */
function GridLines({ grid, viewport, scale }: GridLinesProps) {
  if (grid.kind !== 'square') return null
  const cell = grid.cellSize
  if (cell <= 0) return null
  // Stroke width is given in world coordinates, so scale it down so it
  // always renders ~1 device pixel regardless of zoom.
  const strokeWidth = 1 / scale
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
