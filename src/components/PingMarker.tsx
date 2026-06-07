import { useEffect, useState } from 'react'
import { Circle, Group, Text } from 'react-konva'
import {
  PING_RING_COUNT,
  pingDotOpacity,
  pingProgress,
  pingRingStyle,
} from '../tabletop/ping'

/**
 * A transient "look here" ping rendered on the table: a solid centre dot
 * plus a few concentric rings that ripple outward in the pinger's colour,
 * with the pinger's name beneath. Counter-scaled so it stays a constant
 * on-screen size at any zoom and `listening={false}` so it never
 * intercepts pointer events. Self-animates via rAF and calls `onDone`
 * when finished so the parent can drop it from its list — the same
 * lifecycle as `DiceRollAnimation`.
 */
export interface PingMarkerProps {
  /** World-space pixel coordinates of the ping centre. */
  x: number
  y: number
  /** Ring / dot colour — the pinger's player colour. */
  color: string
  /** Display name of the pinger, shown beneath the marker. '' hides it. */
  name: string
  /** Stage scale; keeps the marker a constant on-screen size at any zoom. */
  scale: number
  /** Fired once when the animation completes. */
  onDone: () => void
}

/** Base ring radius in world px at scale = 1. */
const PING_BASE_RADIUS = 22

export function PingMarker({ x, y, color, name, scale, onDone }: PingMarkerProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0
    let start: number | null = null
    const step = (ts: number) => {
      if (start === null) start = ts
      const p = pingProgress(ts - start)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(step)
      else onDone()
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // `onDone` is captured once: the parent keys this component by ping id
    // and onDone only removes by that stable key, so re-subscribing is
    // unnecessary and would restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const base = PING_BASE_RADIUS / scale
  const dotRadius = base * 0.34
  const ringStroke = 2.5 / scale
  const dotOpacity = pingDotOpacity(progress)
  const labelFontSize = 13 / scale
  const labelStroke = 2 / scale
  const labelWidth = base * 6

  return (
    <Group x={x} y={y} listening={false}>
      {Array.from({ length: PING_RING_COUNT }, (_, i) => {
        const { radius, opacity } = pingRingStyle(progress, i)
        if (opacity <= 0) return null
        return (
          <Circle
            key={i}
            radius={base * radius}
            stroke={color}
            strokeWidth={ringStroke}
            opacity={opacity}
          />
        )
      })}
      <Circle radius={dotRadius} fill={color} opacity={dotOpacity} />
      {name && (
        <Text
          text={name}
          x={-labelWidth / 2}
          y={base * 1.5}
          width={labelWidth}
          align="center"
          fontSize={labelFontSize}
          fontStyle="bold"
          fill="#fff"
          stroke="#000"
          strokeWidth={labelStroke}
          fillAfterStrokeEnabled
          opacity={dotOpacity}
        />
      )}
    </Group>
  )
}
