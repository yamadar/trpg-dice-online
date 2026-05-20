# TRPG Online Dice

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

An online dice roller for tabletop RPG sessions. Roll dice, save reusable
patterns, and share results, history and chat with your party in real time —
all from a static page with no backend server.

**🎲 Live demo:** https://yamadar.github.io/trpg-dice-online/

## Features

- **Dice (A)** — choose the count and type before every roll
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` rolls two d10 as digits, where
  `00` reads as 100. Rolled face values appear as small shape icons that
  match each die's top-down silhouette.
- **Modifier (B)** — apply a signed `+/-` modifier to the result.
- **Kind (C)** — `damage` or `judgment`. Damage shows
  `{pattern} {value} damage`; judgment shows `Result of {pattern} check: {value}`,
  or just `Result: {value}` when no pattern name is set.
- **Characters** — keep multiple player characters (name, shared background,
  private memo, optional portrait, pattern list, per-character "include memo
  in export" preference), switch between them, and export / import them as
  JSON. Acting as a character shows the name as `Character（Player）`.
- **Patterns** — bundle A + B + C, name it, save it (per character), and
  reload it later. Quick-roll a saved pattern in one click.
- **History & Chat feed** — rolls and chat share one chronological feed with
  an All / Rolls / Chat / Files filter.
- **Past room history** — every past session is kept in a durable per-session
  log; browse the read-only feed of an old room from the lobby and delete
  sessions one by one or all at once. Tapping a player name in the past feed
  shows the character snapshot and last-known portrait.
- **Online rooms** — separate Create / Join screens lead to a room code
  (at least 4 characters; auto-generated codes are 6); history, chat and the
  player list are shared peer-to-peer. Joining keeps your pre-join rolls, and
  a reload re-hosts (GM) or re-joins (player) the same room automatically.
- **GM controls** — the GM section bundles room renaming and code change
  behind a collapsed disclosure, and the GM's exit reads "Close room" so it
  is clear it ends the session for everyone.
- **GM hidden rolls** — the GM can hide a roll's value; other players only
  see that a hidden roll happened.
- **Player colors & typing indicator** — every participant gets a stable
  color, and a subtle indicator shows who is typing.
- **Room awareness** — join/leave events appear in the feed, and closing
  the room as GM notifies every player gracefully.
- **Multilingual** — the UI is available in 19 languages.

## How online sharing works

The app uses **WebRTC peer-to-peer connections via [PeerJS](https://peerjs.com/)**.
The room creator (GM) acts as the host; every other player connects directly to
the GM, who relays the shared state. No data passes through any server owned by
this project. Because it is peer-to-peer, the room stays open only while the GM
keeps the page open.

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

## Deployment

Pushing to `main` triggers the GitHub Actions workflow
(`.github/workflows/deploy.yml`), which lints, tests, builds and publishes to
GitHub Pages. The production base path is `/trpg-dice-online/`; override it with
the `BASE_PATH` environment variable when hosting elsewhere.

## Documentation

- Requirements and implementation plan: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Real-time translation API research: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## License

[MIT](LICENSE) © 2026 yamadar
