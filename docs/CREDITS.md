# Third-party assets & credits

This page lists third-party assets bundled with the app and the
licenses under which they are redistributed.

## Icons

### Lucide

UI chrome glyphs (close, trash, the feed-filter "all" / chat / files
chips) come from [Lucide](https://lucide.dev) via the `lucide-react`
package.

- License: [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE)

### Game Icons — `perspective-dice-six-faces-one`

The 6-sided die silhouette used for every dice affordance in the UI —
the feed "Rolls" filter, the Dock's dice button and the tutorial's dice
step — is from
[game-icons.net](https://game-icons.net/1x1/delapouite/perspective-dice-six-faces-one.html).
A simple d6 is preferred over a more detailed d20 because it keeps its
shape at the small sizes the chrome uses (16–22 px), where the d20
silhouette would turn into noise.

- Author: **Delapouite** (https://delapouite.com)
- License: **CC BY 3.0** — https://creativecommons.org/licenses/by/3.0/
- Modification: the original `fill="#000"` is changed to
  `currentColor` so the glyph inherits the surrounding text color.
- File: [`src/assets/icons/perspective-dice-six-faces-one.svg`](../src/assets/icons/perspective-dice-six-faces-one.svg)
  carries the same attribution in its SVG comment header. The same
  path data is inlined in [`src/components/icons.tsx`](../src/components/icons.tsx)
  as the `DiceIcon` component.

## External map gallery

### trpg-map-organizer

The tabletop's "Gallery" tab fetches and displays maps from the
sibling project [trpg-map-organizer](https://yamadar.github.io/trpg-map-organizer/),
maintained by the same author. Hand-curated tag taxonomies (theme /
terrain / mood / location) and per-map metadata are served from that
project's `data/maps.json`; thumbnails, mid-resolution previews and
originals come from the same site.

- Source: https://github.com/yamadar/trpg-map-organizer
- The gallery is only loaded on demand when the user opens the
  picker; nothing in `dist/` ships those images.
