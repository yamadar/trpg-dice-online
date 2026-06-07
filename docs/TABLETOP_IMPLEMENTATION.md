# Tabletop Implementation

[日本語版](TABLETOP_IMPLEMENTATION.ja.md)

> The user-facing spec lives in [`REQUIREMENTS.md` §3.15](REQUIREMENTS.md).
> This document is the **as-built** companion: the module map, the wire
> protocol, the host-authoritative data flows, persistence, the Konva
> render tree, the delivery history and the test inventory.
>
> The feature shipped incrementally across PRs #134–#190 (and counting).
> This doc was originally a forward-looking 7-PR plan; it has been
> rewritten to describe what actually landed, which grew well past the
> original scope (hex grids, fog of war, freehand draw / text labels,
> a map gallery picker, an NPC library and a GM tabletop library all
> started life as "Phase 2+").

## 1. Scope

### Delivered

- **Grid**: `none` / `square` / flat-top **hex** (odd-q offset). Cell
  size, origin offset, stroke color, stroke opacity and a snap toggle.
- **Background map**: one per scene. Sourced from a local **file**, a
  **URL**, the in-app **gallery** picker
  ([trpg-map-organizer](https://yamadar.github.io/trpg-map-organizer/),
  ~303 maps), or a bundled **preset** (`public/maps/`). All four routes
  share one downscale + chunked-broadcast pipeline. "No background"
  (grid only) is valid.
- **Tokens**: PC tokens (bound to a session character, reuse the
  portrait) and GM-only tokens (NPC / monster / prop). Place, drag,
  resize (sizes `0.6 / 1 / 2 / 3 / 4`), remove, relabel. A character may
  hold multiple tokens. Per-token **public note** (anyone) plus a
  GM-only **private note** (never broadcast).
- **NPC library**: a GM-curated stash of named NPC definitions
  (name + image + note) that can be placed repeatedly; placing copies the
  image/label/note inline so later edits don't mutate placed tokens.
- **Tabletop library**: named **templates** (PC tokens stripped,
  `pcSpawn` stashed) and full **snapshots**, stored globally (not
  per-session) so a GM can prepare scenes ahead and load them into any
  room.
- **Annotation layers**: free-text **labels**, free-hand **pen strokes**,
  and grid-cell **fog of war** (GM-painted; opaque to players).
- **Realtime**: host-authoritative / last-write-wins, ~20 Hz throttled
  drag, welcome-snapshot seeding for late joiners, IndexedDB reload
  restore, room export / import.
- **Ping**: any participant can drop a transient "look here" marker — a
  ripple in their player colour with their name beneath — that
  broadcasts to everyone and fades after ~2.6 s. Ephemeral by design: it
  is never persisted, snapshotted or exported, so a late joiner simply
  does not see pings that fired before they arrived.
- **Presentation**: full-screen mode (mobile + desktop) with a bottom
  dock, chat / dice as swap-in overlays, an unread-chat dot, a canvas
  **dice-roll animation** launching from the roller's token, chat
  **speech bubbles** over the speaker's token, a first-run tutorial and
  a render-crash **error boundary**.

### Out of scope (Phase 2+)

Ruler / cell-distance measurement, token facing, HP bars / status
icons, multiple maps per session (scene list), minimap, full keyboard
movement. See §9.

## 2. Module map

### `src/tabletop/` — pure logic (unit-tested, no React / Konva / DOM)

| File | Role |
|---|---|
| `types.ts` | `TabletopState`, `Token` (`PcToken` / `GmToken`), `Grid`, `MapBackground`, `NpcDef`, `MapText`, `DrawStroke`, `FogState`, `SavedTabletop`; size/limit constants; id minters; `cellFromWorld` (dispatches square/hex) |
| `grid.ts` | Square-grid snapping & coordinate transforms; size-aware snap (even sizes → cell corner, odd/sub-cell → centre); non-drifting `snapResizeToGrid`; dispatches to `hexGrid.ts` when `kind === 'hex'` |
| `hexGrid.ts` | Flat-top hex math (odd-q offset): centre / polygon / pixel→cell / viewport iteration; redblobgames pipeline |
| `tokens.ts` | PC-token lifecycle & permissions: `planPcTokenAdds`, `makeGmToken`, `canMoveToken`, `applyTokenMove/Upsert/Remove`, `defaultPlacementOrigin` (map centre → grid origin → `pcSpawn`), grid-wrapping `placementPosition` (4 cols), `recenterTokensOnMap`, `snapAllTokensToGrid` |
| `annotations.ts` | Text / stroke / fog apply + permission helpers (`canEditMapText`, `canEraseStroke`), `setFogCells`, `isCellRevealed`, and `nearestRevealedCellCenter` (the "dropped a token into fog" rescue) |
| `hostValidation.ts` | Pure host-side validators for inbound annotation requests; re-stamps `ownerPlayerId` from the trusted connection so a client can't spoof ownership |
| `snapshot.ts` | Wire helpers: `tokenForWire` / `stripMapBytesForWire` (strip `privateNote` and the map `dataUrl` before broadcast) and `fillTabletopDefaults` (back-fill annotation fields from a pre-PR-12 host) |
| `imageChunk.ts` | `chunkString` + `ChunkBuffer`: split a data URL into 256 KB chunks and reassemble out-of-order, with progress and a length check |
| `imageBackground.ts` | Map downscale (long-edge 3000 px, PNG kept unless >6 MB → JPEG q0.85, input ≤8 MB); `readMapBackground`, `fetchMapBlob` / `readMapBackgroundFromUrl`, `parseHttpUrl`; structured error tags (`invalidUrl` / `fetchFailed` / `notImage` / `tooLarge` / `unreadable`) |
| `mapGallery.ts` | trpg-map-organizer I/O: manifest + tag-dict parsing, `originalUrl` (WebP) / `thumbUrl`, `filterMaps` (4 taxonomies, AND/OR), `searchMaps`, `tagLabel` (locale-aware) |
| `presetMaps.ts` | Bundled-preset loader (`public/maps/manifest.json`), reuses `readMapBackground` |

### `src/storage/` — persistence

| File | Role |
|---|---|
| `tabletop.ts` | Per-session `sessionTable` store (DB v7+): `saveTabletop` / `loadTabletop` / `deleteTabletopForSession` + `sanitizeStoredTabletop` (coerces arbitrary stored data into a valid state) |
| `tabletopLibrary.ts` | Global `tabletopLibrary` store (DB v8+): `saveLibraryEntry` / `listLibrary` / `getLibraryEntry` / `deleteLibraryEntry` |
| `tabletopTutorial.ts` | localStorage flag `trpg-dice.tabletopTutorialSeen` (separate from the main tutorial) |

### `src/components/` — UI

| File | Role |
|---|---|
| `TablePanel.tsx` | The full-screen Konva renderer: Stage + layers, pan/zoom, token drag, draw/text/fog gestures, the token popover, dice animation & speech bubbles, chat/dice overlays. ~2,000 lines. |
| `TableToolbar.tsx` | Right-edge icon-category panel: **Map & Grid** (grid config + four-tab map source), **Fog**, **Tokens** (Tokens-on-Map + Add/Setup), **Library**. |
| `TableTools.tsx` | Left-edge floating tool palette: `select` / `text` / `pen` / `eraser` / `fog-reveal` / `fog-conceal` + color / pen-width / text-size popovers. |
| `MapGalleryDialog.tsx` | The gallery picker: tag chips (4 taxonomies, AND/OR), search, thumbnail grid, and a `Lightbox` preview with prev/next + swipe synced to the selection. |
| `TabletopDock.tsx` | Bottom dock for full-screen mode: `chat` / `character` / `dice` / `returnToRoom` (+ the unread-chat dot). |
| `TabletopTutorial.tsx` | 7-step first-run walkthrough (reuses the app tutorial chrome). |
| `DiceRollAnimation.tsx` | The single-die "tumble upward" animation drawn on the canvas. |

`Lightbox.tsx` is reused (not tabletop-specific). The shared image picker
(`ImagePickerDialog`) integrates the
[trpg-chara-image-organizer](https://yamadar.github.io/trpg-chara-image-organizer/)
galleries for NPC / character token art.

### Existing files changed

| File | Change |
|---|---|
| `src/net/protocol.ts` | The tabletop message set (see §3.3); `Snapshot.tabletop?`; `MapMeta` |
| `src/hooks/useSession.ts` | Host-authoritative `tabletop` state + the full action surface (§3.2), client-request validation, chunked map transfer, fog-drop rescue, IndexedDB persistence, library load/save |
| `src/storage/roomLog.ts` | `DB_VERSION` → **8**; v7 adds `sessionTable`, v8 adds `tabletopLibrary` (with a `byUpdatedAt` index); `deleteSession` / `deleteAllSessions` also clear `sessionTable` |
| `src/storage/roomExport.ts` / `roomImport.ts` | Manifest **v6**: `table.json` + `attachments/maps/*`; older archives import with an empty table |
| `src/components/Dock.tsx` | `tabletop` `DockId` + `TabletopIcon` (trailing slot); opens the full-screen mode |
| `src/App.tsx` | `tabletopOpen` full-screen mode, mount/unmount of `TablePanel` inside an error boundary, chat/dice overlay wiring, unread-chat tracking |
| `src/i18n/translations/*.ts` (19 locales) | `tabletop.*` keys (parity test enforces all 19) |
| `package.json` | `konva` `^10.3.0`, `react-konva` `^19.2.4` |

## 3. State, sync and persistence

### 3.1 Model

`TabletopState = { map?, grid, tokens[], npcLibrary[], pcSpawn?, texts[], strokes[], fog }`.
The GM (P2P host) holds the canonical state; every client mirrors it from
the welcome snapshot plus delta messages. Token positions are **pixel**
coordinates of the token centre and are snapped to the grid at render
time, so a future grid change never needs a wire-format migration.

### 3.2 `useSession` action surface

`useSession` exposes the live `tabletop` / `tabletopLibrary` state and a
flat set of actions (not a nested object). Grouped:

- **Grid / map**: `updateGrid`, `setMapBackground(file)`,
  `setMapBackgroundFromUrl(input)`, `setMapFromPreset(preset)`,
  `clearMapBackground`.
- **Tokens**: `placeMyCharacterToken`, `addPlayerToken`, `addGmToken`,
  `moveTokenLive` / `moveTokenCommit`, `setTokenSize`, `removeToken`,
  `updateGmToken`, `updateTokenNote`, `updateTokenPrivateNote`,
  `reorderToken`, `syncOwnTokenSnapshots`.
- **NPC library**: `addNpcDef`, `updateNpcDef`, `removeNpcDef`,
  `reorderNpcDef`, `placeNpcFromLibrary`.
- **Tabletop library**: `saveTabletopAs(name, kind)`,
  `loadTabletopFromLibrary(id)`, `deleteTabletopFromLibrary(id)`.
- **Annotations**: `addMapText` / `updateMapText` / `removeMapText`,
  `addDrawStroke` / `removeDrawStroke`, `setFogEnabled`, `paintFog`,
  `commitFog`, `setFog`.

Map-load actions resolve to `'ok'` or a `MapImageError` so the toolbar
can show a specific message. The host applies every state change through
one `applyTabletop(next)` helper that updates the ref, sets state and
fire-and-forgets `saveTabletop`.

### 3.3 Wire protocol (`net/protocol.ts`)

**Client → host** (each validated host-side before it takes effect):
`tokenMove`, `pcTokenPlaceRequest`, `tokenSizeRequest`,
`tokenRemoveRequest`, `tokenNoteRequest`, `mapTextAddRequest`,
`mapTextUpdateRequest`, `mapTextRemoveRequest`, `drawStrokeAddRequest`,
`drawStrokeRemoveRequest`, `pingRequest`.

**Host → clients** (authoritative): `tokenMove`, `tokenUpsert`,
`tokenRemove`, `gridChange`, `mapMeta`, `mapChunk`, `mapCleared`,
`npcDefUpsert`, `npcDefRemove`, `tabletopState` (wholesale replace, used
by library load), `mapTextUpsert`, `mapTextRemove`, `drawStrokeAdd`,
`drawStrokeRemove`, `fogSet`, `ping`. The welcome `Snapshot` carries an
optional `tabletop` (map `dataUrl` stripped — see §3.5).

The `ping` pair is the lone *ephemeral* message: a client `pingRequest`
(world point) is host-validated (sender known, coordinates finite),
re-stamped with the sender's id and broadcast as `ping`. It never
touches `TabletopState`, so it is absent from snapshots, IndexedDB and
the export archive — the marker lives only in `useSession`'s transient
`lastPing` and the renderer's short-lived animation. The pure
animation / validation math lives in `tabletop/ping.ts`.

### 3.4 Token sync (host-authoritative / last-write-wins)

1. A client drags → renders optimistically, sends `tokenMove` at ~20 Hz.
2. The host validates `canMoveToken` (PC: owner or host; GM token: host),
   updates `tokens`, broadcasts `tokenMove`.
3. Clients treat the host echo as the source of truth; same-token drag
   conflicts resolve last-write-wins.
4. On drag-end, if a non-GM dropped their own token onto a fogged
   (invisible-to-them) cell, the commit redirects to
   `nearestRevealedCellCenter` so the token can't get lost under fog.

Resize (`tokenSizeRequest`) and remove (`tokenRemoveRequest`) follow the
same validate-then-broadcast path. `tokenNoteRequest` (public note) is
intentionally writable by **any** participant — the host only checks the
sender is known, then broadcasts the token **without** its `privateNote`.

### 3.5 Background map transfer

`file` / `URL` / `gallery` / `preset` all converge on `readMapBackground`
→ a downscaled data URL. The host then:

1. broadcasts `mapMeta` (id, name, dimensions, `ChunkSpec`);
2. ships the data URL as ordered `mapChunk`s of 256 KB (`chunkString`);
   a small map is a single chunk;
3. receivers assemble via `ChunkBuffer` (out-of-order tolerant, length-
   checked), show a loading state until complete, then persist + draw.

The map's `dataUrl` is **stripped** from the welcome snapshot and from
`tabletopState` (`stripMapBytesForWire`) so a multi-megabyte image never
rides inline on a control frame — the chunked transfer follows
separately. `clearMapBackground` → `mapCleared`.

### 3.6 `privateNote` confidentiality

Every outgoing path (`tokenUpsert`, the snapshot's tokens,
`tabletopState`) runs tokens through `tokenForWire`, which removes the
GM-only `privateNote`. Non-host clients therefore never receive it. This
is the one field that is host-only by design.

### 3.7 Persistence

- **Per session**: `saveTabletop(sessionId, state)` upserts into
  `sessionTable` on every change; `loadTabletop` restores it on reload /
  resume through `sanitizeStoredTabletop`, which coerces any stored shape
  (including pre-PR-10/11/12 records) into a complete, valid state.
- **Global library**: `tabletopLibrary` (DB v8) holds `SavedTabletop`
  templates + snapshots, ordered by `updatedAt`.
- **Export / import**: room ZIPs are manifest **v6** — the tabletop goes
  into `table.json` with the map image split out to
  `attachments/maps/{id}.{ext}` (like chat attachments). v5-and-older
  archives import with an empty table.

> **Known gap**: `sanitizeStoredTabletop` (the reload path) does not
> currently round-trip a token's `size`, `note` or `privateNote` — those
> survive live sync but are dropped when the host reloads from
> IndexedDB. (Tracked separately from this doc.)

## 4. Rendering & UI

### 4.1 Konva layers (`TablePanel`)

One `<Stage>` whose `scale` / `position` drives pan & zoom; layers in
z-order (bottom → top):

1. **Background** — the map image at world origin (non-interactive).
2. **Grid** — square scan-lines or per-hex polygons, culled to the
   viewport, stroke `1 / scale` so it stays ~1 device px at any zoom.
3. **Strokes** — pen lines (+ a live preview of the in-progress stroke);
   listens only in eraser mode.
4. **Tokens** — circular portrait (clipped, "cover" fit) or color disc
   with an initial glyph; size-scaled radius; a label below; `draggable`
   only when the tool is `select` and `canMoveToken` is true; tokens the
   viewer can't move render at 0.8 opacity.
5. **Focus pulse** — a one-shot expanding ring when a token is clicked in
   the Tokens-on-Map list.
6. **Speech bubbles** — chat text floated over the speaker's token,
   auto-placed to avoid overlap, TTL ~6 s.
7. **Dice-roll animation** — a die tumbles up from the roller's token
   (`DiceRollAnimation`, ~1.1 s).
8. **Text labels** — map text (listens only in eraser mode).
9. **Fog** — unrevealed cells; GM sees it at 0.5 opacity, non-GM at 1.0
   (which also blocks hit-testing beneath). Hex fog is one merged
   `<Shape>` path so shared edges aren't double-painted.

**Pan**: two-finger touch, right-drag, or Space + left-drag. **Zoom**:
wheel (×1.1) / pinch, clamped to 0.25×–4×, anchored on the cursor.
Pinch and drag are never combined in one gesture.

### 4.2 Token popover

Tapping a token opens a DOM popover anchored to its screen position. The
GM (or a PC token's owner) gets the editable view: name/label (GM
tokens), public note, size picker, NPC image change, delete, plus the
**private GM note** (host only) and a "Character info" launcher. A
non-owner gets a read-only view that also names who is permitted to
operate the token.

### 4.3 Toolbar & tools

`TableToolbar` is a right-edge strip of icon categories (one panel open
at a time): **Map & Grid** (GM) — grid kind/size/origin/color/opacity/
snap + the four-tab map source (Upload / Gallery / URL / Preset) with a
separate Replace/Clear; **Fog** (GM) — enable + cover-all / reveal-all +
a pointer to the left brush; **Tokens** (everyone) — *Tokens on Map*
(type badge, click-to-focus, own-PC accent, GM reorder/remove) and a
collapsible *Add / Setup* (PC placement list + NPC library editor);
**Library** (GM) — save as template/snapshot and load/delete entries.

`TableTools` is the left-edge palette that flips the left-mouse / single-
touch gesture mode, with per-tool color / pen-width / text-size controls
that auto-hide when the active tool doesn't use them.

### 4.4 Full-screen mode

`App` toggles `tabletopOpen`; the tabletop takes over the screen (the
Dock tabletop button enters, `returnToRoom` exits). `TablePanel` mounts
inside the shared **`ErrorBoundary`** (`components/ErrorBoundary.tsx`)
with a `TabletopErrorFallback` recovery card, so a Konva render crash
shows retry / clear-map / close instead of a blank app. Chat
and dice are swap-in overlays (`Sheet` on mobile, a floating aside on
desktop) driven by `TabletopDock`; an unread-chat dot rides the chat
icon while chat is hidden. There is **no** separate `TableFeedSheet`
component — the planned swipe-up feed was realised through the existing
`Sheet` + overlay model.

## 5. Delivery history

Implemented across ~40 PRs (#134–#190). Grouped by theme:

| Phase | PRs | Highlights |
|---|---|---|
| Foundations | #134–#141 | Spec, types/protocol, storage (DB v7), Konva base + pan/zoom, PC tokens, chunked background transfer, GM tokens, toolbar/edit-menu |
| Roster & libraries | #142–#147 | PC name labels, NPC image 300 px/200 KB, panel toggles, hand-vs-placed split + PC multi-token + NPC library, PC-remove host guard, tabletop library (template/snapshot, DB v8) |
| Annotations & robustness | #148–#155 | Placement-origin → map centre, text/pen/fog layers, render **error boundary**, fog-drop token rescue, dice+patterns panel merge |
| Hex & UI restructure | #156–#167 | **Hex grid**, bottom-dock restructure, icon-category right toolbar, focus-reveal left tools, fit-content panel, speech bubbles + unread dot, tutorial, fog help text, centre placement |
| Map sources | #171–#177 | URL load, **gallery picker**, token sizes + map-change snap; gallery later switched mid-JPEG → original WebP |
| Token UX & notes | #181–#190 | Hex-fog brush fix, token/NPC edit revamp, char-switch portrait fix, public + private **notes** & permission matrix, dice notification dot + canvas dice animation, two-section token panel, own-PC highlight, grid-wrap placement, docs |

## 6. Risks & how they were handled

| Risk | Handling |
|---|---|
| Drag spam saturates the data channel | ~20 Hz throttle during drag; final position on drag-end |
| Konva re-render cost | Layer separation; viewport culling for grid & fog; hex fog as a single merged path; `listening={false}` on passive layers; memoised derived state |
| Multi-megabyte map blocks the channel | 256 KB chunked transfer; `dataUrl` stripped from snapshots/state and streamed separately |
| Background image chunk loss | `ChunkBuffer` tolerates out-of-order, drops dupes / foreign-id chunks, and length-checks the reassembly |
| `privateNote` leak | `tokenForWire` strips it from every outbound path; covered by `snapshot.test.ts` |
| Spoofed ownership on annotation/token requests | Host re-stamps `ownerPlayerId` and re-checks `canMoveToken` / `canEditMapText` / `canEraseStroke` (`hostValidation.ts`) |
| Player drags own token under fog and loses it | `nearestRevealedCellCenter` rescue on drag-end commit |
| URL / gallery load failure modes | Distinct error tags (`invalidUrl` / `fetchFailed` / `notImage` / `tooLarge` / `unreadable`) → specific toolbar messages |
| Gallery manifest drift (mid tier retired) | `mid` optional, falls back to WebP `originalUrl`; bad rows dropped, ids de-duped at parse time |
| Konva render crash blanks the app | Shared `ErrorBoundary` + `TabletopErrorFallback` (retry / clear-map / close) |
| IndexedDB migration | v6→v7→v8 only *add* stores in `onupgradeneeded`; existing rows untouched |
| Old export archives | Branch on manifest version; v5-and-older imports with an empty table |
| Vitest can't drive Konva (`environment: 'node'`) | All canvas-free logic lives in `src/tabletop/*` pure modules and is unit-tested; Konva integration is verified manually in two tabs |

## 7. Test strategy

### Unit (Vitest, `environment: 'node'`)

`src/tabletop/`: `grid` · `hexGrid` · `tokens` · `annotations` ·
`hostValidation` · `snapshot` · `imageChunk` · `imageBackground` (URL
validation / fetch guards, covered by `imageBackgroundUrl.test.ts`) ·
`mapGallery` · `presetMaps` · `ping` (coordinate validation + the
expanding-ring animation curve).
`src/storage/`: `tabletop` (sanitize + round-trip, fake-indexeddb) ·
`roomExport` · `roomImport` (manifest v6 with `table.json`).

Canvas-bound rendering is intentionally kept out of the unit path; the
pure modules above carry the logic that needs coverage.

### Integration (manual, two tabs)

Drag the same PC token from both tabs (last-write-wins); GM
add/move/resize/remove and NPC-library placement reflect on a non-GM tab;
a multi-MB map reaches both with a loading state; hex grid snap; fog
paint visibility (player sees nothing beneath); text / pen / eraser
ownership; reload restore (host re-hosts, players re-join); export →
import in a different browser; template vs snapshot load; mobile pinch /
drag / overlays.

### Post-deploy (per `CLAUDE.md`)

Wait for the post-merge GitHub Actions deploy, then walk the golden path
on <https://yamadar.github.io/trpg-dice-online/>.

## 8. Phase 2+ candidates

Ordered by rough priority (shipped items removed):

1. Ruler / cell-distance measurement
2. Token facing
3. HP bar / status icons
4. Multiple maps per session (scene list / switcher)
5. Minimap
6. Full keyboard movement & shortcuts

## 9. Revisions

- v0.1 — Initial draft (forward-looking 7-PR plan; PR #134).
- v1.0 — Rewritten as the as-built spec after auditing the shipped code
  (PRs #134–#190): full module map, wire protocol, data flows,
  persistence (DB v8 / export v6), Konva render tree, delivery history,
  updated risks / tests / Phase-2 list.
- v1.1 — Phase 2: **ping** (transient "look here" marker). New ephemeral
  `pingRequest` / `ping` wire pair, `tabletop/ping.ts` pure module +
  tests, a `ping` tool in the left palette and a self-animating
  `PingMarker` render layer. Removed from the out-of-scope / Phase-2
  lists.
