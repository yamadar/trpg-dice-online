# Dice & Chat — Changelog

Per-version revisions for [Dice & Chat](REQUIREMENTS.md). Latest first.

Also available in [日本語](CHANGELOG.ja.md).

- v1.105 — **Minimap crash fix + ping awareness**. Dragging the minimap
  on a map-less scene could fling the camera away (and lock the tab):
  the minimap's world frame included the live viewport, so each recenter
  moved the frame, which mapped the same pointer position to an
  ever-farther point — a runaway. The frame is now pan-invariant (map
  bounds → token bounding box → an origin-centred, viewport-sized
  fallback), so dragging is stable; `recenterOn` also ignores
  non-finite targets. Pings are now visible on the minimap, and a ping
  that lands outside your viewport shows a colored arrow at the screen
  edge pointing toward it (tap to jump) so it is impossible to miss. New
  pure helpers: `offscreenEdgePosition` (`tabletop/ping.ts`) and the
  rewritten `minimapWorldBounds` (`tabletop/minimap.ts`), both
  unit-tested.

- v1.104 — **Clearer scenes vs. library**. Once scenes existed, the
  tabletop library and the scene switcher overlapped confusingly, so
  saving and loading are now explicit. Saving picks a **scope** — *this
  scene* or *the whole table (all scenes)* — instead of silently
  capturing every scene; **templates** now strip PC tokens and pen
  strokes from *every* saved scene (previously only the current one, so
  inactive scenes leaked their PCs); and each library entry loads two
  ways — **Replace table** (swap everything) or **Add as scene** (splice
  the entry's scene(s) into the live session, keeping the current
  scenes), bridging prepared library material into a running game. A note
  labels the library as the reusable, device-wide shelf vs. scenes as
  this-game-only; multi-scene entries show a scene-count badge; and the
  Japanese UI now says スナップショット to match the English "Snapshot".
  The scope logic is the pure, unit-tested `tabletop/scenes.ts`
  (`allScenes` / `currentSceneOnly` / `stripTemplateScenes` /
  `appendScenes`).

- v1.103 — **Minimap**. A collapsible corner overview of the current
  scene — the background map (or a fitted blank region), a dot per token,
  and a rectangle marking the current viewport. Clicking or dragging the
  minimap recenters the camera on that part of the scene. The geometry
  (fitting the world rectangle into the box, the world↔minimap mapping,
  and the world-bounds choice) is the pure, unit-tested
  `tabletop/minimap.ts`. This completes the original Phase-2 tabletop
  list except the ruler.

