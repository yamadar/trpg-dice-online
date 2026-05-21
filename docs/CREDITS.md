# Third-party assets & credits

This page lists third-party assets bundled with the app and the
licenses under which they are redistributed.

## Icons

### Lucide

UI chrome glyphs (close, trash, the feed-filter "all" / chat / files
chips) come from [Lucide](https://lucide.dev) via the `lucide-react`
package.

- License: [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE)

### Game Icons — `dice-twenty-faces-twenty`

The d20 silhouette used for the "rolls" feed filter is from
[game-icons.net](https://game-icons.net/1x1/delapouite/dice-twenty-faces-twenty.html).

- Author: **Delapouite** (https://delapouite.com)
- License: **CC BY 3.0** — https://creativecommons.org/licenses/by/3.0/
- Modification: the original `fill="#000"` is changed to
  `currentColor` so the glyph inherits the surrounding text color.
- File: [`src/assets/icons/dice-twenty-faces-twenty.svg`](../src/assets/icons/dice-twenty-faces-twenty.svg)
  carries the same attribution in its SVG comment header. The same
  path data is inlined in [`src/components/icons.tsx`](../src/components/icons.tsx)
  as the `D20Icon` component.
