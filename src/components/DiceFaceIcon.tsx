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

const TRIANGLE = regularPolygon(3, -Math.PI / 2) // D4 face
const PENTAGON = regularPolygon(5, -Math.PI / 2) // D12 face
const HEXAGON = regularPolygon(6, -Math.PI / 2) // D20 top-down silhouette

// D10 — a vertical rhombus matching the top-down silhouette of a
// pentagonal trapezohedron (its actual face is a kite).
const RHOMBUS = [
  `${CX},${(CY - R * 0.98).toFixed(2)}`,
  `${(CX + R * 0.92).toFixed(2)},${CY}`,
  `${CX},${(CY + R * 0.98).toFixed(2)}`,
  `${(CX - R * 0.92).toFixed(2)},${CY}`,
].join(' ')

/** Font size that keeps the number comfortably inside each shape. */
function digitFontSize(value: number, diceType: DiceType): number {
  // D4's narrow point-up triangle can only hold a smaller glyph without
  // grazing its base.
  if (diceType === 'D4') return 10
  const n = String(value).length
  const base = n >= 3 ? 8 : n === 2 ? 10 : 12
  // D8 and D20 show the value prominently in the centre — their face
  // decomposition is too cluttered at icon size. D20 has slightly less
  // headroom inside its hexagon, so the boost is smaller than D8's.
  if (diceType === 'D8') return base + 3
  if (diceType === 'D20') return base + 2
  return base
}

/**
 * A face of one die, as viewed from the rolled side. Each die's icon
 * traces its top-down silhouette and shows the rolled value in the
 * centre:
 *   - d4: triangle (the face itself).
 *   - d6: square.
 *   - d8: square with the four faces' diagonals (the top-vertex view of
 *     an octahedron) — the value is the central, prominent label.
 *   - d10: vertical rhombus.
 *   - d12: regular pentagon (the face shape).
 *   - d20: regular hexagon — the icosahedron from a vertex is a hexagon;
 *     drawing every face line gets cluttered at icon size, so only the
 *     outline is kept.
 *   - d100: a circle (the percentile die's real shape reads poorly at
 *     this size, so a plain disc holds the two-digit value).
 */
export function DiceFaceIcon({ diceType, value }: Props) {
  const fs = digitFontSize(value, diceType)
  // D4's point-up triangle reads better with the number nudged just above
  // centre, so it never touches the base.
  const textY = diceType === 'D4' ? CY - 1 : CY
  const isCircle = diceType === 'D100'

  return (
    <svg
      className="dice-face"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      // Decorative: the surrounding feed line already announces the values
      // in the player's language, so each icon stays out of the AT tree.
      aria-hidden="true"
    >
      {diceType === 'D4' && (
        <polygon points={TRIANGLE} fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
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
      {diceType === 'D8' && (
        <>
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
          {/* Each face's edge runs from a corner to the top vertex (the
              icon's centre). They are drawn as short rays so the centre
              stays clear for the prominent value. */}
          {(
            [
              [CX - R, CY - R],
              [CX + R, CY - R],
              [CX + R, CY + R],
              [CX - R, CY + R],
            ] as const
          ).map(([x, y], i) => (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x + (CX - x) * 0.55}
              y2={y + (CY - y) * 0.55}
              stroke="currentColor"
              strokeWidth="0.9"
            />
          ))}
        </>
      )}
      {diceType === 'D10' && (
        <polygon points={RHOMBUS} fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
      {diceType === 'D12' && (
        <polygon points={PENTAGON} fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
      {diceType === 'D20' && (
        <polygon points={HEXAGON} fill="none" stroke="currentColor" strokeWidth="1.4" />
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
