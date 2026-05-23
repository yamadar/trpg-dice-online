# Tabletop Implementation Plan

[日本語版](TABLETOP_IMPLEMENTATION.ja.md)

> The user-facing spec lives in [`REQUIREMENTS.md` §3.15](REQUIREMENTS.md).
> This document focuses on the execution plan — PR breakdown, risks, and
> test strategy.

## 1. Scope

- **In scope**: square grid + PC tokens + GM-only tokens + a single
  background image + reload restore + room export / import.
- **Out of scope (Phase 2+)**: hex grid, ruler, ping, token size variants,
  facing, HP bar, fog of war, freehand draw, multiple maps, minimap,
  keyboard movement.

## 2. Architecture Changes

### New files

| File | Role |
|---|---|
| `src/tabletop/types.ts` | `TabletopState`, `Token`, `Grid` type definitions |
| `src/tabletop/grid.ts` | Pure helpers for grid math / snapping |
| `src/tabletop/imageChunk.ts` | Chunked split / reassembly of large images |
| `src/components/TablePanel.tsx` | The Konva-based tabletop screen (full-screen mode) |
| `src/components/TableFeedSheet.tsx` | The swipe-up bottom-sheet feed used in full-screen mode |
| `src/components/TableToolbar.tsx` | UI for grid config, map config and GM token management |
| `src/storage/tabletop.ts` | IndexedDB `sessionTable` store operations |

### Existing file changes

| File | Change |
|---|---|
| `src/net/protocol.ts` | New message types (`tableState` / `tokenMove` / `tokenUpsert` / `tokenRemove` / `mapMeta` / `mapChunk` / `gridChange`); `Snapshot` carries `tabletopState` |
| `src/hooks/useSession.ts` | Host-authoritative `tabletopState`, a `tableActions` API, welcome-snapshot extension |
| `src/storage/roomLog.ts` | `DB_VERSION` 6→7, new `sessionTable` store + migration |
| `src/storage/roomExport.ts` / `roomImport.ts` | Manifest v6 with `table.json` + `attachments/maps/*` (v5-and-older still imports) |
| `src/components/Dock.tsx` | New tabletop icon and `SheetId` |
| `src/App.tsx` | Tabletop opens as a full-screen mode rather than a Dock sheet; new `showTable` state |
| `src/i18n/translations/*.ts` (19 locales) | New `tabletop.*` keys (parity test enforces it) |
| `package.json` | Add `react-konva`, `konva` dependencies |

### Data flow

**Token sync (host-authoritative / last-write-wins)**:
1. A client drags → renders locally + sends `tokenMove` at ~20 Hz
2. The host receives → updates `tabletopState.tokens` → broadcasts
   `tokenMove` to everyone
3. Each client treats the host-broadcast position as the source of truth
4. A drag conflict on the same token is resolved last-write-wins by
   the host

**Background image chunked transfer**:
1. The GM uploads → the host downscales to long-edge 3000 px and re-encodes
   as PNG / JPEG
2. ≤3 MB → one `mapMeta` message. >3 MB → `mapChunk(seq, total, bytes)`
   split
3. Receivers show a loading state until all chunks arrive, then build the
   data URL
4. The host and each receiver persist to IndexedDB `sessionTable.background`

## 3. PR Breakdown

Each PR follows **implement → unit-test → self-review → comments →
commit → push → open PR → Copilot review → merge** (per `CLAUDE.md`).
Branches named `feature/tabletop-{step}`; PRs target `main`.

### PR 1: Types, protocol, pure utilities

**Goal**: Lay down the types and pure helpers. No UI yet.

- `src/tabletop/types.ts`
- `src/tabletop/grid.ts` — `snapToGrid`, `worldToCell`, etc.
- `src/tabletop/imageChunk.ts` — `chunkBytes`, `reassembleChunks`
- `src/net/protocol.ts` — new message types; `Snapshot` carries `tabletopState`
- Vitest unit tests (snap math, chunk round-trip, type guards)

**Acceptance**: `npm run build`, `npm test`, `npm run lint` all green.

### PR 2: IndexedDB v7 + storage layer

**Goal**: Persistence groundwork.

- `src/storage/roomLog.ts` — bump `DB_VERSION` to 7, add `sessionTable` store
- `src/storage/tabletop.ts` — `saveTabletop`, `loadTabletop`,
  `deleteTabletopForSession`
- Have `deleteSession` / `deleteAllSessions` clear `sessionTable` too
- Unit tests (fake-indexeddb)

**Acceptance**: Existing persistence tests still green + new store saves /
loads correctly.

### PR 3: TablePanel + Konva groundwork (no tokens yet)

**Goal**: Stage, grid drawing, pan / zoom scaffold.

- Add `react-konva`, `konva` dependencies
- `useSession` — host-authoritative `tabletopState`, message handling,
  welcome snapshot inclusion, broadcast on change. Tokens stay empty.
- `src/components/TablePanel.tsx` — Konva Stage + a grid layer (square only)
- Pan: two-finger touch, mouse right-drag, Space + drag
- Zoom: pinch / mouse wheel (25%–400%)
- `src/components/TableToolbar.tsx` — grid config UI
- `src/components/Dock.tsx` — tabletop icon (Lucide `Grid2X2` is the
  current candidate)
- `src/App.tsx` — full-screen mode toggle state
- i18n: `tabletop.title` / `tabletop.grid.*` for ja + en only (the other
  17 locales land in PR 7)

**Acceptance**: A GM can open the tabletop, tweak the grid, and pan / zoom.

### PR 4: PC tokens

