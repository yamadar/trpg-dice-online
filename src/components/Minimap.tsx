import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useI18n } from '../i18n/useI18n'
import { playerColor } from '../players/colors'
import type { MapBackground, Token } from '../tabletop/types'
import {
  fitRect,
  minimapToWorld,
  minimapWorldBounds,
  worldToMinimap,
  type Rect,
} from '../tabletop/minimap'
import { CloseIcon } from './icons'

/** Minimap box size (device px). */
const BOX_W = 168
const BOX_H = 120

interface Props {
  map?: MapBackground
  tokens: ReadonlyArray<Token>
  /** Active (un-expired) pings, shown as colored markers so a ping
   *  anywhere on the scene is visible even when off the main viewport. */
  pings: ReadonlyArray<{ key: string; x: number; y: number; playerId: string }>
  /** Current visible world rectangle (from the stage transform). */
  viewport: Rect
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
export function Minimap({ map, tokens, pings, viewport, onRecenter, onCollapse }: Props) {
  const { t } = useI18n()
  const boxRef = useRef<HTMLDivElement | null>(null)
  const world = minimapWorldBounds({
    map: map ? { width: map.width, height: map.height } : undefined,
    tokens,
    viewport,
  })
  const tr = fitRect(world, { width: BOX_W, height: BOX_H })

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
        {tokens.map((tok) => {
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
