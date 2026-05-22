# Dice & Chat — Requirements & Implementation Plan

[日本語版](REQUIREMENTS.ja.md)

> Online TRPG sessions made easy. Requirements & implementation plan.

## 1. Overview

An SPA where players roll TRPG dice and share results with other players in real time.

- Hosted as a static site on GitHub Pages
- No backend server; browser-to-browser P2P sync via PeerJS
- Japanese / English UI

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
- Toggle the UI between Japanese and English.
- Language preference stored in localStorage.
- Rolls are synced as data; text is formatted in each viewer's language.

### 3.12 Characters
- Characters are distinct from the player (person).
- A character has a name, public background, private memo, pattern list,
  and an optional portrait image.
- A single portrait image can be attached to a character. On attach and on
  import its size is checked, and an image over ~2560 px on the long edge
  or ~2 MB is automatically downscaled / compressed. It shows as a small
  thumbnail in the character info and opens full size on tap.
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
- Dice count 1-10 is picked from buttons; the modifier uses a −／＋ stepper.
- Low-frequency controls (player name, language, theme) live in a settings menu.
- A colour theme can be picked in the settings — six themes (four dark,
  two light), and the choice is saved per browser.
- A text size (small / medium / large) can be picked in the settings; the
  whole UI scales with it and the choice is saved per browser.
- Character background and memo are collapsible.
- Changing the player / character / room name and saving a pattern is
  confirmed with a toast. For fields without a save button (the names),
  the toast fires when the field loses focus or the modal closes — not
  while typing.
- A confirmation is shown before the page is left (reload, back, close).
- History & chat is the dominant, always-visible view; the header keeps a
  minimal status (room, character, player count).
- Tapping the header's room / character status opens the matching sheet;
  with no character it reads "None (as player)".
- The room sheet's participant detail uses a prominent toggle caret and a
  button to expand / collapse every participant's detail at once.
- Room / character / dice / patterns open on demand from a bottom dock as
  a sheet — a bottom sheet on mobile, a centered modal on desktop.
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
| Test | Vitest | Unit tests for the dice logic |
| Hosting | GitHub Pages + GitHub Actions | Automated build & deploy |

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

