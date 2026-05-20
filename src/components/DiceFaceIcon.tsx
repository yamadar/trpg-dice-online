import type { DiceType } from '../dice/types'

interface Props {
  diceType: DiceType
  /** Face value to inscribe inside the shape. */
  value: number
}

// The icon draws inside a 24×24 viewBox; CSS sizes the rendered svg in em
// so it scales with the surrounding text.
const SIZE = 24
const CX = SIZE / 2
const CY = SIZE / 2
const R = SIZE * 0.46

/** Regular n-gon vertices, "points" string for `<polygon>`. */
function regularPolygon(n: number, startAngle: number): string {
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = startAngle + (2 * Math.PI * i) / n
    pts.push(`${(CX + R * Math.cos(a)).toFixed(2)},${(CY + R * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

const TRIANGLE = regularPolygon(3, -Math.PI / 2)
const PENTAGON = regularPolygon(5, -Math.PI / 2)

// Stylised d10 kite — vertical axis longer than horizontal, slightly
// sharper top to read as a d10 face rather than a plain diamond.
const KITE = [
  `${CX},${(CY - R * 0.98).toFixed(2)}`,
  `${(CX + R * 0.82).toFixed(2)},${CY}`,
  `${CX},${(CY + R * 0.98).toFixed(2)}`,
  `${(CX - R * 0.82).toFixed(2)},${CY}`,
].join(' ')

/** Font size that keeps the number comfortably inside the shape. */
function digitFontSize(value: number): number {
  const n = String(value).length
  if (n >= 3) return 8
  if (n === 2) return 10
  return 12
}

/**
 * A face of one die, as viewed from the rolled side: the polygon matches
 * the physical face shape (triangle for d4/d8/d20, square for d6, kite
 * for d10, pentagon for d12), with the rolled number inscribed. D100 is
 * shown as a circle with the percentile value, since its true shape (a
 * pentagonal trapezohedron face) is hard to read at small sizes.
 */
export function DiceFaceIcon({ diceType, value }: Props) {
  const fs = digitFontSize(value)
  // A "point-up" triangle reads better with the number nudged toward the
  // wider base, where there is more room.
  const isTriangle = diceType === 'D4' || diceType === 'D8' || diceType === 'D20'
  const textY = isTriangle ? CY + 2 : CY
  const isCircle = diceType === 'D100'

  return (
    <svg
      className="dice-face"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`${diceType}: ${value}`}
    >
      {diceType === 'D6' && (
        <rect
          x={CX - R}
          y={CY - R}
          width={R * 2}
          height={R * 2}
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      )}
      {isTriangle && (
        <polygon points={TRIANGLE} fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
      {diceType === 'D10' && (
        <polygon points={KITE} fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
      {diceType === 'D12' && (
        <polygon points={PENTAGON} fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
      {isCircle && (
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
      <text
        x={CX}
        y={textY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={isCircle ? fs + 1 : fs}
        fontWeight="700"
        fill="currentColor"
      >
        {value}
      </text>
    </svg>
  )
}
