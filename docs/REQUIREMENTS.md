# Dice & Chat — Requirements & Implementation Plan

[日本語版](REQUIREMENTS.ja.md)

> Online TRPG sessions made easy. Requirements & implementation plan.

## 1. Overview

An SPA where players roll TRPG dice and share results with other players in real time.

- Hosted as a static site on GitHub Pages
- No backend server; browser-to-browser P2P sync via PeerJS
- 19-language UI with optional chat auto-translation

## 2. Glossary

| Term | Definition |
|------|------------|
| Dice (A) | Count and type of dice |
| Modifier (B) | Signed integer added to the rolled value |
| Kind (C) | Purpose of a pattern: `damage` or `judgment` |
| Pattern | Combination of A, B and C |
| Result value | Sum of dice rolls + modifier |
| Roll | A single roll act and its result |
| Room | A shared session of players |
| GM | Game master who created the room; also the P2P host |
| Tabletop | The room's map view — a shared space made of a background image, a grid and tokens |
| Token | A piece on the tabletop. PC tokens (tied to a character) and GM-only tokens (for NPCs / monsters / props) |
| Grid | The mesh laid over the tabletop. Square or flat-top hex |
| Fog of war | GM-controlled per-cell visibility; non-GM players only see revealed cells |

## 3. Functional Requirements

### 3.1 Dice (A)
- Choose count and type before each roll
- Types: `D4, D6, D8, D10, D12, D20, D100`
- `D100` = roll two d10 as digits (0–9); tens×10 + ones; `00` reads as 100 (range 1–100).

### 3.2 Modifier (B)
- A signed integer modifier added to the rolled value.

### 3.3 Kind (C)
- Two kinds: `damage` and `judgment`.

### 3.4 Patterns
- A pattern bundles A, B and C.
- Can be saved with a name.
- If a pattern of the same name and kind exists, confirm before replacing it.
- Saved patterns can be recalled and reused.
- Quick-roll a saved pattern in one click.
- Patterns can be reordered; the order is kept through export / import.
- Deleting a pattern requires a confirmation dialog.
- When empty, the list states that this character has no patterns and that
  patterns are stored per character.
- Stored per-browser in localStorage.

### 3.5 Roll output text
- Result value = dice sum + modifier.
- Damage: "`{pattern}` `{value}` damage" ("`{value}` damage" when unnamed).
- Judgment: "Result of `{pattern}` check: `{value}`" ("Result: `{value}`" when unnamed).

### 3.6 Combined history & chat feed
- Every roll is kept in a chronological history.
- History keeps the individual die faces. Each face is rendered in the feed
  as a small SVG icon shaped like the die viewed from above (triangle for
  d4, square for d6, square with corner rays for d8, vertical rhombus for
  d10, pentagon for d12, hexagon for d20, circle for d100) with the value
  inscribed.
- History and chat are merged into a single chronological feed.
- Each entry's time is shown as `H:mm`; a divider carrying the date (in the
  UI language) opens the feed and marks every day change.
- A filter switches between All / Rolls only / Chat only / Files. The
  filter chips are icon-only (with the localised name as the accessible
  label / tooltip) and share a unified visual vocabulary — Lucide for
  All / Chat / Files, and a Game Icons d6 silhouette for Rolls (see
  [CREDITS](CREDITS.md)). The same d6 silhouette is reused for every
  other dice affordance (Dock "Dice", tutorial dice step) so the
  concept reads with a single glyph everywhere.
- Each participant gets a stable color so they are easy to tell apart.
- The feed is laid out as chat-style bubbles: the local player's entries
  align right, every other participant's align left. Each entry shows a
  circular avatar — the character's portrait when one is set, otherwise
  a flat disc in the participant's color.
- Feed entries from the GM show a GM mark next to the name.
- Clearing the feed requires a confirmation dialog to avoid accidental loss.
- A run of identical consecutive system messages (e.g. "X joined") is
  folded into one line with a trailing "(n)" count.
- The settings menu can switch the feed to a compact layout: each entry is
  packed onto one row (time · name · content), the avatar, the player-color
  dot and the "（Player）" suffix are dropped so only the character name
  remains (the colored name identifies the speaker); the time sits in a
  fixed left gutter and a long message wraps with its later lines aligned
  under the name. The choice is remembered in the browser.
- With auto-translate on, chat is translated into the UI language. The
  on-device Chrome Translator is preferred and MyMemory is the automatic
  fallback when it is unavailable. Each message flips back to its
  original, the original animates while translating, and translation
  stays in the display layer, showing the original if both backends fail.
