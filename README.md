<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>A pocket-sized dice room for your TRPG night.</strong></p>

<p align="center">
  Open the page, share a short room code, and your whole party can roll together —<br/>
  no accounts, no installs, no game server. Just the link and the dice.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Open the live demo →</strong></a>
</p>

<p align="center">
  <em><strong>Languages:</strong></em>
  <a href="README.md">English</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.hi.md">हिन्दी</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.uk.md">Українська</a>
</p>

<p align="center">
  <img src="public/images/lobby-mobile.png" width="280" alt="Empty lobby on a phone with the Dice & Chat brand mark" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="A live feed of rolls and chat side by side" />
</p>

## Why pick this for your next session

- **Share a code, start rolling.** The GM creates a room and reads the 4–6 character code aloud; everyone else types it in. No accounts, no email confirmations, nothing to sign up for.
- **Your rolls stay between you.** Pure peer-to-peer over WebRTC — rolls and chat travel from one device to another, not through any server we run.
- **Sits comfortably in a phone at the table.** Mobile-first layout, installable as a PWA on iOS and Android, launches full-screen.
- **Speaks 19 languages, and translates chat for you.** Your German cleric can banter with the Japanese rogue without anyone breaking immersion.
- **Built to be re-opened.** Characters, patterns, themes, fonts and your past sessions are all kept locally, so the app feels like *your* dice tin — not a guest at a kiosk.

## Start a session in 30 seconds

1. **GM:** open the demo, tap **Room → Create**, read the code aloud.
2. **Players:** open the demo, tap **Room → Join**, type the code.
3. **Everyone:** roll, chat, react to the first natural 20 together.

The GM is the host: as long as their tab stays open, the room stays open. Closing the tab ends the session — past rooms are kept locally so anyone can re-read the log later.

## Inside the dice tin

### Dice you can actually read

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, with count, signed modifier and a **damage / judgment** kind that phrases the result the way the table would say it — *"Result of Perception check: 18"*, *"Greatsword: 11 damage"*. Each rolled face shows as a small shape matching the die's silhouette so it reads at a glance.

### Patterns — your party tricks, one tap away

Save `2D6 + 3 — damage` under a name like *"Greatsword"* and replay it next round in one tap. Patterns belong to characters, so two PCs on the same device keep their own loadouts.

### Characters with portraits, memos and personal patterns

Multiple PCs per player. Each has a name, a shared background, a private memo only you can see, an optional portrait, a per-character pattern list, and a per-character "include memo in export" preference. Export to JSON for backup; import on another device to bring the PC to the next session. Names are shown as `Character (Player)` whenever someone is acting as a PC.

### One feed for rolls *and* chat

Rolls and chat share one chronological timeline with an **All / Rolls / Chat / Files** filter. `@`-mention autocomplete pings the right player; `@all` reaches everyone. Attach an image to a chat message and it's downscaled automatically before it ships.

### Past rooms you can re-read

Every past session is stored locally as a durable log. Open an old room from the lobby in read-only mode; tap a player name in the old feed to see their character snapshot and last-known portrait. Export a whole room (chat, rolls, images) as a single ZIP.

### Tools for the GM

The GM can roll **hidden** — other players only see *"a hidden roll happened"* and not the number. The GM section also bundles room renaming and code regeneration behind a disclosure, and the GM's exit reads **Close room** so it's clear it ends the session for everyone.

### Multilingual UI &amp; auto-translated chat

UI in 19 languages. Optional chat auto-translation uses the on-device Chrome Translator API when available and falls back to the keyless [MyMemory](https://mymemory.translated.net/) REST API. Tap **Original** on a translated message to see exactly what was sent.

### A few quality-of-life touches

Stable per-player colour, subtle typing indicator, join / leave events in the feed, themeable look, adjustable font size, and graceful behaviour when the GM closes the room.

## Install on your phone (PWA)

The site is a Progressive Web App, so it can be installed to the home screen on iOS and Android and launched full-screen — no browser chrome, near-instant repeat launches.

- **Android (Chrome):** open the demo, tap the browser menu, choose **Install app** (or *Add to Home screen*).
- **iOS (Safari):** open the demo, tap share, choose **Add to Home Screen**.

The app shell is precached by a service worker so it opens immediately on relaunch, but rooms themselves are peer-to-peer over WebRTC and still need a live network connection.

**Screen orientation:** the manifest doesn't lock or override orientation, so the installed PWA follows the device's own auto-rotate / rotation-lock setting (e.g. on Android, turning auto-rotate off will keep the app in its current orientation even if you tilt the device).

## How online sharing works

Rooms use **WebRTC peer-to-peer** via [PeerJS](https://peerjs.com/). The room creator (GM) is the host; every other player connects directly to the GM, who relays the shared state. No game data passes through any server owned by this project. Because it's peer-to-peer, the room stays open only while the GM keeps their tab open.

## Tech stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) for WebRTC peer-to-peer rooms
- [Vitest](https://vitest.dev/) for unit tests
- GitHub Pages + GitHub Actions for hosting

## Development

```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm test         # run the unit tests
npm run lint     # lint the source
npm run build    # production build into dist/
```

## Configuration (optional TURN relay)

WebRTC needs a TURN relay to connect players whose networks block UDP or use symmetric NAT (common on café / public Wi-Fi). By default the app uses the Open Relay Project's free public TURN servers — fine for casual use, but best-effort.

For a dependable relay, copy `.env.example` to `.env` and set:

- `VITE_TURN_URLS` — comma-separated TURN URLs. Include a TCP/443 `turns:` entry so it works where UDP is blocked.
- `VITE_TURN_USERNAME` — TURN username.
- `VITE_TURN_CREDENTIAL` — TURN credential / password.

> **Security note:** Vite inlines every `VITE_*` variable into the production bundle, so any TURN credentials set here are visible to anyone who loads the page. Use short-lived / ephemeral TURN credentials (e.g. the TURN REST API time-limited credential pattern) and configure provider-side limits — allowed origins, IP filtering or monthly quotas. Don't reuse long-lived production credentials here.

To use these in the GitHub Pages deploy, add them as repository secrets and pass them through the build step in `.github/workflows/deploy.yml`. Free options include a [Metered](https://www.metered.ca/) free tier or self-hosting [coturn](https://github.com/coturn/coturn).

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which lints, tests, builds and publishes to GitHub Pages. The production base path is `/trpg-dice-online/`; override it with the `BASE_PATH` environment variable when hosting elsewhere.

## Documentation

- Requirements and implementation plan: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Real-time translation API research: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## License

[MIT](LICENSE) © 2026 yamadar
