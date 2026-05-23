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

See [CHANGELOG.md](CHANGELOG.md) for the per-version list, in descending order (latest first).
