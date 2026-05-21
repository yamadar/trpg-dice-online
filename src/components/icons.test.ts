import { describe, expect, it } from 'vitest'
// Vite's `?raw` suffix loads the file as a string at module-load time —
// no Node `fs` needed, so the test stays in the same compilation unit
// as the rest of the app (no per-test tsconfig tweak).
import assetSvg from '../assets/icons/perspective-dice-six-faces-one.svg?raw'
import iconsSrc from './icons.tsx?raw'

/**
 * `DiceIcon` inlines the SVG path data so the icon ships as a regular
 * React component (no `dangerouslySetInnerHTML`, no extra fetch). The
 * same path data lives in `src/assets/icons/perspective-dice-six-faces-one.svg`,
 * the canonical attributed source file (see `docs/CREDITS.md`).
 *
 * This test pins the two copies together so they cannot drift — if the
 * upstream icon ever changes, both files must be updated in the same
 * commit or this test fails.
 */
describe('DiceIcon ↔ asset', () => {
  it("matches the attributed SVG asset's path data", () => {
    // The asset's <path d="..."> — there is only one path in this SVG.
    const assetMatch = assetSvg.match(/<path[^>]*\bd="([^"]+)"/)
    expect(assetMatch, 'asset SVG must contain a <path d="...">').not.toBeNull()

    // The inline path data inside the `DiceIcon` component. The
    // component emits a multi-line JSX `<path>` with
    // `fill="currentColor"`, so the `d` attribute may sit on a separate
    // line — the `s` flag lets `.` match newlines.
    const componentMatch = iconsSrc.match(
      /<path[^>]*\bfill="currentColor"[^>]*\bd="([^"]+)"/s,
    )
    expect(
      componentMatch,
      "icons.tsx must contain DiceIcon's <path fill='currentColor' d='...'>",
    ).not.toBeNull()

    expect(componentMatch![1]).toBe(assetMatch![1])
  })
})