- Older history beyond the display cap can be paged in on demand from the
  durable log with "Load older".
- The room's full history — the player roster, rolls, chat, file
  attachments, the player / character snapshot of each entry and any
  cached chat translations — can be exported to a ZIP archive holding
  everything needed to restore the room.
- An exported ZIP archive can be loaded back to restore the room — it
  reopens with the importer as its host.
- Tapping a name in the feed shows the character's current name,
  player name and background (works on desktop and mobile). A
  character is identified by its `characterId`, so every past entry
  for that character reflects its current name / background /
  portrait — the per-character record in `sessionCharacters` is the
  display authority.

### 3.7 Online sharing
- Create / join a room and share roll history, chat, and the player list.
- The room creator becomes GM and P2P host.
- The create and join screens both surface a hint that the GM acts as
  the room's host, so the GM going offline disconnects everyone — the
  star-topology constraint is made visible before users commit to a room.
- The lobby is split into home → create / join / past rooms. The create
  screen takes the room name and an optional code; the join screen only
  takes the code. Opening with `?room=CODE` jumps straight to the join
  screen with the code prefilled.
- In-room the participant roster is prominent at the top with portraits.
  The room name and code edits are tucked into a collapsed GM-only
  `<details>` section behind explicit "Change name" / "Change code"
  buttons; the GM's exit reads "Close room" to make clear it ends the
  session for everyone.
- When creating a room the GM may choose the room code (blank = random);
  a code already used by another room shows an error.
- The GM can change the code of a live room; players migrate to the new
  code automatically with their feed kept, and other rooms are unaffected.
- The GM can name the room; the room name is shared with all players.
- Everything that happens in a room (rolls, chat, players) stays within
  that room and never affects another room.
- Each room has its own URL (`?room=CODE`); sharing the link lets others join.
- Opening (or reloading) a URL with a `?room=CODE` automatically attempts
  to join that room without waiting for a manual tap.
- Resuming after a reload: a room this tab was the GM of is automatically
  re-hosted under the same code, with the conversation restored from the
  durable log; a player tab simply re-joins. The decision is per-tab, so a
  fresh tab does not resume.
- While a join is in progress, a "connecting" indicator is shown.
- An unintentional disconnect (a backgrounded tab, a network blip) auto-
  reconnects to the same room, retrying at most every 5 seconds; a
  deliberate "leave" never reconnects.
- When the GM goes offline a participant sees a reconnecting banner; if
  the GM stays unreachable too long, the participant is notified and
  taken offline.
- Chat a participant sends while the GM is offline is shown as unsent in
  their own feed and delivered in order once the room reconnects.
- Works standalone offline when not in a room.

### 3.8 GM hidden rolls
- The GM can toggle a "hidden roll" setting.
- When ON, the GM's rolls are broadcast to others with the value hidden.
- Other players only see "The GM made a hidden roll".
- The GM still sees their own value.
- The hidden-roll flag is saved as a pattern attribute. A non-GM using a
  hidden pattern still rolls, but the roll is not hidden. The attribute is
  shown in the pattern list only to the GM, and is preserved through
  character export / import.

### 3.9 Chat
- Room members can exchange text messages.
- Show a subtle "typing…" indicator while another player is typing.
- Both sides of the typing indicator are independently opt-out in the
  settings menu. "Show others typing" silences incoming signals on this
  client; "Broadcast my own typing" stops sending the signal at all.
  Both default on; both are persisted per browser.
- Files can be attached to chat; with no backend they travel as base64 data
  URLs over the P2P channel, and images are downscaled before sending.
- Image attachments show a thumbnail in the feed and open a fullscreen
  viewer (lightbox) on tap; non-images show a download chip.
- The lightbox steps through the feed's other images via a horizontal
  swipe, the arrow keys, or on-screen prev/next buttons.
- The feed filter has a "Files" view listing only messages with an
  attachment.
- "@username" mentions a user and "@all" / "@ALL" mentions everyone; the
  message is highlighted for each mentioned user. Mentions are stored by
  player id, so renames and duplicate names are handled correctly, and
  typing "@" shows a username autocomplete.

### 3.10 Leaving and closing a room
- The GM leaving closes the room: the GM is asked to confirm, and clients
  are told "the GM closed the room" rather than seeing a connection error.
- Room join/leave events are recorded in the feed as system messages.
- After leaving, the feed is kept but past-room entries are dimmed so it
  is clear they belong to a room the player is no longer in.
- Disconnects without pressing "leave" (closed tab, lost network, reload)
  are detected by a heartbeat and removed from the player list. When the
  same player rejoins, the stale connection is dropped so they are never
  listed twice.

