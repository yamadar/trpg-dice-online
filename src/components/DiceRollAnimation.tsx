import { useEffect, useState } from 'react'
import { Circle, Group, Rect } from 'react-konva'
import type { Token } from '../tabletop/types'

/**
 * A small die that "tumbles" out of a token when its owner rolls dice on
 * the tabletop. Deliberately simple — a rounded white cube with pips that
 * arcs up, spins ~1.5 turns and fades. Anchored to the roller's operating
 * character token (the parent picks the token); counter-scaled so it
 * stays a constant on-screen size at any zoom. `listening={false}` keeps
 * it clear of pointer events. Self-animates via rAF and calls `onDone`
 * when finished so the parent can drop it.
 */
export interface DiceRollAnimationProps {
  /** Token the die is tossed from (the roller's operating character). */
  token: Token
  /** Current stage scale; keeps the die a constant on-screen size. */
  scale: number
  /** Fired once when the animation completes. */
  onDone: () => void
}

/** Total animation length (ms). */
export const DICE_ANIM_MS = 1100
/** Die edge length in world px at scale = 1. */
const DIE = 30

export function DiceRollAnimation({ token, scale, onDone }: DiceRollAnimationProps) {
  const [phase, setPhase] = useState(0) // 0..1

  useEffect(() => {
    let raf = 0
    let start: number | null = null
    const step = (ts: number) => {
      if (start === null) start = ts
      const p = Math.min(1, (ts - start) / DICE_ANIM_MS)
      setPhase(p)
      if (p < 1) raf = requestAnimationFrame(step)
      else onDone()
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // `onDone` is captured once: the parent keys this component by roll
    // id and onDone only removes by that stable key, so re-subscribing is
    // unnecessary and would restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const size = DIE / scale
  // Toss: an upward arc (sin, peaks mid-flight) plus a small net upward
  // drift so the die ends slightly above where it started.
  const arc = (54 / scale) * Math.sin(phase * Math.PI)
  const drift = (24 / scale) * phase
  const cx = token.x
  const cy = token.y - arc - drift
  // Spin ~1.5 turns.
  const rotation = phase * 540
  // Fade in over the first 15%, hold, fade out over the last 30%.
  const opacity =
    phase < 0.15
      ? phase / 0.15
      : phase > 0.7
        ? Math.max(0, (1 - phase) / 0.3)
        : 1

  const stroke = 1 / scale
  // A "5" face: four corners + centre. Recognisable as a die at a glance.
  const pipR = size * 0.1
  const o = size * 0.26
  const pips = [
    [-o, -o],
    [o, -o],
    [0, 0],
    [-o, o],
    [o, o],
  ]

  return (
    <Group x={cx} y={cy} rotation={rotation} opacity={opacity} listening={false}>
      <Rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        cornerRadius={size * 0.22}
        fill="#f7f7f7"
        stroke="rgba(0, 0, 0, 0.4)"
        strokeWidth={stroke}
        shadowColor="rgba(0, 0, 0, 0.45)"
        shadowBlur={5 / scale}
        shadowOffsetY={2 / scale}
      />
      {pips.map(([px, py], i) => (
        <Circle key={i} x={px} y={py} radius={pipR} fill="#222" />
      ))}
    </Group>
  )
}
