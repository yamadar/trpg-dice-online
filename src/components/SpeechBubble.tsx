import { Group, Line, Rect, Text } from 'react-konva'
import type { Token } from '../tabletop/types'

/**
 * Floating speech bubble anchored above (or beside) a PC token on the
 * tabletop canvas. Rendered for a few seconds whenever the token's
 * owner posts a chat message, then auto-removed by the parent.
 *
 * Sizes are world-space pixels divided by the current stage scale, so
 * the bubble appears at a constant on-screen size regardless of zoom —
 * matching the token's name label which does the same.
 */
export interface SpeechBubbleProps {
  /** Token the bubble belongs to. Read for position only (`x`, `y`);
   *  the bubble does not move when the token moves — the offset is
   *  baked in when the bubble is created. */
  token: Token
  /** Plain text body. Capped by the caller; this component truncates
   *  with an ellipsis if the text overflows two lines. */
  text: string
  /** Offset of the bubble centre from the token centre in world px. */
  offsetX: number
  offsetY: number
  /** Current stage scale; used to keep on-screen size constant. */
  scale: number
}

/** World-space width of the bubble at scale = 1. */
const BUBBLE_W = 160
/** World-space height at scale = 1. Caps to two short lines of text. */
const BUBBLE_H = 56
/** Pointer "tail" half-width (world px at scale = 1) — the base of
 *  the triangle on the bubble's edge. */
const POINTER_HALF = 8

export function SpeechBubble({
  token,
  text,
  offsetX,
  offsetY,
  scale,
}: SpeechBubbleProps) {
  // Counter-scale every dimension so the bubble stays a fixed pixel
  // size on the user's screen as they zoom in / out.
  const w = BUBBLE_W / scale
  const h = BUBBLE_H / scale
  const fontSize = 12 / scale
  const padding = 8 / scale
  const radius = 10 / scale
  const stroke = 1 / scale

  // World position of the bubble centre.
  const cx = token.x + offsetX / scale
  const cy = token.y + offsetY / scale

  // Pointer tail: base on the bubble's edge facing the token, tip at
  // the token's centre. The base is perpendicular to the (bubble →
  // token) direction so the triangle reads as a tail no matter the
  // bubble's position. Uses ray-rect intersection so the base sits on
  // the actual edge, not at the bubble's centre.
  const dx = token.x - cx
  const dy = token.y - cy
  const dist = Math.hypot(dx, dy) || 1
  const dirX = dx / dist
  const dirY = dy / dist
  // Distance from centre to the edge along (dirX, dirY) for a
  // rectangle of half-extents (w/2, h/2). Solve `t * |dir.axis| <=
  // halfExtent` along each axis and take the smaller `t`.
  const tx = dirX !== 0 ? (w / 2) / Math.abs(dirX) : Infinity
  const ty = dirY !== 0 ? (h / 2) / Math.abs(dirY) : Infinity
  // Pull the base inward past the rounded corner so the bubble body
  // (drawn on top) always covers the tail's base edge. Without the
  // inset, diagonal directions land the base on a rounded corner where
  // the body's fill is clipped away, leaving the triangle's flat base
  // poking out from under the bubble.
  const t = Math.max(0, Math.min(tx, ty) - radius)
  const baseCx = cx + dirX * t
  const baseCy = cy + dirY * t
  // Perpendicular vector for the base width.
  const perpX = -dirY
  const perpY = dirX
  const pHalf = POINTER_HALF / scale
  const baseAx = baseCx + perpX * pHalf
  const baseAy = baseCy + perpY * pHalf
  const baseBx = baseCx - perpX * pHalf
  const baseBy = baseCy - perpY * pHalf

  return (
    <Group listening={false}>
      {/* Only the dark tail + body fade together, at one shared opacity
          on this inner Group, so their overlap never composites into a
          darker seam. The text and border live OUTSIDE it and stay
          fully opaque — folding the fade onto the outer Group would dim
          the white chat text too. Tail first so the body (drawn on top)
          overlaps the tail's base; the tail carries no stroke so its
          slanted sides just extend the body's fill toward the token. */}
      <Group opacity={0.92}>
        <Line
          points={[token.x, token.y, baseAx, baseAy, baseBx, baseBy]}
          closed
          fill="rgb(20, 20, 20)"
        />
        <Rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          cornerRadius={radius}
          fill="rgb(20, 20, 20)"
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth={stroke}
        />
      </Group>
      <Text
        x={cx - w / 2 + padding}
        y={cy - h / 2 + padding}
        width={w - padding * 2}
        height={h - padding * 2}
        text={text}
        fill="#ffffff"
        fontSize={fontSize}
        lineHeight={1.25}
        align="center"
        verticalAlign="middle"
        wrap="word"
        ellipsis
      />
    </Group>
  )
}
