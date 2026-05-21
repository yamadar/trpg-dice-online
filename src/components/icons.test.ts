import { describe, expect, it } from 'vitest'
// Vite's `?raw` suffix loads the file as a string at module-load time —
// no Node `fs` needed, so the test stays in the same compilation unit
// as the rest of the app (no per-test tsconfig tweak).
import assetSvg from '../assets/icons/perspective-dice-six-faces-one.svg?raw'
import iconsSrc from './icons.tsx?raw'

/** Return the value of `attr="..."` on a tag-shaped substring, or null. */
function readAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}="([^"]+)"`)
  const m = tag.match(re)
  return m ? m[1] : null
}

/**
 * `DiceIcon` inlines the SVG path data so the icon ships as a regular
 * React component (no `dangerouslySetInnerHTML`, no extra fetch). The
 * same path data lives in `src/assets/icons/perspective-dice-six-faces-one.svg`,
 * the canonical attributed source file (see `docs/CREDITS.md`).
 *
 * This test pins the two copies together so they cannot drift — if the
 * upstream icon ever changes, both files must be updated in the same
 * commit or this test fails.
 *
 * Attribute order is not assumed: each `<path>` snippet is sliced
 * separately, then `d=` / `fill=` are read independently, so a future
 * reformat (or JSX attribute reorder) does not falsely fail CI.
 */
describe('DiceIcon ↔ asset', () => {
  it("matches the attributed SVG asset's path data", () => {
    // The asset's `<path d="...">` — there is only one path in this SVG.
    const assetPathTag = assetSvg.match(/<path\b[^>]*?\/?>/s)?.[0]
    const assetPath = assetPathTag && readAttr(assetPathTag, 'd')
    expect(assetPath, 'asset SVG must contain a <path d="...">').toBeTruthy()

    // The component file contains the `BrandIcon`'s `<path>` (with a
    // gradient stroke) as well as `DiceIcon`'s. Pick the one whose `fill`
    // is `currentColor` — that is DiceIcon's signature attribute.
    const componentPathTags = iconsSrc.match(/<path\b[^>]*?\/?>/gs) ?? []
    const dicePathTag = componentPathTags.find((tag) => readAttr(tag, 'fill') === 'currentColor')
    expect(dicePathTag, "icons.tsx must contain DiceIcon's <path fill='currentColor' ...>").toBeTruthy()
    const componentPath = dicePathTag && readAttr(dicePathTag, 'd')
    expect(componentPath, "DiceIcon's <path> must carry a `d` attribute").toBeTruthy()

    expect(componentPath).toBe(assetPath)
  })
})