### 3.11 i18n
- The UI ships in 19 languages, picked from the settings menu and
  labelled in each language's own script: English, 日本語, Español,
  Português (Brasil), 简体中文, 繁體中文, Deutsch, Français, 한국어,
  Italiano, Русский, ไทย, Türkçe, Bahasa Indonesia, Polski,
  Tiếng Việt, हिन्दी, العربية, Українська.
- Arabic switches the document to `dir="rtl"` so the layout mirrors
  for right-to-left scripts.
- Language preference is stored per browser in localStorage.
- Rolls are synced as data; text is formatted in each viewer's language.
- Chat carries its source language on every message so the auto-translate
  layer can pick the right "from" when translating into the UI language
  (see §3.6 and [`TRANSLATION_API_RESEARCH.md`](TRANSLATION_API_RESEARCH.md)).

### 3.12 Characters
- Characters are distinct from the player (person).
- A character has a name, public background, private memo, pattern list,
  and an optional portrait image.
- A single portrait image can be attached to a character. After the user
  picks a file, a crop dialog opens with a 1:1 aspect lock and a circular
  preview that matches the round avatars used in the feed and roster;
  drag to reposition, slide to zoom, confirm to save. On confirm and on
  import the image is checked, and anything over ~2560 px on the long
  edge or ~2 MB is automatically downscaled / JPEG-compressed. Portraits
  arriving via JSON import skip the crop — they already carry an
  author-chosen frame. It shows as a small thumbnail in the character
  info and opens full size on tap.
- The character portrait is synced to the other players in the room — the
  player-detail card (opened by tapping a name in the feed) shows that
  player's current portrait. The image travels on its own channel, apart
  from the roster, and is sent only when it actually changes.
- Multiple characters can be kept; the active one can be switched freely.
- Acting as a character displays the name as "{character}（{player}）".
- The background is shared with the room; the memo never leaves the device.
- Patterns belong to a character.
- Each character can be exported to / imported from a JSON file; whether
  the private memo is included is a per-character preference, persisted
  locally (off by default), and the portrait image is always included when
  one is set.
- The character details (image / background / memo) are shown inline when
  a character is active — no separate expand toggle.
- In the player list, each row expands to show that player's character
  details (name and background).

### 3.13 App-like UI
- The "Roll dice" sheet lays the dice expression out as one row: count
  (1–10 stepper), die type (`<select>`) and modifier (−／＋ stepper).
  The pre-roll preview spells the expression out as "count × type ±
  modifier" (e.g. `3 × D6 + 2`) tinted with the kind's accent colour,
  so a first-time TRPG player can read what is multiplied by what
  before tapping Roll. The feed's own detail row keeps the compact
  `NdM±k` shorthand TRPG veterans expect.
- Low-frequency controls (player name, language, theme, text size,
  typing toggles) live in a settings menu, grouped under titled
  sections ("Language & translation", "Appearance", "Typing indicator",
  "About").
  Each row carries a Lucide icon next to its label so the panel reads
  as a glanceable list. On a tall enough viewport the menu opens as a
  dropdown; otherwise it falls back to a full-height drawer.
- A colour theme can be picked in the settings — six themes (four dark,
  two light), and the choice is saved per browser.
- A text size (small / medium / large) can be picked in the settings; the
  whole UI scales with it and the choice is saved per browser.
- Character background and memo are shown inline when a character is
  active; their text areas grow to several rows for comfortable editing.
- Changing the player / character / room name and saving a pattern is
  confirmed with a toast. For fields without a save button (the names),
  the toast fires when the field loses focus or the modal closes — not
  while typing.
- A confirmation is shown before the page is left while in a room
  (reload, back, close); offline (not in a room) it is suppressed.
- Every confirmation prompt (clear feed, close room as GM, delete a
  character / pattern / past session, overwrite a pattern, etc.) uses an
  in-app themed dialog rather than the browser's `window.confirm`. The
  cancel button takes initial focus on destructive prompts, and focus
  is restored to the trigger when the dialog closes.
- History & chat is the dominant, always-visible view; the header keeps a
  minimal status (room, character, player count).
- Tapping the header's room / character status opens the matching sheet;
  with no character it reads "None (as player)".
- The room sheet's participant detail uses a prominent toggle caret and a
  button to expand / collapse every participant's detail at once.
- Room / character / dice / patterns open on demand from a bottom dock as
  a sheet — a bottom sheet on mobile, a centered modal on desktop. Every
  sheet pins its title + close `×` in a header row so the title never
  scrolls away when the body is long.