- v1.102 — **Multiple maps per session (scenes)**. The GM can keep
  several scenes — each its own map, grid, tokens, annotations and fog —
  and switch the active one from a new "Scenes" toolbar category (add /
  rename / delete; the last scene can't be removed). The NPC library and
  PC spawn point stay shared across scenes. Scenes are a GM-only concept
  on the wire: the inactive scenes are stripped before broadcast, so a
  switch just sends the new `tabletopState` and re-streams its map, and
  clients only ever mirror the current scene. Scenes persist across
  reload and round-trip through the room export / import (each scene's
  map externalized to `attachments/maps/`). Implemented with the pure,
  single-source-of-truth `tabletop/scenes.ts` (current scene stays the
  live top-level state; `scenes[]` holds the rest) with monotonic scene
  numbering.

- v1.101 — **Full keyboard movement & shortcuts**. With the tabletop
  focused (and no field being edited): arrow keys move the selected token
  one grid cell at a time; `1`–`5` (and V/T/P/E/G) switch tools;
  `+` / `-` / `0` zoom in / out / reset; `f` centres on the selection;
  `[` / `]` cycle the operable tokens; `Delete` removes the selected
  token; `Esc` deselects then closes; and `?` toggles an on-screen
  shortcuts cheat sheet. Movement obeys the same `canMoveToken`
  permission as dragging. The key→intent mapping is the pure, unit-tested
  `tabletop/keymap.ts`.

- v1.100 — **HP bar & status conditions**. Tokens can carry an optional
  HP pool (current / max) drawn as a colour-graded bar under the token
  (green → amber → red), and a set of status conditions from a fixed
  catalog (poison, stun, sleep, fear, charm, burn, freeze, bless, shield,
  haste, bleed, down) drawn as emoji badges above the token. Both are
  edited from the token dialog (HP inputs + a chip grid) and follow the
  same `canMoveToken` permission as move / facing, via host-validated
  `tokenHpRequest` / `tokenStatusRequest` messages (clamped / sanitised
  host-side). The HP/status math lives in `tabletop/vitals.ts`
  (unit-tested) and both round-trip through the reload sanitiser.

- v1.99 — **Token facing**. Tokens can carry an optional facing direction.
  The token dialog gains an 8-way compass (plus a clear cell) and the
  canvas draws a small direction arrow just outside the token. Facing
  follows the same permission as move / resize (own PC or GM), enforced
  host-side via a new `tokenFacingRequest` validated with `canMoveToken`.
  The angle math (normalisation, screen-space vector, arrowhead geometry)
  lives in `tabletop/facing.ts` (unit-tested). This release also closes a
  long-standing reload gap: `sanitizeStoredTabletop` now round-trips a
  token's `size`, `note`, `privateNote` and `facing`, which previously
  survived live sync but were dropped when the host reloaded from
  IndexedDB.

- v1.98 — **Ping ("look here") marker**. Any participant can pick the new
  ping tool from the left palette and tap the map to drop a transient
  attention marker — an expanding ripple in their player colour with their
  name beneath — that broadcasts to everyone and fades after ~2.6 s. The
  ping is deliberately *ephemeral*: it never enters the tabletop state, so
  it is not persisted, not part of the welcome snapshot, and not exported.
  A client sends a host-validated `pingRequest` (sender id re-stamped,
  coordinates checked) which the host re-broadcasts as `ping`. The pure
  animation / validation math lives in `tabletop/ping.ts` (unit-tested);
  the marker self-animates in a new `PingMarker` render layer.

- v1.97 — **Arrange placed tokens in a 4-column grid** instead of a single
  horizontal row. Previously every new token was staggered one cell to the
  right of the last, so a table with many participants could spread the
  cluster far outside the visible area. Tokens now wrap to a new row after
  four columns, keeping the cluster compact regardless of how many tokens are
  placed.

- v1.96 — **Major token panel and permission overhaul** across PRs #187–#188.
  The token sidebar is reorganised into a "Tokens on Map" section at the top
  (always visible, click any row to highlight that token on the canvas) and a
  collapsible "Add / Setup" section below. Own tokens are highlighted in the
  list with the accent colour; non-operable tokens on the canvas are rendered
  at 0.8 opacity. Every token gains a **public shared Note** editable by all
  participants, and GM tokens additionally carry a **private GM Note** that is
  accent-tinted in the UI and stripped from every outgoing wire message.
  Permissions follow a clear matrix: players can move, resize, and remove
  their own PC tokens via host-validated requests; tapping any token opens an
  editable dialog for the GM and a read-only dialog for non-owners. Character
  info for another player's PC is displayed in a locked view that looks
  identical to the editable one. The token resize no longer drifts on a
  1 → 2 → 1 cycle (floor-anchored `snapResizeToGrid`). "Edit token" is
  renamed "NPC token". Rolling dice now triggers the unread-activity dot on
  the tabletop dock; a die icon animates from the roller's token position on
  the canvas. The tutorial-button opacity is toned down to 0.5.

- v1.95 — **Unify image-picker confirmation behaviour**. The picker now uses
  the same single-click-to-select / footer-button-to-confirm flow used by the
  map gallery ("Cancel / Use this image"). Clicking inside the portaled
  picker overlay no longer accidentally closes it (fixed by excluding
  `.map-gallery-layer` from the popover's outside-click handler).

- v1.94 — **Token popover polish**. New NPCs created via "+" show the title
  "New NPC"; editing an existing entry shows "Edit NPC". PC tokens display
  the character's name in the popover. The NPC token image picker is portaled
  to `document.body` so it is no longer clipped to the popover's 220 px
  width.

- v1.93 — **Tabletop UI improvements** (11 items): fix the speech-bubble tail
  position on diagonal directions; add an unread dot on the tabletop dock's
  chat icon; fix chat scrolling inside the tabletop overlay; deduplicate the
  background-map "Replace" button and make "Clear" an icon-only action; move
  the NPC-token "Change image" button below the size picker; widen the NPC
  "Change image" modal; remove the NPC-library name input and make "Add" an
  icon-only action; auto-focus the name field when creating a character;
  add ▲▼ reorder controls to the NPC library and placed-token lists; make
  effect rings draw around large (2+ cell) tokens rather than inside them;
  fix a sync bug where the GM's non-active characters' placed tokens were
  invisible to other participants after joining.

- v1.92 — **Documentation update**: hex-grid and fog-of-war features fully
  documented in `REQUIREMENTS.md` / `REQUIREMENTS.ja.md`. No feature changes.

- v1.91 — **Token and NPC editor UI overhaul**: rename the token-delete
  label; tapping a PC token opens a character-info modal directly from the
  popover; NPC library entries open a popup editor with a name input;
  the "Change image" action for NPC tokens is widened to a full-width modal.

- v1.90 — **Fix PC token portrait lost on active-character switch**. Switching
  the GM's operating character cleared the image of the token for the
  previously active character. Root cause: the token-update path over-wrote
  the token with an empty image. The fix stores each placed PC token's
  portrait at placement time and only updates it when the matching character
  record changes.

- v1.89 — **Fix the fog-of-war brush not painting on hex grids** (same root
  cause as v1.88 hex-fog fix, affecting the brush gesture guards). Relaxed
  four `grid.kind === 'square'` guards so the brush works on both square and
  hex grids while remaining a no-op on gridless maps.

- v1.88 — **Fix the fog-of-war brush not painting on hex grids**. The
  fog gesture's start check and its per-cell paint were both gated on
  `grid.kind === 'square'`, so on a hex grid the "Reveal / Apply fog"
  tools could be selected but never painted anything (both mouse and
  touch; surfaced on mobile). Cell hit-testing (`cellFromWorld`),
  rendering (`FogLayer`), and state updates (`paintFog`) were already
  hex-aware, so the four guards were relaxed to block only the
  gridless (`'none'`) case.

- v1.87 — Add an **image picker** to the NPC library editor and the
  token edit popover. Tapping "Change image" now opens a unified
  dialog with three tabs — Upload, Character, Monster — that
  browse 715 character portraits and 40 monster icons from the
  sibling [trpg-chara-image-organizer](https://yamadar.github.io/trpg-chara-image-organizer/)
  filtered by race / gender / age / profession / name. Uploads
  still go through the existing crop dialog; library picks skip
  the crop (they're already framed) and feed straight into the
  `prepareNpcTokenImage` downscale. The manifest is memory-cached
  so the second open is instant.

- v1.86 — Switch the map-gallery picker from the **mid-resolution
  JPEG (`images/mid/`)** to the **original WebP**. Upstream is
  retiring the mid tier because WebP compression brings the
  original close to the same byte count, so an extra resolution
  earns nothing. Both "Use this map" and the magnifier preview now
  read `originalUrl(map)`; `midUrl()` itself stays exported as long
  as upstream still ships the `mid` field, so external consumers
  and the existing unit-test coverage keep working.

- v1.85 — A round of tabletop-UI polish. Consolidate background-map
  source selection into a **four-tab UI (Upload / Gallery / URL /
  Preset)** rendered as icons with the active tab's name and a
  short description beneath the strip. Replace the grid's numeric
  inputs with a touch-friendly **stepper** (−/+ buttons with
  long-press auto-repeat) and the stroke-color input with a
  **react-colorful** picker. Convert fog-of-war and grid-snap
  on/off controls to **toggle switches**. The gallery's
  **per-thumbnail preview** now supports prev / next (with mobile
  swipe), inherits the active filters, syncs the underlying grid
  selection on every move, scrolls the matching card into view,
  and shows the map's description directly below the image.
  Re-opening the tabletop tutorial collapses whichever category
  panel was open.

- v1.84 — Add an **in-app picker** for the sibling
  [trpg-map-organizer](https://yamadar.github.io/trpg-map-organizer/)
  gallery. A new "Open gallery…" button in the tabletop toolbar
  opens a modal that browses ~303 hand-curated maps across four tag
  taxonomies, with file-name / description search, AND / OR tag mode
  toggle, and a thumbnail grid. Tag chips follow the UI language —
  Japanese UI shows the source tags, every other language pulls the
  English label from the gallery's own `i18n.json` and falls back to
  the source tag when a translation is missing. Picking a map sends
  its original-resolution WebP through PR #171's URL-load pipeline, so
  syncing and downscaling reuse the same code path as a hand-picked
  file. Manifest and tag dictionary are cached in memory for an
  instant second open.

- v1.83 — Add a **load-by-URL** path to the background map. The GM
  can now pick a public image URL (CORS-allowed server) in addition
  to a local file; the result goes through the same downscale and
  chunked-broadcast pipeline as a hand-picked file and syncs to every
  participant. Distinct flash messages cover the URL-specific failure
  modes: malformed URL, network / CORS failure, and "URL resolved but
  the body is not an image". Pairs naturally with CORS-friendly
  galleries such as the sibling
  [trpg-map-organizer](https://yamadar.github.io/trpg-map-organizer/),
  where the "copy URL" button drops a usable link straight into the
  toolbar field.

- v1.82 — Round out the tabletop with the model and tooling needed
  for actual scenario play, in four linked additions.
  (1) **Separate ownership from placement**: PC tokens are placed
  by an explicit action from the owner or the GM, and a single
  character may have multiple tokens on the map (for twin / clone
  fiction). Players can move their own tokens but not delete them
  (GM-only).
  (2) **NPC library**: the GM can curate "name + image" templates
  for NPCs before placing them. Library images go through a
  dedicated pipeline (long-edge 300 px / ~200 KB) with a crop UI
  reusing CharacterImageCropDialog. Placement clones the entry
  inline into a GmToken, so later library edits do not retroactively
  change tokens already on the table.
  (3) **Per-token edit popover**: tapping a placed token opens an
  edit popover where the GM can rename and re-image GM tokens; the
  GM can remove either flavour of token.
  (4) **Tabletop library (templates / snapshots)**: the GM can save
  the current tabletop under a name and reload it into any room
  later. The library is global (not per-session) and lives in
  IndexedDB's `tabletopLibrary` store (DB v8). Templates store the
  initial layout (PC tokens stripped) along with the viewport
  centre as `pcSpawn`, so a load re-spawns the GM's existing PCs
  around `pcSpawn` and a scene swap does not force every player to
  re-place themselves. Snapshots store the full state including PC
  tokens and load restores everything verbatim. A full replace is
  broadcast over the new HostMessage `tabletopState`; the map
  image rides the existing `mapMeta` / `mapChunk` chunked path so
  a multi-megabyte background does not block the data channel.
  i18n gains `tabletop.playerToken.*`, `tabletop.npcLibrary.*`,
  `tabletop.tokenEdit.*` and `tabletop.library.*` across all 19
  locales (parity test maintained).
- v1.81 — Add the tabletop feature. The GM uploads a single background
  map, places a square grid on it, and puts PC tokens (auto-generated
  from the session's characters, reusing the portrait as the token
  image) and GM-only tokens (for NPCs / monsters / props, GM-only to
  add / move / remove). Sync reuses the existing host-authoritative
  / last-write-wins model; positions during a drag are throttled to
  ~20 Hz and finalised on drag end. A background image is downscaled
  to a long-edge cap of 3000 px; anything over the P2P 3 MB ceiling
  is sent in chunks and reassembled on each client. The tabletop
  state is persisted to IndexedDB per `sessionId` and ships in the
  room export ZIP as `table.json` and `attachments/maps/*` (manifest
  bumped to v6). On mobile the tabletop opens in a full-screen mode
  (not a Dock sheet) and the feed is shown as a height-adjustable
  swipe-up bottom sheet so chat / rolls remain visible; desktop uses
  the same full-screen mode. Rendering uses react-konva, added as a
  dependency. i18n grows by `tabletop.*` across all 19 locales.
- v1.80 — Make the P2P star-topology constraint "if the GM goes offline,
  everyone else is disconnected too" visible before users commit to a
  room. Until now this dependency was only surfaced in the GM's
  close-room confirmation (`room.leaveConfirmGM`) and the post-disconnect
  error banner (`room.hostLost`); there was no way to learn it before
  creating or joining a room. Three additions: the create screen's
  `room.createGmHint` is extended to read "The GM acts as the room host,
  so when the GM goes offline the other players are disconnected too";
  the join screen gains a new key `room.joinGmHint` rendered as a
  `<p className="hint">` ("When the GM (the host) goes offline, the
  other players are disconnected too"); the tutorial step
  `tutorial.room.body` appends the same idea. Rolled out across all 19
  languages (the key-parity test in `translations.test.ts` enforces it).
- v1.79 — Unify every panel around a "pinned header, scrolling body"
  pattern. The settings drawer used to render its "Settings" heading
  inside the scroll region with the close × floating on top, which
  caused the title to scroll away when the body was long. Promote a
  `.settings-header` shaped exactly like `.sheet-header` (title + ×
  in one pinned row) so `.settings-body` is the only scrolling
  surface. The `PlayerDetailCard` opened by tapping a feed speaker
  name was already wrapped in a `Sheet` but never received a `title`,
  so its shared header was empty; pass `feed.playerDetail` and
  `PlayerIcon` so it reads with the same header layout as the dock
  panels. The tutorial card stretched and shrank to fit each step's
  body text, which made the Next button hop between steps — make
  `.tutorial-card` a flex column with `height: 460px;
  max-height: calc(100svh - 40px)` and give the body `flex: 1;
  overflow-y: auto;` so Next / Done / Back / Skip land at the same
  Y on every step. Finally, rename the character panel's "Export"
  label to "Export to file" so it mirrors the existing "Import
  from file" wording; `character.export` is updated across all 19
  language dictionaries.
- v1.78 — Make the "typing…" indicator HSP-friendly by giving the
  player two independent opt-out toggles in the settings menu. "Show
  others typing" (`showTyping`, default on) is the receive-side
  toggle — when off, the rendered `typing-line` collapses to an empty
  string while the signal still arrives on the wire; we drop it locally
  rather than refusing it, so the toggle stays a private preference
  rather than a renegotiation with the room. "Broadcast my own typing"
  (`broadcastTyping`, default on) is the send-side toggle — when off,
  `ChatComposer.onType` skips the `session.sendTyping()` call entirely,
  so no signal ever leaves this client. The two are split because the
  asymmetric cases are real ("I find seeing them stressful, but I
  don't mind broadcasting mine"; "I want to see, but I don't want to
  signal back"). Persisted as `trpg-dice.showTyping` and
  `trpg-dice.broadcastTyping` (`'1'` / `'0'`) in `localStorage`. Three
  new i18n keys added across all 19 languages:
  `settings.groupTyping`, `settings.showTyping`,
  `settings.broadcastTyping`.
- v1.77 — Add a crop UI for character portraits at upload time so the
  user can pick the square area that becomes their avatar. Pulls in
  `react-easy-crop` as a dependency and opens a new
  `CharacterImageCropDialog` right after a file is picked. The crop
  area is locked to a 1:1 aspect ratio and the overlay is rendered as
  a circle (`cropShape='round'`), matching the round avatars used in
  the feed and the roster. Drag to reposition, slider to zoom — on
  confirm the cropped rectangle is drawn to a canvas and fed through
  the existing `prepareCharacterImage` (long-edge cap + JPEG
  re-encode). The saved bytes are square; display-time CSS
  (`border-radius: 50%`) keeps the avatar circular as before.
  Portraits coming in through the JSON-import path skip the crop —
  they ship with their own author-chosen frame. i18n grows by
  `common.apply` + `character.crop.{title,hint,zoom}` across all 19
  locales.
- v1.76 — Expand the "Roll dice" preview to a beginner-friendly
  spelled-out form. The feed's detail line (`.roll-detail`) keeps the
  compact `formatDiceSummary` shape (`1D6+2`, TRPG shorthand). The
  pre-roll preview inside the modal now uses a new
  `formatDicePreview` that reads "count × type ± modifier" — e.g.
  `3 × D6 + 2`, `1 × D20 − 3`. The multiplication is `×` (U+00D7);
  the modifier minus is `−` (U+2212) so it lines up optically with
  the `+`. The teaching goal is that a first-time TRPG player can
  read "what is multiplied by what" before tapping Roll, without
  losing the compact shorthand TRPG veterans expect to see in the
  feed history.
- v1.75 — Redesign the "Roll dice" sheet's information hierarchy. The
  previous layout placed the count chips (a 5×2 grid of 1–10), die-type
  chips (seven D4–D100 buttons), modifier stepper, kind chips (damage /
  judgment), formula preview, pattern-name field, "Roll" button and
  "Save pattern" button at the same visual weight, making priorities
  and relationships hard to read. The new layout reorganises the
  modal as follows:
  - **Roll name** moves to the very top of the modal. The name is the
    roll's headline in the feed (whether or not it gets saved as a
    pattern) and the saved pattern's name when the user does press
    save; it is no longer a "save-only" field tucked near the save
    button.
  - **Count, type and modifier collapse onto a single row**. Count
    becomes a 1–10 stepper (the v1.28 10-chip grid is retired); type
    becomes a `<select>` (the 7-chip row is retired); modifier stays
    a stepper. Together they form one "dice formula" row.
  - **Kind** stays in its own row (damage / judgment chip pair) —
    "what sort of roll is this?" is conceptually separate from the
    expression and gets its own line.
  - **Preview** changes shape to `"{kind} {x}D{y}±{z}"` so the kind
    is reflected in the headline, and gets tinted with the kind's
    accent colour (`--damage` / `--judgment` — the same hue used for
    the feed bubble's top border). A glance at the card tells the
    user how the entry will render in the feed.
  - **Roll button** becomes a fullwidth primary; below it a thin
    divider and a quieter outlined "Save pattern" button establish a
    clear primary / secondary action hierarchy.
  - i18n grows by `dice.rollName` / `dice.namePlaceholder` /
    `dice.formula` / `dice.countDec` / `dice.countInc` across all 19
    locales.
- v1.74 — Drop the per-message speaker snapshot, route every render
  through the per-(player, character) record store. `ChatMessage` and
  `RollResult` lose `playerName` / `characterName` / `background` /
  `isGM`; each entry now identifies its speaker by `(playerId,
  characterId)` only. The feed pulls the displayed name / character
  name / background / GM mark / portrait from `sessionCharacters`'
  most recent observation for that pair. This formally **retires v1.20**
  — "an entry keeps its at-the-time character name even after the
  speaker switches characters" no longer holds; same character id =
  same current label for every past entry. IndexedDB is bumped to v6
  and the physical store name moves from `sessionPortraits` to
  `sessionCharacters` (rows are copied row-by-row during the upgrade
  transaction; the legacy store is intentionally left in place
  because dropping it from inside a cursor callback is unreliable
  across browsers — a future `DB_VERSION` bump can drop it
  synchronously in the upgrade body). `deleteSession` and
  `deleteAllSessions` clear the legacy store too while it exists, so
  a history wipe leaves no orphan rows behind. Type names, store
  name and concept name now line up, and the speaker-info pipeline is
  unified with the image pipeline: one per-character store, no inline
  snapshots.
- v1.73 — Per-character session records and v5 room-export. The
  `Player` / `Identity` / `ChatMessage` / `RollResult` types pick up a
  new `characterId` field alongside the existing `characterName`
  snapshot, so a character's row in the per-session store is keyed by
  the stable `Character.id` rather than the mutable name. The durable
  per-character store grows from a portrait-only row to a full
  per-(player, character) snapshot — `playerName / characterName /
  background / isGM / image`, the speaker fields the past-rooms feed
  needs to render entries without the live session. A v4→v5 IndexedDB
  migration re-keys existing rows with a synthesised
  `@n:<encoded characterName>` characterId so per-character portraits
  from earlier sessions stay distinct after the schema bump, and the
  feed-side resolver (`speakerImageKey`) falls back to the same
  synthesis when an older log entry predates the field. Room exports
  are bumped to manifest v5: the per-character records ride along with
  entries / translations, and each record's portrait is split out as
  a real file under `attachments/portraits/<player>-<character>.<ext>`
  (mirroring the chat-attachment treatment) so base64 stays out of the
  JSON. The room-history view loads the per-character records
  alongside the durable log and renders the past feed's names,
  backgrounds, GM marks and portraits from them. A v4-or-older
  archive still imports cleanly — its `characters` slot is treated as
  empty.
- v1.72 — Backfill unit-test coverage for the pure helpers that drive
  the chrome's persistence and visual configuration. New `.test.ts`
  files for the colour-theme registry / id guard
  (`src/theme/themes.test.ts`), the text-size scale registry / guard
  (`src/theme/fontScale.test.ts`), the typed `localStorage` wrappers
  (`src/storage/local.test.ts`) and the small per-preference modules
  built on them — display preferences (`compactFeed`, `fontScale`),
  colour theme, auto-translate flag, last room code, tutorial-seen
  flag, and the pattern id generator. The suite grows by ~74 tests
  and pins exactly the values the rest of the app reads back from
  storage.
- v1.71 — Per-character portraits in past-room history. The durable
  portrait store moves from one record per `(sessionId, playerId)` to
  one per `(sessionId, playerId, characterName)`. A v3→v4 IndexedDB
  migration re-keys existing records with an empty character name and
  the room-history view falls back to that legacy key when no
  per-character record is found, so older sessions keep showing their
  portraits. The session's in-memory `characterImages` derivation
  now also drives the persistence: every (player, character) → image
  observation lands on disk, and explicit clears (a portrait deleted
  by the user) are persisted as deletes, while in-memory prunes (an
  entry no longer referenced by the live window) leave disk untouched.
  Fixes the past-rooms feed showing the current self portrait — or no
  portrait at all — for entries whose character had since changed.
- v1.70 — Replace every `window.confirm` (clear the feed, leave the
  room as GM, delete a character / saved pattern / past session,
  overwrite a saved pattern, delete all past sessions) with a themed
  in-app dialog that matches the rest of the chrome (dark panel, app
  buttons, app fonts). The dialog is centred over a dimmed backdrop,
  closes on Escape / backdrop click / the corner "×", focuses the
  cancel button on destructive confirms (so a stray Enter does not
  fire the destructive action), restores focus to the previously
  focused element on close (`preventScroll: true` to avoid mobile
  scroll jumps), traps Tab cycling inside the card, and is wired via
  a `<ConfirmProvider>` at the app root and a `useConfirm()` hook.
  Three new i18n keys (`common.confirm`, `common.cancel`, plus
  `common.confirmDialog` for the fallback accessible name when the
  caller omits a title) ship across all 19 locales.
- v1.69 — Surface icons throughout the settings panel. The panel title
  ("Settings") now sits next to the Settings cog (the same icon as the
  header trigger, so the affordance and the opened panel feel like one
  continuous surface). Each settings row and group header gets an icon
  by its label so the panel reads as a glanceable list:
  `User` (player name), `Languages` (language / auto-translate +
  the "Language & translation" group), `ALargeSmall` (font size),
  `Rows3` (compact feed), `Palette` (theme + "Appearance" group),
  `Info` ("About" group), and `HelpCircle` (open the in-app help).
- v1.68 — Trim the feed header. The "Dice & Chat" section title is
  removed (the rest of the chrome makes the feed's identity obvious),
  and the filter chip group is centred on the row with the "clear view"
  trash button parked in a fixed slot on the right. The slot is always
  in the layout (an invisible placeholder reserves it when the trash
  button is hidden), so chips no longer shift sideways as the feed
  flips between empty and non-empty. The section keeps its accessible
  name via `aria-label`, and the filter group gets a dedicated
  `feed.filter` i18n key (added to all 19 locales) so its `role="group"`
  no longer reuses the section title.
- v1.67 — Unify every in-app icon under a single visual vocabulary.
  The previous mix of hand-rolled SVGs and emoji glyphs is replaced
  with one set: [Lucide](https://lucide.dev) (ISC) for UI chrome and
  semantic concepts, plus the
  [Game Icons](https://game-icons.net) `perspective-dice-six-faces-one`
  by Delapouite (CC BY 3.0) as the single canonical dice silhouette.
  The d6 (preferred over the d20 because it keeps its shape at 16–22 px)
  is reused for the feed "Rolls" filter, the Dock dice button and the
  tutorial dice step so the dice concept reads with one glyph
  everywhere. Other replacements: feed filter chips become icon-only
  (Lucide `Layers` / `MessageCircleMore` / `Paperclip` for All / Chat
  / Files with the localised name carried by `aria-label` + `title`,
  and a ≥36 px tap target via padding); Dock buttons use Lucide
  `Users` / `Drama` / `Star` (Room / Character / Patterns); the
  Settings header switches from "⚙" to Lucide `Settings`; the chat
  composer's attach button and the in-feed file chip use Lucide
  `Paperclip`; the character portrait's "Edit" pill uses Lucide
  `Pencil`; the StatusBar player-count chip uses Lucide `Users`;
  panel headings use the same icons as their Dock siblings; and the
  tutorial steps render the matching icon at poster size (`Hand` for
  welcome, `History` for past rooms, `Languages` for auto-translate,
  etc.). The custom `BrandIcon` and the per-die `DiceFaceIcon` are
  intentionally kept — the former is the app's brand mark, the
  latter encodes each die's geometry as read by the feed.
  Third-party attribution lives in
  [`CREDITS.md`](CREDITS.md) /
  [`CREDITS.ja.md`](CREDITS.ja.md).
- v1.66 — Feed switches to a LINE / Messenger style bubble layout: the
  local player's rolls and chat align right, everyone else's align left.
  A 36 px circular avatar sits next to each entry, showing the
  character's portrait when one is set and falling back to a flat disc
  in the player's color. The roll-kind accent moves from a left border
  to a top border so the cue reads the same whether the row is mirrored
  right or kept left. The compact layout stays a dense one-line feed
  identified solely by the colored character name.
- v1.65 — Rebrand: display name changes from "TRPG Online Dice / TRPG
  オンラインダイス" to **Dice & Chat**, and the tagline changes from
  "Roll dice together with your party / 仲間とダイスをシェアしよう" to
  "Online TRPG sessions made easy / オンラインTRPGセッションを簡単に".
  Updated everywhere the user-facing brand is read: the i18n
  `app.title` / `app.tagline` / `tutorial.welcome.title` keys across
  all 19 locales, the page `<title>` and `apple-mobile-web-app-title`
  meta, the PWA manifest `name` / `short_name` / `description`, and
  every README / requirements heading. Internal identifiers (npm
  package slug, GitHub Pages base path `/trpg-dice-online/`, the
  P2P peer-id prefix `trpgdice-`, the IndexedDB name `trpg-dice`,
  `localStorage` keys `trpg-dice.*`, and the room-export ZIP magic
  string `trpg-dice-room-log`) are intentionally left unchanged so
  existing users' data, saved exports and open connections keep
  working.
- v1.64 — Ship as an installable PWA. A web manifest (standalone display,
  midnight `theme_color`), PNG icons (192, 512, maskable 512, Apple
  touch 1024) and a precaching service worker (vite-plugin-pwa,
  `autoUpdate`) let the site be added to the iOS / Android home screen
  and launched in a full-screen window without browser chrome. The
  browser favicon switches from the SVG-only setup to a proper `.ico`
  with the SVG kept as a higher-DPI fallback for desktop tabs. The
  service worker only precaches the app shell — offline play is out of
  scope because the app is realtime P2P.
- v1.63 — Stop past-room clutter from quick visits. A session with no
  user activity (no roll, no chat, no file attachment) is dropped from
  the durable log on exit instead of leaving an empty entry; and
  re-entering the same code reuses the previous still-open session
  (`closed !== true` on `SessionRecord`) so a leave / rejoin or a
  reload-driven re-host stays as one history entry. The GM explicitly
  ending the room (or a client receiving that notice) tags the session
  as closed, after which the next visit to the same code mints a fresh
  entry.
- v1.62 — Surface the character snapshot and last-known portrait in the
  past-feed viewer. A new `sessionPortraits` store (IndexedDB v3)
  records every portrait we see — single updates, the welcome snapshot,
  and the host's own portrait at session start — and the history viewer
  gains a player detail sub-view that opens that snapshot when a name is
  tapped.
- v1.61 — UI tweaks: drop the "unnamed pattern" placeholder for an unnamed
  judgment roll (it now reads just "Result: N"); shrink the D20 central
  number slightly relative to D8; clip overflow at the app shell so a
  growing feed can no longer scroll the page itself; the character panel
  now shows details inline, the background / memo textareas grow to five
  rows, and the "include memo in export" preference is persisted per
  character (the export / import format itself is unchanged).
- v1.60 — Replace the textual face breakdown with shape icons (SVG). Each
  die's top-down silhouette is drawn with the rolled value inscribed
  (d8 / d20 show a prominent central number; d4 nudges the number up to
  clear the base; d10 is a vertical rhombus; d100 is a circle). The
  icons are decorative — a single visually-hidden text summary backs
  them for AT.
- v1.59 — Fix the GM losing the room name on reload. The per-tab
  `activeRoom` sessionStorage pointer now carries the room name, kept in
  step on create / rename / code-change / welcome, and restored on
  resume.
- v1.58 — Browse and delete past room history. The durable log is now keyed
  by `sessionId` instead of room code (IndexedDB v2 with a new
  `sessions` store), so a reused code or a mid-room code change no
  longer splits a game's history. The lobby gains a "Past rooms" list
  with a read-only feed and per-session / all-sessions deletion.
- v1.57 — Split the lobby into a home / create / join flow. In-room moves
  the participant roster to the top with portraits, and tucks the
  room-name editor and GM-only code change into a collapsed GM
  `<details>` section with explicit Change buttons. The GM's exit reads
  "Close room".
- v1.56 — Limit the settings panel's dropdown layout to viewports that are
  both wide and tall enough to show it un-cramped. On a short desktop
  window the dropdown became a small floating box with the × hovering
  over the content, so there it now falls back to the same full-height
  drawer used on mobile.
- v1.55 — A client now keeps each chat message in the send queue until the
  host echoes it back, so a message sent during an as-yet-undetected GM
  outage is no longer lost — it stays pending and the reconnect flush
  re-sends it. Consecutive system markers are also folded into a "(n)"
  on the real timeline, before the view filter, so they no longer fold
  across a roll / chat that the current filter hides.
- v1.54 — Code-review follow-ups: enable TypeScript strict mode; drop the
  page-leave confirmation while offline (not in a room); and harden the
  P2P layer so a client cannot spoof the GM flag or id and only valid
  image data URLs are accepted from the network.
- v1.53 — Place the settings panel's × button 8px from the frame, matching
  the other modals. On mobile the panel now opens as a full-height
  drawer whose body scrolls when the content overflows.
- v1.52 — The settings panel's close control is now the same × icon button
  used by the other modals.
- v1.51 — Settings-panel tweaks: the player name now uses the same one-row
  layout, "How to use" moves into the About section, and the panel is a
  little wider so the theme grid no longer overflows — its right edge
  lines up with the other controls.
- v1.50 — Group the settings panel into titled sections — "Language &
  translation" (language, auto-translate) and "Appearance" (text size,
  compact feed, theme) — each set off by a divider.
- v1.49 — Sync the character portrait to the other players in a room. The
  image travels on its own `image` message — separate from the roster —
  and is sent only on change and on joining; the welcome snapshot gains
  an `images` map. The player-detail card shows the other player's
  current portrait and opens it in the lightbox on tap.
- v1.48 — Add a text-size setting (small / medium / large). It changes the
  root font-size so the whole rem-based UI rescales, and the choice is
  saved per browser.
- v1.47 — In the compact feed the time is pinned to a fixed left gutter and
  the name and message flow as one block, so a wrapped message lines up
  its later lines under the name. A run of identical consecutive system
  messages is folded into one line with a trailing "(n)" count.
- v1.46 — A character can carry one portrait image. On attach and on import
  the size is checked against ~2560 px / ~2 MB and anything larger is
  downscaled and JPEG-compressed on a canvas. The image is part of the
  character export JSON, shows as a thumbnail in the character details,
  and opens in the lightbox on tap. The character file is bumped to v2
  (an optional image field; v1 files still import).
- v1.45 — Unify the feed's time display to `H:mm` (no seconds) and reorder
  the compact row to time · name · content. A date divider — the calendar
  date (in the UI language) centered between two rules — now opens the
  feed and marks each day change.
- v1.44 — Drop the manual translation-backend switch: the on-device Chrome
  Translator is now the primary with MyMemory as an automatic fallback.
  The memoization key no longer includes a backend, and the export
  manifest is bumped to v4 (cached translations drop the backend tag;
  v3 archives still import). The auto-translate and compact-feed
  settings are shown as ON/OFF toggle switches.
- v1.43 — UI tidy-up for the compact feed. The compact toggle moves from the
  feed header into the settings menu (grouped with the other display
  settings, leaving the header focused on the filter); compact entries
  drop the player-color dot and the "（Player）" half of the name, keeping
  just the character, and a long message now wraps instead of being
  truncated.
- v1.42 — Room export / import now carries chat translations. The archive
  manifest is bumped to v3 and stores cached translation results
  (backend, source / target language, original and translated text);
  on import they reseed the translation cache, so a re-imported room
  shows the same translations without re-translating.
- v1.41 — Add chat auto-translation. Settings toggle auto-translate on/off
  and choose the backend (the on-device Chrome Translator API or
  MyMemory — both keyless and backend-free). Each received chat message
  is translated into the UI language and can be flipped between original
  and translation; the original pulses while translating. Results are
  memoized by (backend, source, target, text). Translation lives entirely
  in the display layer and falls back to the original on failure.
- v1.40 — Small UX improvements: reconnection now persists up to 60 attempts
  (~5 minutes) before giving up; the Room / Character / Dice / Pattern
  modal titles carry their icons; the dice & chat feed gained a compact
  layout toggle; and editing character details or changing the room code
  now also raises a toast.
- v1.39 — Improve the participant experience when the GM goes offline: the
  GM's absence is detected from a gap in its periodic keepalive (WebRTC
  is slow to report a lost peer on its own). A banner shows that the GM
  is offline while reconnecting, the retry interval is capped at 5s for
  persistent probing, and after a long outage the participant is notified
  and taken offline. Chat sent during the outage is shown as unsent and
  delivered in order on reconnect.
- v1.38 — Add room import: an exported ZIP archive can be loaded back to
  restore the room. Offline, "Import history" in the room panel seeds the
  durable log with every entry, restores the feed, and re-hosts the same
  code; attachments are rebuilt into data URLs from the archive's files.
- v1.37 — The history export is now a ZIP archive and carries everything
  needed to restore a room. It holds a `room.json` with the player roster
  and all entries, plus an `attachments/` folder with each chat attachment
  as a real file — no base64 inlined in the JSON, and the archive
  compresses.
- v1.36 — The room's full history can now be exported to a JSON file.
  "Export history" in the room panel writes the durable log — rolls,
  chat, file attachments and markers, each with its player / character
  snapshot — into a single versioned, self-contained file.
- v1.35 — Older history beyond the display cap can now be paged in on demand
  with "Load older". The live window caps rolls / chat / markers
  separately, so it can have internal gaps — the full room log is loaded
  from the durable store in one go, with duplicates dropped when the feed
  is built.
- v1.34 — Implement resume-after-reload: a per-tab sessionStorage pointer
  records the room and role, so on startup a GM re-hosts the same code and
  a player re-joins; the conversation is restored from the durable log,
  so a GM reload no longer loses the conversation.
- v1.33 — Every roll / chat / marker is now also appended to a durable
  per-room IndexedDB log — the basis for reload restore, on-demand history
  and export. "Clear view" also clears that room's log.
- v1.32 — Opening or reloading with a `?room=CODE` now auto-attempts to join
  that room, with no manual "join" tap needed.
- v1.31 — Feed chat / roll entries now record whether the sender was the GM,
  and show a GM mark beside the name for the GM's entries.
- v1.30 — Refresh the tutorial for the current features: add a chat &
  attachments step and mention hidden rolls, room-code change,
  auto-reconnect and themes across the steps.
- v1.29 — Add six colour themes with a swatch picker in the settings menu;
  the choice is stored in localStorage and applied on startup.
- v1.28 — UI tweaks: the create-room button now wraps before "(become GM)" on
  narrow widths; the dice-count picker is a 5×2 grid; the two roll-kind
  buttons share an equal width.
- v1.27 — Review-driven fixes: clamp the roll dice count to 1-10; an oversized
  image (e.g. a large small-dimensioned PNG) is re-encoded to JPEG rather
  than rejected; the toast timer is cleared on replacement so a rapid
  second toast is not cut short.
- v1.26 — Refactor: split ActivityPanel into FeedList + ChatComposer and a
  useMentionAutocomplete hook; the feed now auto-scrolls to a new entry
  only when the player is already near the bottom.
- v1.25 — Also toast on a player-name change, and switch the name fields'
  notification from a typing debounce to firing on blur / modal close.
- v1.24 — The GM hidden-roll flag is now stored on the pattern, shown in the
  pattern list only to the GM, ignored when a non-GM rolls it, and kept
  through character export / import.
- v1.23 — Review fixes: stop an @mention falsely matching a name that is only
  a prefix ("@Bobby" no longer matches "Bob"); the lightbox arrow keys now
  preventDefault so the background does not scroll, and its key handler
  rebinds only when needed.
- v1.22 — Add chat @mentions: "@username" / "@all" highlight the message for
  the target. Mentions are stored by player id and typing "@" autocompletes
  usernames.
- v1.21 — Add prev/next navigation to the lightbox (swipe, arrow keys,
  on-screen buttons) plus an image counter.
- v1.20 — Each feed entry now stores the character name / background in use at
  the time, so tapping a name shows that character even after the sender
  switches; also tidied the attach-icon and status-bar alignment.
- v1.19 — Let the GM pick the room code when creating a room (a taken code
  errors) and change a live room's code, with players migrating
  automatically and keeping their feed. Room isolation verified across
  multiple tabs.
- v1.18 — Detect unintentional disconnects (a backgrounded tab, a network blip)
  and auto-reconnect to the same room with a backoff, keeping the feed; a
  deliberate "leave" never triggers a reconnect.
- v1.17 — The room join field prefills with the last room code created or
  joined (a code from the URL still takes precedence).
- v1.16 — Pin the connection-error banner to the top of the screen above open
  sheets so a failed join is no longer hidden behind the room modal.
- v1.15 — Add a TURN server to the WebRTC config: the free public Open Relay
  Project TURN is used by default so players behind symmetric NAT or
  UDP-blocking Wi-Fi can connect; `VITE_TURN_*` swaps in a self-owned TURN
  server.
- v1.14 — Add chat file attachments: images show a thumbnail with a tap-to-open
  lightbox, other files show a download chip, and a "Files" feed filter is
  added. Images are downscaled before sending to keep the P2P payload small.
- v1.13 — Tapping a player name in the feed opens a sheet card with that
  player's character name, player name and background.
- v1.12 — Make the header's room/character status open their sheets on tap,
  change the no-character label to "None (as player)", give the participant
  detail a prominent caret, and add an expand/collapse-all button.
- v1.11 — Confirm before replacing a pattern of the same name and kind; the
  empty pattern list now states that patterns are stored per character.
- v1.10 — Add toasts for room/character name changes and pattern saves, a
  confirmation before leaving the page, per-room URLs (shareable /
  copyable link), and a "connecting" indicator while joining a room.
- v1.9 — Rename the feed to match what it holds: "History & Chat" → "Dice &
  Chat", the "rolls" filter label to "Dice" (JA), and the clear
  confirmation text accordingly.
- v1.8 — UI refinements: icon for the player count, truncation of long room /
  character names, pattern reordering, an optional memo in the export
  (off by default), an SVG close icon, a quieter "clear view" button, and
  expandable participant details.
- v1.7 — Add a first-run overlay tutorial that walks through the app, reopenable
  anytime from the settings menu as the in-app help.
- v1.6 — Require a player name on first run (name gate), let the GM name the
  room, and fix wrapping of the feed header (title, filter, clear) on
  mobile.
- v1.5 — Reshape the layout into an app shell for mobile: history & chat is the
  main view, and room / character / dice / patterns open from a bottom
  dock as sheets. The site name, license and GitHub link move into the
  settings menu.
- v1.4 — Add translation-API research, character management (create / switch /
  background / memo / export / import, per-character patterns) and an
  app-like UI (1-10 count buttons, modifier stepper, settings menu).
  `lang` fields are carried on shared data in preparation for translation.
- v1.3 — Review feedback: pattern deletion now confirms; fixed ghost players
  that lingered after an ungraceful disconnect and duplicated on rejoin,
  via a heartbeat and de-duplication of a player's stale connection.
- v1.2 — Review feedback: fixed the IME (e.g. Japanese) send-button race that
  double-sent and failed to clear the box; clearing the feed now confirms.
- v1.1 — Review feedback: named damage text, combined history/chat feed with
  filters, typing indicator, player colors, graceful room close, dimmed
  past-room history, and pattern quick-roll.
