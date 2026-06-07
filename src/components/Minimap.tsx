import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useI18n } from '../i18n/useI18n'
import { playerColor } from '../players/colors'
import {
  cellFromWorld,
  fogCellKey,
  type FogState,
  type Grid,
  type MapBackground,
  type Token,
} from '../tabletop/types'
import {
  fitRect,
  fogHidesWorldPoint,
  minimapToWorld,
  minimapWorldBounds,
  worldToMinimap,
  type Rect,
} from '../tabletop/minimap'
import { CloseIcon } from './icons'

/** Minimap box size (device px). */
const BOX_W = 168
const BOX_H = 120
/** Fog overlay tint — matches the main canvas FogLayer. */
const FOG_COLOR = '#202028'

interface Props {
  map?: MapBackground
  tokens: ReadonlyArray<Token>
  /** Active (un-expired) pings, shown as colored markers so a ping
   *  anywhere on the scene is visible even when off the main viewport. */
  pings: ReadonlyArray<{ key: string; x: number; y: number; playerId: string }>
  /** Current visible world rectangle (from the stage transform). */
  viewport: Rect
  /** Grid + fog so the overview can honour fog of war. */
  grid: Grid
  fog: FogState
  /** GM (or offline) viewer: sees through fog at reduced opacity and keeps
   *  every dot. A non-GM gets opaque fog and fogged dots removed, so the
   *  overview never spoils a GM-hidden area. */
  isGM: boolean
  /** Recenter the camera on a world point (minimap click / drag). */
  onRecenter: (worldX: number, worldY: number) => void
  /** Hide the minimap. */
  onCollapse: () => void
}

/**
 * A corner overview of the current scene: the map (or a blank region),
 * a dot per token, and a rectangle for the current viewport. Clicking or
 * dragging recenters the camera. Plain DOM (positioned over the canvas),
 * with the geometry handled by the pure `tabletop/minimap.ts`.
 */