- Every in-app icon comes from a single unified vocabulary: Lucide for
  UI chrome and semantic concepts, and a Game Icons d6 silhouette for
  every dice affordance (see [CREDITS](CREDITS.md)).
- The site name, license and GitHub link are tucked into the settings menu.
- When no player name is set, entering one is required before the app can
  be used (with a note that it can be changed later in the settings).
- On first run, an overlay tutorial walks through how to use the app; it
  can be reopened anytime from the settings menu as the in-app help.

### 3.14 Past room history
- Rolls, chat and markers in a room are persisted to IndexedDB by
  `sessionId`. The same code reused on a different day stays a separate
  session, and a code change mid-room keeps a single continuous one.
- A session that ends without any user activity (no roll, no chat, no
  file attachment) is dropped at exit so a quick join-and-leave does not
  leave an empty history entry behind.
- Re-entering the same room code reuses the previous still-open session
  so brief in-and-outs collapse into one history entry. The GM ending
  the room explicitly (or a client receiving that notice) tags the
  session as closed, after which the next visit to the same code mints a
  fresh entry.
- The last-known portrait of each player in a session is persisted too,
  so the history viewer can show their character image at the time.
- The lobby's "Past rooms" list opens an old session and shows its feed
  read-only, with the same All / Rolls / Chat / Files filter and the
  lightbox for image attachments.
- Tapping a character name in the read-only feed surfaces a player detail
  card built from the entry's snapshot (character name / background) and
  the saved last-known portrait.
- Sessions can be deleted one by one or all at once; a confirmation is
  required, and the matching log, metadata and portraits are all removed
  together.

### 3.15 Tabletop

- A room can open a tabletop. The GM uploads a single background map
  image, places a square grid on top, and tokens — PC tokens and
  GM-only tokens — are placed and moved on it. Players drag tokens
  (PC tokens by the owner and the GM; GM-only tokens by the GM).
- One scene = one background map. The host downscales the upload to
  a long-edge cap of 3000 px and saves it as PNG / JPEG. When the
  result exceeds the P2P 3 MB ceiling, it is split into chunks and
  reassembled on each client. "No background" (grid only) is supported.
- The GM can pick a background map from a local file *or* by URL. A
  URL-loaded image goes through the same downscale + chunked-broadcast
  pipeline as a hand-picked file. Distinct error messages cover the
  URL-specific failure modes: malformed URL, network / CORS failure,
  and "URL resolved but the body is not an image".