**Goal**: Generate PC tokens from session characters, drag, sync.

- `useSession` — token CRUD reducer + a ~20 Hz throttled drag broadcaster
- `TablePanel` — token layer (circular avatar with portrait), drag handling
- PC token auto-add when a character enters the session (placed at the
  first empty slot)
- Permission: PC tokens can be moved only by the owner and the GM
- Disallow mixing pinch and drag inside a single gesture (branch on
  pointer count)
- Unit tests: throttle, permission, snapping
- Integration tests: two-tab last-write-wins

**Acceptance**: Two tabs can drag PC tokens around each other; drag-time
motion is smooth and the released position agrees on both sides.

### PR 5: Background map upload + chunked transfer

**Goal**: Background image placement and large-image handling.

- `TableToolbar` — "Set map" button + drop area (GM-only)
- New `src/tabletop/imageBackground.ts` (long-edge 3000 px, PNG / JPEG,
  up to 8 MB input)
- Chunked send for >3 MB: `mapMeta` announces total bytes / chunk count,
  `mapChunk(seq, bytes)` ships them in order, completion is detected
- Receiver: loading state until complete, then persist to IndexedDB and draw
- Origin offset UI to align the rendered grid with a grid baked into the
  image
- Unit tests: chunk round-trip

**Acceptance**: A 3000 × 2000 px / 5 MB PNG reaches every participant.
The "no background" mode still works.

### PR 6: GM-only tokens

**Goal**: Standalone NPC / monster tokens.

- `TableToolbar` — "Add GM token" button → upload dialog (reuses
  `prepareCharacterImage`, long-edge 2560 px / ~2 MB)
- Optional label
- Place / move / delete, GM-only; delete confirmation via the existing
  `useConfirm()` hook
- Permission: non-GMs do not see the UI and ignore the messages

**Acceptance**: Only the GM can add / move / remove GM tokens; non-GM
tabs do not show the add UI.

### PR 7: Mobile UX, export, i18n, polish

**Goal**: Finishing pass.

- Full-screen mode polish: hide header / Dock on mobile, honour safe-area,
  dedicated close button
- `TableFeedSheet` — swipe-up height-adjustable feed (grip handle,
  min = header only, max = half height; body reuses the existing FeedList)
- Brief toast for the user's own latest entry so it is noticeable even
  when the sheet is at minimum
- Same full-screen mode on desktop
- `roomExport.ts` / `roomImport.ts` — manifest v6, `table.json`,
  `attachments/maps/*`; v5-and-older archives import with an empty table
- i18n: `tabletop.*` filled in for all 19 locales
  (`translations.test.ts` parity enforces it)
- Tutorial step introducing the tabletop
- Many-token re-render tuning (`<Layer>` separation, `batchDraw`)
- Bug bash

**Acceptance**: Every tabletop-related acceptance criterion in
REQUIREMENTS §8 is checked.

## 4. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Drag spam saturates the WebRTC data channel | 20 Hz throttle; consider an unreliable channel mode if needed |
| Konva re-render cost with many tokens | Split into background / grid / token `<Layer>`s; `batchDraw` only the token layer on token updates |
| IndexedDB migration failure | v6→v7 is just an empty new store inside `onupgradeneeded`; existing rows untouched |
| Background-image chunk loss | Receiver re-requests `tableState` if no chunk arrives for >5 s |
| Mobile Safari gesture interference | `touch-action: none` on the Stage container; `Konva.hitOnDragEnabled = true` |
| Race on GM token deletion | Idempotent ops keyed by tokenId; "unknown id" is a no-op |
| Old export archives | Branch on `fileVersion`; v5-and-older imports with an empty table |
| Vitest cannot drive Konva | Keep Canvas-touching logic out of `src/tabletop/*` — all those helpers are pure and unit-tested; Konva integration is covered by manual integration tests |

## 5. Test Strategy

### Unit tests (Vitest)

- Grid snapping / coordinate transforms (`tabletop/grid.ts`)
- Chunk split / reassemble round-trip (`tabletop/imageChunk.ts`)
- Permission checks (who can move which token)
- Throttle function (fake timers)
- Storage layer (fake-indexeddb)
- Message type guards

Per `CLAUDE.md`, the project's Vitest setup is `environment: 'node'` so
Canvas-bound code is intentionally kept out of the unit-test path —
extract pure functions, then cover Konva integration manually.

### Integration tests (manual, two tabs)

- Two tabs dragging the same PC token → last-write-wins
- GM-tab adds / moves / deletes GM tokens → non-GM tab sees correct state
- A 3000 × 2000 px / 5 MB PNG reaches both tabs with a loading state in
  between
- Reload restore (GM re-hosts, players re-join)
- Export a ZIP, import it in a different browser → state restored
- Mobile (real device or Chrome DevTools responsive mode): pinch / drag /
  feed sheet behaviour

### Post-deploy verification (`CLAUDE.md` default)

- Wait for the post-merge GitHub Actions deploy
- Walk the golden path on the public URL

## 6. Phase 2+ Candidates

Ordered by priority:

1. Hex grid (pointy / flat — adopt honeycomb-grid)
2. Ruler (cell-distance measurement)
3. Multiple maps per session (scene switching)
4. Ping (transient "look here" marker)
5. Token size variants (1×1, 2×2, 4×4 …)
6. Token facing
7. HP bar / status icons
8. Freehand draw
9. Fog of war
10. Minimap
11. Full keyboard support

## 7. Revisions

- v0.1 — Initial draft (PR breakdown, risks, test strategy)
