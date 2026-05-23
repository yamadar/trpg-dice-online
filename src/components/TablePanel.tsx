import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Line, Stage } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useI18n } from '../i18n/useI18n'
import type { Session } from '../hooks/useSession'
import type { Grid } from '../tabletop/types'
import { CloseIcon, TabletopIcon } from './icons'
import { TableToolbar } from './TableToolbar'

interface Props {
  session: Session
  onClose: () => void
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
export function TablePanel({ session, onClose }: Props) {
  const { t } = useI18n()
  const { tabletop, updateGrid } = session
  // Grid editing is GM-only when in a room, but always available when
  // offline so a player can experiment with the table on their own —
  // the saved state is harmless when there is no session id.
  const canEdit = session.role !== 'client'

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
          >
            <Layer listening={false}>
              <GridLines
                grid={tabletop.grid}
                viewport={viewport}
                scale={stageScale}
              />
            </Layer>
          </Stage>
        )}
      </div>
      {canEdit && <TableToolbar grid={tabletop.grid} onChange={updateGrid} />}
    </div>
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