- The toolbar also ships an in-app picker for the sibling
  [trpg-map-organizer](https://yamadar.github.io/trpg-map-organizer/)
  gallery (~303 maps across four tag taxonomies). The picker fetches
  the gallery manifest and tag-translations once and keeps them in
  memory. Tag chips follow the UI language: Japanese UI shows the
  source tags verbatim, every other language pulls the English label
  from the gallery's `i18n.json` and falls back to the source tag
  when a translation is missing. Picking a map loads its original-
  resolution WebP through the same URL pipeline (the upstream
  retired the separate mid-resolution JPEG tier — WebP brings the
  bytes close enough that an extra resolution earns nothing).
- Each gallery thumbnail surfaces a magnifier overlay that opens a
  full-screen preview of the same WebP. The preview has
  prev / next buttons (and touch-swipe on mobile) that walk through
  the *currently-filtered* set, sync the underlying grid selection
  on every move, scroll the matching card back into view, and show
  the map's description directly below the picture.
- Background-map source selection is unified into a four-tab UI —
  Upload / Gallery / URL / Preset. Tabs render icons-only with the
  active tab's name and short description rendered just below the
  strip. When a map is already set, the "Replace / Clear" controls
  sit outside the tab strip so a GM can swap files without first
  switching the active source.
- The grid is "none", "square" or "hex". Hex grids are flat-top with
  odd-q offset coordinates (odd columns shifted down by half a cell).
  The GM configures the cell size, origin offset (required to align
  with a grid drawn into the map image), stroke color and stroke
  opacity. Token-drag snapping is toggleable; both square and hex
  snap to the cell centre.
- **Fog of war**: the GM controls visibility one grid cell at a time.
  Enable or disable fog from the toolbar, then use the "reveal / conceal"
  brush to expose or hide individual cells, or "cover all / reveal all"
  for the whole map at once. Non-GM players see nothing beneath the fog
  (background, tokens, text). It is unavailable when the grid is "none"
  and works on both square and hex grids. The state stores the set of
  revealed cells and syncs host-authoritative like the rest of the table.
- Tokens come in two kinds.
  - **PC tokens** are tied to a session character and reuse the
    character portrait as the token image. The owning player *and* the
    GM can move, resize, and remove their own tokens; the host validates
    `canMoveToken` for any resize or remove request that arrives from a
    client. Placement is an explicit action by the owner or the GM, and
    a single character can have multiple tokens on the map (for twin /
    clone fiction).
  - **GM-only tokens** are not tied to a PC (for NPCs, monsters,
    props). Only the GM adds, moves, resizes, removes, or edits the
    label and image of GM tokens. Images go through a dedicated pipeline
    (long-edge 300 px / ~200 KB).
- Any participant may tap a placed token to open a token dialog. The GM
  sees the full editable view; non-owner players see a read-only view
  that also shows who is permitted to operate the token.
- On the canvas, tokens that the viewer cannot move or resize are
  rendered at 0.8 opacity so players can immediately tell which tokens
  they control. In the token list, a player's own PC tokens are
  highlighted with the accent colour for quick identification.
- **Token notes**: every token (PC and GM) carries a **public shared
  note** that all participants can read and edit in the token dialog.
  GM tokens additionally carry a **private GM note** that is stripped
  from every outgoing `tokenUpsert` and `tabletopState` wire message,
  so non-host clients never receive it.
- **Token facing**: a token can carry an optional facing direction. The
  token dialog offers an 8-way compass (plus a clear option) and the
  canvas draws a small direction arrow just outside the token in the
  chosen direction. Facing is operable by the same people who can move
  the token (the owner of a PC token, or the GM), enforced host-side via
  the same `canMoveToken` check as move / resize. It survives reload.
- **HP and status conditions**: a token can carry an optional HP pool
  (current / max) and a set of status-condition markers. The HP pool is
  drawn as a colour-graded bar under the token (green → amber → red as it
  drops), edited via current / max inputs in the token dialog; exact
  numbers are not printed on the canvas. Status conditions are chosen
  from a fixed catalog (poison, stun, sleep, fear, charm, burn, freeze,
  bless, shield, haste, bleed, down) as emoji badges above the token,
  toggled from the dialog. Both follow the same `canMoveToken` permission
  as move / facing, are clamped / sanitised host-side, and survive
  reload.
- The token sidebar is split into two sections.
  - **Tokens on Map** (always visible, at the top): lists all currently
    placed tokens with a type badge ([PC] / [NPC]). Clicking an entry
    highlights the corresponding token on the canvas.
  - **Add / Setup** (collapsible, below): contains the PC placement
    list and the NPC library.
- Before placing on the map the GM can curate an **NPC library**.
  A library entry holds a name, image, and optional note. Adding a new
  entry opens the editor with the name field focused; closing without
  providing a name discards the provisional entry. Placing an entry
  mints a fresh GM token with the image, label, and note copied inline
  — so editing the library entry afterwards does not retroactively
  change tokens already on the table. The same entry can be placed
  multiple times.
- New tokens are placed in a compact 4-column grid (wrapping to a new
  row after every 4 tokens) near the default placement origin. When a
  background map is present the origin is the map's centre; otherwise
  it is the first grid cell. A `pcSpawn` set by a loaded template
  overrides both.
- Token positions are stored in pixels and snapped to the grid at
  render time (free placement when snapping is off).
- Sync follows the existing host-authoritative / last-write-wins model.
  Position updates during a drag are throttled to ~20 Hz and the
  final position is sent on drag end. Receiving clients render
  optimistically and the host's confirmation is the source of truth.
- Late joiners and reload resumers receive the tabletop state
  (background, grid, tokens) via the host's welcome snapshot.
- The tabletop state is persisted to IndexedDB per `sessionId` and
  restored across reload. Room export ZIPs grow to include
  `table.json` and `attachments/maps/*` (manifest bumped to v6).
- The GM can also save the current tabletop under a name into a
  **tabletop library**. This library is stored globally in IndexedDB
  (`tabletopLibrary` store, DB v8), not per-session, so a GM can
  prepare scenes ahead of time and load them into any room. It is a
  reusable, device-wide shelf — distinct from *scenes*, which live only
  inside the current game (the panel says so up front). Saving has two
  independent choices:
  - **Scope** — *this scene* (only the current scene) or *whole table*
    (every scene). Before scenes existed a save always captured the
    whole state, silently embedding every other scene; the scope picker
    makes the unit explicit.
  - **Kind** — **Template**: a starting layout with PC tokens *and* pen
    strokes stripped from **every** saved scene (text labels and fog are
    kept as scenario setup), plus the viewport centre stashed as
    `pcSpawn`. **Snapshot**: the full state including PC tokens. A
    multi-scene entry shows a scene-count badge.
  Each entry offers two distinct loads:
  - **Replace table** — discards every current scene and swaps in the
    entry's scene(s).
  - **Add as scene** — splices the entry's scene(s) into the current
    session as new scenes (keeping the GM's existing scenes) and
    switches to the first one — the bridge that lets a GM prepare
    material in the library and bring it into a live game.
  Either load broadcasts a fresh `tabletopState` to every client; the
  map image streams through the existing `mapMeta` / `mapChunk`
  path so a multi-megabyte background does not block the data
  channel.
- **Multiple maps per session (scenes)**: the GM can keep several
  scenes, each with its own map, grid, tokens, annotations and fog, and
  switch the active one from a "Scenes" list in the toolbar (add /
  rename / delete; the last scene cannot be deleted). The NPC library
  and PC spawn point stay shared across scenes. Switching the active
  scene changes what every participant sees; scenes are otherwise a
  GM-only concept — the inactive scenes are not sent to clients, who
  only ever mirror the current scene. Scenes persist across reload and
  are carried (with every scene's map) in the room export / import.
- **Ping ("look here")**: any participant can pick the ping tool and tap
  the map to drop a transient attention marker — an expanding ripple in
  their player colour with their name beneath — that is broadcast to
  everyone and fades after a couple of seconds. A ping is *ephemeral*:
  unlike tokens and annotations it is never written to the tabletop
  state, so it is not persisted, not part of the welcome snapshot, and
  not exported. The host stamps the sender's id (a client cannot spoof
  another player's colour) and validates the coordinates before
  re-broadcasting.
- Rolling dice from the tabletop triggers the unread-activity dot on
  the chat icon, the same as a chat message. A die icon also animates
  outward from the rolling player's character token on the canvas,
  giving participants watching the map a visible cue.
- On mobile the tabletop is shown as a **full-screen mode** rather
  than a Dock sheet. The Dock's tabletop icon opens it and a
  dedicated close button leaves it. To keep chat and rolls visible
  during play, the feed is shown as a height-adjustable swipe-up
  bottom sheet with a grip handle. Desktop uses the same full-screen
  mode.
- Interactions: pan (two-finger touch, mouse right-drag or
  Space + drag), zoom (pinch / mouse wheel, 25% – 400%), token drag
  (single-tap + drag). Pinch and drag are never combined in the same
  gesture (Konva-recommended pattern).
- **Keyboard control**: when the tabletop has focus (and no text field
  is being edited), the arrow keys move the selected token one grid cell
  at a time; `1`–`5` (and the letter aliases V/T/P/E/G) switch tools;
  `+` / `-` / `0` zoom in / out / reset; `f` centres the view on the
  selection; `[` / `]` select the previous / next operable token;
  `Delete` removes the selected token; `Esc` deselects (then closes);
  and `?` toggles an on-screen shortcuts cheat sheet. Movement obeys the
  same `canMoveToken` permission as dragging.
- **Minimap**: a collapsible corner overview shows the whole current
  scene — the background map (or a fitted blank region), a dot per token
  and a rectangle marking the current viewport. Clicking or dragging the
  minimap recenters the camera on that part of the scene.

## 4. Non-functional

- Single-page application.
- Fully static; no own server.
- Responsive layout (desktop / mobile).
- Installable as a PWA: a web manifest, full-size icons (192 / 512 /
  maskable / 1024 for Apple touch) and a precaching service worker let
  the site be added to the iOS / Android home screen and launched in a
  standalone window without browser chrome. Offline is out of scope —
  the app is realtime P2P — so the service worker only precaches the
  app shell.
- MIT License.

## 5. Tech Stack

| Area | Choice | Reason |
|------|--------|--------|
| Build | Vite | Fast, static output |
| UI | React 19 + TypeScript | Type-safe SPA |
| Realtime | PeerJS (WebRTC P2P) | No backend; compatible with GitHub Pages |
| Persistence | localStorage + IndexedDB | localStorage for name/language/characters, IndexedDB for the per-session log, metadata and portraits |
| Canvas | react-konva | 2D rendering for the tabletop; Stage scale / position drives pan / zoom |
| Icons | lucide-react + a single Game Icons d6 SVG | One unified visual vocabulary |
| Image crop | react-easy-crop | 1:1 portrait crop with circular preview |
| ZIP archives | fflate | Room export / import packaged as a `.zip` |
| PWA | vite-plugin-pwa | Web manifest + service worker (app-shell precache) |
| Test | Vitest | Unit tests across dice, format, feed, storage, chat, players, characters, net, i18n and theme |
| Hosting | GitHub Pages + GitHub Actions | Automated build & deploy |

Third-party asset attribution (Lucide, Game Icons, etc.) lives in
[`CREDITS.md`](CREDITS.md).

### Realtime model

Star topology: the GM is the host; all players connect to the GM, who holds the
authoritative shared state and relays events to everyone.

NAT traversal uses TURN relays in addition to STUN. By default the free public
Open Relay Project TURN servers are used so players behind symmetric NAT or
UDP-blocking public Wi-Fi can still connect; the `VITE_TURN_*` build variables
swap in a self-owned TURN server (see `.env.example`). A TURN server only relays
traffic, so the app stays a fully static site.

## 6. Data Model

> A conceptual sketch — only the key fields, drawn from the implementation
> types. Flag / snapshot fields like `Pattern.hidden`, `RollResult.isGM` and
> `ChatMessage.file` are kept out of the sketch; see the source for the
> full shape.

```ts
DiceType   = 'D4'|'D6'|'D8'|'D10'|'D12'|'D20'|'D100'
PatternKind = 'damage' | 'judgment'

Lang        = 'en' | 'ja' | 'es' | 'pt-BR' | 'zh-CN' | 'zh-TW' | 'de'
            | 'fr' | 'ko' | 'it' | 'ru' | 'th' | 'tr' | 'id' | 'pl'
            | 'vi' | 'hi' | 'ar' | 'uk'

Pattern    = { id, name, kind, diceType, diceCount, modifier }
// RollResult / ChatMessage carry just `(playerId, characterId)` for
// the speaker. Display name / character name / background / GM mark
// come from the matching `sessionCharacters` record at render time
// (v1.74 retired the inline snapshot fields).
RollResult = { id, patternName, kind, diceType, diceCount,
               faces: number[], modifier, value, playerId, characterId,
               hidden, timestamp }
ChatMessage = { id, playerId, characterId, text, timestamp, lang, ... }
// Player carries the active character's public info; memo is never synced.
Player      = { id, name, isGM, characterId, characterName, background, lang }
Character   = { id, name, background, memo, patterns: Pattern[], lang,
                image?, exportMemo? }

// A live room's identity for the durable log: `sessionId` is minted once
// per create / join and stays stable across reloads, reconnects and code
// changes, so each game keeps a single continuous log. Re-entering the
// same code while the previous session is still open (`closed !== true`)
// reuses that same id instead of minting a new one.
SessionId   = string  // e.g. "s-mfp7n7z9-9wk2x4"
SessionRecord = { sessionId, code, name, role: 'host'|'client'|'unknown',
                  firstAt, lastAt, closed? }
// Per-(player, character) records for past-room history (IndexedDB v5).
// Carry the portrait and the speaker fields the past-rooms feed needs
// to render entries without the live session. `characterId` is either
// the live `Character.id`, the migrated `@n:<encoded characterName>`,
// or `''` (the player acting directly).
SessionCharacterRecord = { sessionId, playerId, characterId,
                           playerName, characterName, background,
                           isGM, image, updatedAt }

// Local-only feed annotations (not synced); they record room events.
MarkerType  = 'created'|'joined'|'youLeft'|'youClosed'
            | 'gmClosed'|'hostLost'|'playerJoined'|'playerLeft'
            | 'reconnecting'|'reconnected'|'reconnectFailed'|'codeChanged'
SystemMarker = { id, timestamp, type: MarkerType, roomCode?, playerName? }
FeedItem    = roll | chat | system marker, merged and sorted by time

// Tabletop shared state, host-authoritative and seeded via the welcome
// snapshot. The background image is chunked over P2P when over 3 MB.
TabletopState = {
  map?: { id, name, width, height, dataUrl },
  grid: { kind: 'none'|'square'|'hex', cellSize, originX, originY,
          strokeColor, strokeOpacity, snap },  // hex is flat-top, odd-q
  tokens: Token[],
  npcLibrary: NpcDef[],          // GM's NPC stash, independent of placement
  pcSpawn?: { x, y },            // set by templates; initial PC drop point
  fog: FogState                  // per-cell fog of war (GM-only edits)
}
FogState = {
  enabled: boolean,              // master on/off for the fog layer
  revealed: string[]             // revealed cells as "col,row" (the rest is fog)
}
Token = {
  id, kind: 'pc'|'gm',
  x, y,                  // pixel position; snapped to the grid at render time
  ownerPlayerId?: string // pc: the character's owner; gm: undefined
  characterId?: string   // pc only
  image?: string         // gm only (pc reuses the character portrait)
  label?: string         // gm: optional display label
}
NpcDef = { id, name, image }     // NPC library entry — placement template

// GM's tabletop library. Stored globally (not per-session) in IndexedDB so
// scenes can be prepared ahead and reused across rooms.
SavedTabletop = {
  id, name,
  kind: 'template'|'save',       // template strips PC tokens; carries pcSpawn
  state: TabletopState,
  createdAt, updatedAt
}
```

Player colors are derived by hashing `playerId`, so all clients agree with no sync.

The `lang` fields carry the source language, used as the original language
for chat auto-translation (see [`TRANSLATION_API_RESEARCH.md`](TRANSLATION_API_RESEARCH.md)).

## 7. Implementation Plan

Commit after each step.

1. **Initial commit** — Requirements + project scaffold
2. **Core dice logic** — Dice types, roll math, D100, face computation + unit tests
3. **i18n** — Per-language dictionaries and a switcher (started with Japanese / English; the UI now ships in 19 languages)
4. **Patterns** — Pattern creation UI and localStorage save / recall
5. **Realtime + Chat + Hidden rolls** — PeerJS rooms, chat, GM hidden rolls
6. **UI assembly & styling** — Screen composition, responsive styles
7. **Tests & review** — Test setup, self-review and fixes
8. **Docs & deploy** — README, LICENSE, GitHub Actions, publish to GitHub Pages

## 8. Acceptance Criteria

- [x] Roll any of the six basic dice plus D100, choosing the count
- [x] Configure modifier and kind, with the value computed correctly
- [x] Damage (with pattern name) / judgment text matches the spec
- [x] Save, recall and quick-roll patterns
- [x] History and chat merged into one feed with filtering
- [x] Typing indicator
- [x] Participants distinguishable by colour
- [x] Create / join a room and share history / chat
- [x] Closing a room as GM notifies every player correctly
- [x] After leaving, past-room history is clearly marked
- [x] GM hidden rolls are hidden from other players
- [x] Switch between any of the 19 supported UI languages
- [x] Create / switch / export / import characters
- [x] Character name / background shared in the room; memo stays private
- [x] Pick the dice count (1-10), die type and modifier via stepper / select
- [x] Published on GitHub Pages and works in the browser
- [x] The GM can upload a background map and it is synced to every participant
- [x] The GM can also load a background map by URL, with the same sync
- [x] An in-app picker browses the trpg-map-organizer gallery (tags + search)
- [x] The square grid's cell size, offset, color and opacity can be configured
- [x] A flat-top hex grid (odd-q offset) can be selected and tokens snap to the cell centre
- [x] The GM controls visibility with per-cell fog of war; non-GM players cannot see beneath the fog
- [x] PC tokens are generated from the session's characters and can be moved, resized and removed by the owner and the GM
- [x] A player can place multiple tokens of their own character at any time
- [x] GM-only tokens can be added, moved, resized and removed by the GM
- [x] Tapping any token opens an editable dialog (GM) or a read-only dialog (non-owner)
- [x] Every token has a public shared note editable by all participants; GM tokens additionally have a private GM note never broadcast to clients
- [x] A token can be given a facing direction (8-way compass) that draws a direction arrow and survives reload
- [x] A token can carry an HP pool (bar) and status-condition badges, edited from the token dialog and surviving reload
- [x] The token sidebar shows "Tokens on Map" at the top and a collapsible "Add / Setup" section below
- [x] Own PC tokens are highlighted in the token list; non-operable tokens on the canvas are shown at reduced opacity
- [x] The GM can register NPCs in a library (with name, image and note) and place them on the map repeatedly
- [x] The GM can save the current tabletop as a template / snapshot and load it later
- [x] The GM can keep multiple scenes (each its own map / tokens / fog) and switch the active one; scenes persist and export
- [x] Any participant can drop a transient "look here" ping that broadcasts to everyone and fades out
- [x] Pan and zoom work on both touch and mouse
- [x] Keyboard shortcuts move the selected token, switch tools, zoom, delete, and show a cheat sheet (?)
- [x] A corner minimap shows the scene, tokens and viewport, and clicking it recenters the camera
- [x] The tabletop state is restored across reload
- [ ] On mobile, the tabletop is shown full-screen with a swipe-up bottom sheet for the feed
- [ ] The exported ZIP carries the tabletop state and importing restores it

## 9. Revisions

See [CHANGELOG.md](CHANGELOG.md) for the per-version list, in descending order (latest first).