Lang        = 'ja' | 'en'

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
```

Player colors are derived by hashing `playerId`, so all clients agree with no sync.

The `lang` fields carry the source language, used as the original language
for chat auto-translation (see [`TRANSLATION_API_RESEARCH.md`](TRANSLATION_API_RESEARCH.md)).

## 7. Implementation Plan

Commit after each step.

1. **Initial commit** — Requirements + project scaffold
2. **Core dice logic** — Dice types, roll math, D100, face computation + unit tests
3. **i18n** — Japanese / English dictionaries and a switcher
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
- [x] Switch between Japanese / English
- [x] Create / switch / export / import characters
- [x] Character name / background shared in the room; memo stays private
- [x] Pick the dice count (1-10) and modifier via buttons / stepper
- [x] Published on GitHub Pages and works in the browser

## 9. Revisions

- v1.1 — Review feedback: named damage text, combined history/chat feed with
  filters, typing indicator, player colors, graceful room close, dimmed
  past-room history, and pattern quick-roll.
- v1.2 — Review feedback: fixed the IME (e.g. Japanese) send-button race that
  double-sent and failed to clear the box; clearing the feed now confirms.
- v1.3 — Review feedback: pattern deletion now confirms; fixed ghost players
  that lingered after an ungraceful disconnect and duplicated on rejoin,
  via a heartbeat and de-duplication of a player's stale connection.
- v1.4 — Add translation-API research, character management (create / switch /
  background / memo / export / import, per-character patterns) and an
  app-like UI (1-10 count buttons, modifier stepper, settings menu).
  `lang` fields are carried on shared data in preparation for translation.
- v1.5 — Reshape the layout into an app shell for mobile: history & chat is the
  main view, and room / character / dice / patterns open from a bottom
  dock as sheets. The site name, license and GitHub link move into the
  settings menu.
- v1.6 — Require a player name on first run (name gate), let the GM name the
  room, and fix wrapping of the feed header (title, filter, clear) on
  mobile.
- v1.7 — Add a first-run overlay tutorial that walks through the app, reopenable
  anytime from the settings menu as the in-app help.
- v1.8 — UI refinements: icon for the player count, truncation of long room /
  character names, pattern reordering, an optional memo in the export
  (off by default), an SVG close icon, a quieter "clear view" button, and
  expandable participant details.
- v1.9 — Rename the feed to match what it holds: "History & Chat" → "Dice &
  Chat", the "rolls" filter label to "Dice" (JA), and the clear
  confirmation text accordingly.
- v1.10 — Add toasts for room/character name changes and pattern saves, a
  confirmation before leaving the page, per-room URLs (shareable /
  copyable link), and a "connecting" indicator while joining a room.
- v1.11 — Confirm before replacing a pattern of the same name and kind; the
  empty pattern list now states that patterns are stored per character.
- v1.12 — Make the header's room/character status open their sheets on tap,
  change the no-character label to "None (as player)", give the participant
  detail a prominent caret, and add an expand/collapse-all button.
- v1.13 — Tapping a player name in the feed opens a sheet card with that
  player's character name, player name and background.
- v1.14 — Add chat file attachments: images show a thumbnail with a tap-to-open
  lightbox, other files show a download chip, and a "Files" feed filter is
  added. Images are downscaled before sending to keep the P2P payload small.
- v1.15 — Add a TURN server to the WebRTC config: the free public Open Relay
  Project TURN is used by default so players behind symmetric NAT or
  UDP-blocking Wi-Fi can connect; `VITE_TURN_*` swaps in a self-owned TURN
  server.
- v1.16 — Pin the connection-error banner to the top of the screen above open
  sheets so a failed join is no longer hidden behind the room modal.
- v1.17 — The room join field prefills with the last room code created or
  joined (a code from the URL still takes precedence).
- v1.18 — Detect unintentional disconnects (a backgrounded tab, a network blip)
  and auto-reconnect to the same room with a backoff, keeping the feed; a
  deliberate "leave" never triggers a reconnect.
- v1.19 — Let the GM pick the room code when creating a room (a taken code
  errors) and change a live room's code, with players migrating
  automatically and keeping their feed. Room isolation verified across
  multiple tabs.
- v1.20 — Each feed entry now stores the character name / background in use at
  the time, so tapping a name shows that character even after the sender
  switches; also tidied the attach-icon and status-bar alignment.
- v1.21 — Add prev/next navigation to the lightbox (swipe, arrow keys,
  on-screen buttons) plus an image counter.
- v1.22 — Add chat @mentions: "@username" / "@all" highlight the message for
  the target. Mentions are stored by player id and typing "@" autocompletes
  usernames.
- v1.23 — Review fixes: stop an @mention falsely matching a name that is only
  a prefix ("@Bobby" no longer matches "Bob"); the lightbox arrow keys now
  preventDefault so the background does not scroll, and its key handler
  rebinds only when needed.
- v1.24 — The GM hidden-roll flag is now stored on the pattern, shown in the
  pattern list only to the GM, ignored when a non-GM rolls it, and kept
  through character export / import.
- v1.25 — Also toast on a player-name change, and switch the name fields'
  notification from a typing debounce to firing on blur / modal close.
- v1.26 — Refactor: split ActivityPanel into FeedList + ChatComposer and a
  useMentionAutocomplete hook; the feed now auto-scrolls to a new entry
  only when the player is already near the bottom.
- v1.27 — Review-driven fixes: clamp the roll dice count to 1-10; an oversized
  image (e.g. a large small-dimensioned PNG) is re-encoded to JPEG rather
  than rejected; the toast timer is cleared on replacement so a rapid
  second toast is not cut short.
- v1.28 — UI tweaks: the create-room button now wraps before "(become GM)" on
  narrow widths; the dice-count picker is a 5×2 grid; the two roll-kind
  buttons share an equal width.
- v1.29 — Add six colour themes with a swatch picker in the settings menu;
  the choice is stored in localStorage and applied on startup.
- v1.30 — Refresh the tutorial for the current features: add a chat &
  attachments step and mention hidden rolls, room-code change,
  auto-reconnect and themes across the steps.
- v1.31 — Feed chat / roll entries now record whether the sender was the GM,
  and show a GM mark beside the name for the GM's entries.
- v1.32 — Opening or reloading with a `?room=CODE` now auto-attempts to join
  that room, with no manual "join" tap needed.
- v1.33 — Every roll / chat / marker is now also appended to a durable
  per-room IndexedDB log — the basis for reload restore, on-demand history
  and export. "Clear view" also clears that room's log.
- v1.34 — Implement resume-after-reload: a per-tab sessionStorage pointer
  records the room and role, so on startup a GM re-hosts the same code and
  a player re-joins; the conversation is restored from the durable log,
  so a GM reload no longer loses the conversation.
- v1.35 — Older history beyond the display cap can now be paged in on demand
  with "Load older". The live window caps rolls / chat / markers
  separately, so it can have internal gaps — the full room log is loaded
  from the durable store in one go, with duplicates dropped when the feed
  is built.
- v1.36 — The room's full history can now be exported to a JSON file.
  "Export history" in the room panel writes the durable log — rolls,
  chat, file attachments and markers, each with its player / character
  snapshot — into a single versioned, self-contained file.
- v1.37 — The history export is now a ZIP archive and carries everything
  needed to restore a room. It holds a `room.json` with the player roster
  and all entries, plus an `attachments/` folder with each chat attachment
  as a real file — no base64 inlined in the JSON, and the archive
  compresses.
- v1.38 — Add room import: an exported ZIP archive can be loaded back to
  restore the room. Offline, "Import history" in the room panel seeds the
  durable log with every entry, restores the feed, and re-hosts the same
  code; attachments are rebuilt into data URLs from the archive's files.
- v1.39 — Improve the participant experience when the GM goes offline: the
  GM's absence is detected from a gap in its periodic keepalive (WebRTC
  is slow to report a lost peer on its own). A banner shows that the GM
  is offline while reconnecting, the retry interval is capped at 5s for
  persistent probing, and after a long outage the participant is notified
  and taken offline. Chat sent during the outage is shown as unsent and
  delivered in order on reconnect.
- v1.40 — Small UX improvements: reconnection now persists up to 60 attempts
  (~5 minutes) before giving up; the Room / Character / Dice / Pattern
  modal titles carry their icons; the dice & chat feed gained a compact
  layout toggle; and editing character details or changing the room code
  now also raises a toast.
- v1.41 — Add chat auto-translation. Settings toggle auto-translate on/off
  and choose the backend (the on-device Chrome Translator API or
  MyMemory — both keyless and backend-free). Each received chat message
  is translated into the UI language and can be flipped between original
  and translation; the original pulses while translating. Results are
  memoized by (backend, source, target, text). Translation lives entirely
  in the display layer and falls back to the original on failure.
- v1.42 — Room export / import now carries chat translations. The archive
  manifest is bumped to v3 and stores cached translation results
  (backend, source / target language, original and translated text);
  on import they reseed the translation cache, so a re-imported room
  shows the same translations without re-translating.
- v1.43 — UI tidy-up for the compact feed. The compact toggle moves from the
  feed header into the settings menu (grouped with the other display
  settings, leaving the header focused on the filter); compact entries
  drop the player-color dot and the "（Player）" half of the name, keeping
  just the character, and a long message now wraps instead of being
  truncated.
- v1.44 — Drop the manual translation-backend switch: the on-device Chrome
  Translator is now the primary with MyMemory as an automatic fallback.
  The memoization key no longer includes a backend, and the export
  manifest is bumped to v4 (cached translations drop the backend tag;
  v3 archives still import). The auto-translate and compact-feed
  settings are shown as ON/OFF toggle switches.
- v1.45 — Unify the feed's time display to `H:mm` (no seconds) and reorder
  the compact row to time · name · content. A date divider — the calendar
  date (in the UI language) centered between two rules — now opens the
  feed and marks each day change.
- v1.46 — A character can carry one portrait image. On attach and on import
  the size is checked against ~2560 px / ~2 MB and anything larger is
  downscaled and JPEG-compressed on a canvas. The image is part of the
  character export JSON, shows as a thumbnail in the character details,
  and opens in the lightbox on tap. The character file is bumped to v2
  (an optional image field; v1 files still import).
- v1.47 — In the compact feed the time is pinned to a fixed left gutter and
  the name and message flow as one block, so a wrapped message lines up
  its later lines under the name. A run of identical consecutive system
  messages is folded into one line with a trailing "(n)" count.
- v1.48 — Add a text-size setting (small / medium / large). It changes the
  root font-size so the whole rem-based UI rescales, and the choice is
  saved per browser.
- v1.49 — Sync the character portrait to the other players in a room. The
  image travels on its own `image` message — separate from the roster —
  and is sent only on change and on joining; the welcome snapshot gains
  an `images` map. The player-detail card shows the other player's
  current portrait and opens it in the lightbox on tap.
- v1.50 — Group the settings panel into titled sections — "Language &
  translation" (language, auto-translate) and "Appearance" (text size,
  compact feed, theme) — each set off by a divider.
- v1.51 — Settings-panel tweaks: the player name now uses the same one-row
  layout, "How to use" moves into the About section, and the panel is a
  little wider so the theme grid no longer overflows — its right edge
  lines up with the other controls.
- v1.52 — The settings panel's close control is now the same × icon button
  used by the other modals.
- v1.53 — Place the settings panel's × button 8px from the frame, matching
  the other modals. On mobile the panel now opens as a full-height
  drawer whose body scrolls when the content overflows.
- v1.54 — Code-review follow-ups: enable TypeScript strict mode; drop the
  page-leave confirmation while offline (not in a room); and harden the
  P2P layer so a client cannot spoof the GM flag or id and only valid
  image data URLs are accepted from the network.
- v1.55 — A client now keeps each chat message in the send queue until the
  host echoes it back, so a message sent during an as-yet-undetected GM
  outage is no longer lost — it stays pending and the reconnect flush
  re-sends it. Consecutive system markers are also folded into a "(n)"
  on the real timeline, before the view filter, so they no longer fold
  across a roll / chat that the current filter hides.
- v1.56 — Limit the settings panel's dropdown layout to viewports that are
  both wide and tall enough to show it un-cramped. On a short desktop
  window the dropdown became a small floating box with the × hovering
  over the content, so there it now falls back to the same full-height
  drawer used on mobile.
- v1.57 — Split the lobby into a home / create / join flow. In-room moves
  the participant roster to the top with portraits, and tucks the
  room-name editor and GM-only code change into a collapsed GM
  `<details>` section with explicit Change buttons. The GM's exit reads
  "Close room".
- v1.58 — Browse and delete past room history. The durable log is now keyed
  by `sessionId` instead of room code (IndexedDB v2 with a new
  `sessions` store), so a reused code or a mid-room code change no
  longer splits a game's history. The lobby gains a "Past rooms" list
  with a read-only feed and per-session / all-sessions deletion.
- v1.59 — Fix the GM losing the room name on reload. The per-tab
  `activeRoom` sessionStorage pointer now carries the room name, kept in
  step on create / rename / code-change / welcome, and restored on
  resume.
- v1.60 — Replace the textual face breakdown with shape icons (SVG). Each
  die's top-down silhouette is drawn with the rolled value inscribed
  (d8 / d20 show a prominent central number; d4 nudges the number up to
  clear the base; d10 is a vertical rhombus; d100 is a circle). The
  icons are decorative — a single visually-hidden text summary backs
  them for AT.
- v1.61 — UI tweaks: drop the "unnamed pattern" placeholder for an unnamed
  judgment roll (it now reads just "Result: N"); shrink the D20 central
  number slightly relative to D8; clip overflow at the app shell so a
  growing feed can no longer scroll the page itself; the character panel
  now shows details inline, the background / memo textareas grow to five
  rows, and the "include memo in export" preference is persisted per
  character (the export / import format itself is unchanged).
- v1.62 — Surface the character snapshot and last-known portrait in the
  past-feed viewer. A new `sessionPortraits` store (IndexedDB v3)
  records every portrait we see — single updates, the welcome snapshot,
  and the host's own portrait at session start — and the history viewer
  gains a player detail sub-view that opens that snapshot when a name is
  tapped.
- v1.63 — Stop past-room clutter from quick visits. A session with no
  user activity (no roll, no chat, no file attachment) is dropped from
  the durable log on exit instead of leaving an empty entry; and
  re-entering the same code reuses the previous still-open session
  (`closed !== true` on `SessionRecord`) so a leave / rejoin or a
  reload-driven re-host stays as one history entry. The GM explicitly
  ending the room (or a client receiving that notice) tags the session
  as closed, after which the next visit to the same code mints a fresh
  entry.
- v1.64 — Ship as an installable PWA. A web manifest (standalone display,
  midnight `theme_color`), PNG icons (192, 512, maskable 512, Apple
  touch 1024) and a precaching service worker (vite-plugin-pwa,
  `autoUpdate`) let the site be added to the iOS / Android home screen
  and launched in a full-screen window without browser chrome. The
  browser favicon switches from the SVG-only setup to a proper `.ico`
  with the SVG kept as a higher-DPI fallback for desktop tabs. The
  service worker only precaches the app shell — offline play is out of
  scope because the app is realtime P2P.
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
- v1.66 — Feed switches to a LINE / Messenger style bubble layout: the
  local player's rolls and chat align right, everyone else's align left.
  A 36 px circular avatar sits next to each entry, showing the
  character's portrait when one is set and falling back to a flat disc
  in the player's color. The roll-kind accent moves from a left border
  to a top border so the cue reads the same whether the row is mirrored
  right or kept left. The compact layout stays a dense one-line feed
  identified solely by the colored character name.
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