export function Minimap({
  map,
  tokens,
  pings,
  viewport,
  grid,
  fog,
  isGM,
  onRecenter,
  onCollapse,
}: Props) {
  const { t } = useI18n()
  const boxRef = useRef<HTMLDivElement | null>(null)
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const world = minimapWorldBounds({
    map: map ? { width: map.width, height: map.height } : undefined,
    tokens,
    viewport,
  })
  const tr = fitRect(world, { width: BOX_W, height: BOX_H })

  // Paint the fog overlay onto a small canvas: sample each box pixel back
  // to its world cell and tint the ones that are not revealed. Sampling
  // (rather than cell rects) keeps one code path for square AND hex grids,
  // and only re-runs when fog / frame / viewer changes — never per frame.
  const revealedKey = fog.enabled ? fog.revealed.join('|') : 'off'
  useEffect(() => {
    const cv = fogCanvasRef.current
    const ctx = cv?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, BOX_W, BOX_H)
    if (!fog.enabled || tr.scale <= 0) return
    ctx.fillStyle = FOG_COLOR
    ctx.globalAlpha = isGM ? 0.5 : 1
    const x0 = Math.max(0, Math.floor(tr.offsetX))
    const y0 = Math.max(0, Math.floor(tr.offsetY))
    const x1 = Math.min(BOX_W, Math.ceil(tr.offsetX + tr.width))
    const y1 = Math.min(BOX_H, Math.ceil(tr.offsetY + tr.height))
    if (grid.kind === 'none' || grid.cellSize <= 0) {
      // Grid-less "hide everything" panic button: cover the whole content
      // when nothing is revealed (matches the main canvas FogLayer).
      if (fog.revealed.length === 0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    } else {
      const revealed = new Set(fog.revealed)
      // Per-pixel: sample each box pixel's centre back to its world cell.
      // A revealed/fogged boundary can leave a sub-pixel (≤0.5 device px)
      // sliver of the fogged side uncovered — imperceptible at minimap
      // scale, so accepted rather than over-covering revealed area.
      for (let my = y0; my < y1; my++) {
        for (let mx = x0; mx < x1; mx++) {
          const w = minimapToWorld(mx + 0.5, my + 0.5, world, tr)
          const c = cellFromWorld(w.x, w.y, grid)
          if (!revealed.has(fogCellKey(c.col, c.row))) ctx.fillRect(mx, my, 1, 1)
        }
      }
    }
    ctx.globalAlpha = 1
    // World / transform are recomputed each render but stable across pans
    // (frame is pan-invariant); depend on their primitive fields so the
    // expensive repaint only fires on a real fog / zoom / scene change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    revealedKey,
    fog.enabled,
    isGM,
    grid.kind,
    grid.cellSize,
    grid.originX,
    grid.originY,
    world.x,
    world.y,
    world.width,
    world.height,
    tr.scale,
    tr.offsetX,
    tr.offsetY,
    tr.width,
    tr.height,
  ])

  const recenterFromEvent = (e: ReactPointerEvent) => {
    const el = boxRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = minimapToWorld(e.clientX - r.left, e.clientY - r.top, world, tr)
    onRecenter(w.x, w.y)
  }

  const vpTL = worldToMinimap(viewport.x, viewport.y, world, tr)
  const vpW = viewport.width * tr.scale
  const vpH = viewport.height * tr.scale

  return (
    <div className="tabletop-minimap" style={{ width: BOX_W, height: BOX_H }}>
      <div
        ref={boxRef}
        className="tabletop-minimap-canvas"
        role="button"
        tabIndex={0}
        aria-label={t('tabletop.minimap.label')}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          recenterFromEvent(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons) recenterFromEvent(e)
        }}
        onKeyDown={(e) => {
          // Keyboard affordance: Enter / Space recenters on the scene
          // centre, so the minimap is operable without a pointer.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onRecenter(world.x + world.width / 2, world.y + world.height / 2)
          }
        }}
      >
        {map?.dataUrl && (
          <img
            className="tabletop-minimap-map"
            src={map.dataUrl}
            alt=""
            draggable={false}
            style={{
              left: `${tr.offsetX}px`,
              top: `${tr.offsetY}px`,
              width: `${tr.width}px`,
              height: `${tr.height}px`,
            }}
          />
        )}
        {/* Fog overlay — covers fogged terrain (opaque for non-GM) above
            the map but below the dots. */}
        <canvas
          ref={fogCanvasRef}
          className="tabletop-minimap-fog"
          width={BOX_W}
          height={BOX_H}
        />
        {tokens.map((tok) => {
          // Non-GM viewers must not see a token sitting in a fogged cell —
          // its dot would otherwise leak the position through the overview.
          if (!isGM && fogHidesWorldPoint(fog, grid, tok.x, tok.y)) return null
          const p = worldToMinimap(tok.x, tok.y, world, tr)
          const color = tok.kind === 'pc' ? playerColor(tok.ownerPlayerId) : '#bbbbbb'
          return (
            <span
              key={tok.id}
              className="tabletop-minimap-dot"
              style={{ left: `${p.x}px`, top: `${p.y}px`, background: color }}
            />
          )
        })}
        {pings.map((pg) => {
          if (!isGM && fogHidesWorldPoint(fog, grid, pg.x, pg.y)) return null
          const p = worldToMinimap(pg.x, pg.y, world, tr)
          return (
            <span
              key={pg.key}
              className="tabletop-minimap-ping"
              style={{
                left: `${p.x}px`,
                top: `${p.y}px`,
                color: playerColor(pg.playerId),
              }}
            />
          )
        })}
        <div
          className="tabletop-minimap-viewport"
          style={{
            left: `${vpTL.x}px`,
            top: `${vpTL.y}px`,
            width: `${Math.max(2, vpW)}px`,
            height: `${Math.max(2, vpH)}px`,
          }}
        />
      </div>
      <button
        type="button"
        className="tabletop-minimap-collapse icon-btn"
        aria-label={t('tabletop.minimap.collapse')}
        title={t('tabletop.minimap.collapse')}
        onClick={onCollapse}
      >
        <CloseIcon size={12} />
      </button>
    </div>
  )
}
