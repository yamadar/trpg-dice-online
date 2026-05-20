# TRPG Online Dice / オンラインダイス

An online dice roller for tabletop RPG sessions. Roll dice, save reusable
patterns, and share results, history and chat with your party in real time —
all from a static page with no backend server.

TRPG セッション用のオンラインダイスローラーです。ダイスを振り、再利用できる
パターンを保存し、結果・履歴・チャットを仲間とリアルタイムで共有できます。
バックエンドサーバーを持たない完全な静的サイトです。

**🎲 Live demo / デモ:** https://yamadar.github.io/trpg-dice-online/

## Features / 機能

- **Dice (A) / ダイス** — choose the count and type before every roll
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` rolls two d10 as digits, where
  `00` reads as 100. Rolled face values appear as small shape icons that
  match each die's top-down silhouette.
- **Modifier (B) / 補正** — apply a signed `+/-` modifier to the result.
- **Kind (C) / 種類** — `damage` or `judgment`. Damage shows
  `{pattern} {value} damage`; judgment shows `Result of {pattern} check: {value}`,
  or just `Result: {value}` when no pattern name is set.
- **Characters / キャラクター** — keep multiple player characters (name,
  shared background, private memo, optional portrait, pattern list, per-
  character "include memo in export" preference), switch between them, and
  export / import them as JSON. Acting as a character shows the name as
  `Character（Player）`.
- **Patterns / パターン** — bundle A + B + C, name it, save it (per character),
  and reload it later. Quick-roll a saved pattern in one click.
- **History & Chat feed / 履歴とチャット** — rolls and chat share one
  chronological feed with an All / Rolls / Chat / Files filter.
- **Past room history / 過去のルーム履歴** — every past session is kept in
  a durable per-session log; browse the read-only feed of an old room from
  the lobby and delete sessions one by one or all at once. Tapping a player
  name in the past feed shows the character snapshot and last-known portrait.
- **Online rooms / オンラインルーム** — separate Create / Join screens lead
  to a 4-8 character room code; history, chat and the player list are shared
  peer-to-peer. Joining keeps your pre-join rolls, and a reload re-hosts
  (GM) or re-joins (player) the same room automatically.
- **GM controls / GM 専用設定** — the GM section bundles room renaming and
  code change behind a collapsed disclosure, and the GM's exit reads
  "Close room" so it is clear it ends the session for everyone.
- **GM hidden rolls / GM の隠しロール** — the GM can hide a roll's value; other
  players only see that a hidden roll happened.
- **Player colors & typing indicator / 参加者カラーと入力中表示** — every
  participant gets a stable color, and a subtle indicator shows who is typing.
- **Room awareness / ルーム状況** — join/leave events appear in the feed, and
  closing the room as GM notifies every player gracefully.
- **Bilingual / 多言語** — switch the UI between Japanese and English.

## How online sharing works / オンライン共有の仕組み

The app uses **WebRTC peer-to-peer connections via [PeerJS](https://peerjs.com/)**.
The room creator (GM) acts as the host; every other player connects directly to
the GM, who relays the shared state. No data passes through any server owned by
this project. Because it is peer-to-peer, the room stays open only while the GM
keeps the page open.

ルーム作成者（GM）がホストとなり、他のプレイヤーは GM に直接接続する P2P 方式
です。GM がページを開いている間だけルームは有効です。

## Tech stack / 技術スタック

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) for WebRTC peer-to-peer rooms
- [Vitest](https://vitest.dev/) for unit tests
- GitHub Pages + GitHub Actions for hosting

## Development / 開発

```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm test         # run the unit tests
npm run lint     # lint the source
npm run build    # production build into dist/
```

## Deployment / デプロイ

Pushing to `main` triggers the GitHub Actions workflow
(`.github/workflows/deploy.yml`), which lints, tests, builds and publishes to
GitHub Pages. The production base path is `/trpg-dice-online/`; override it with
the `BASE_PATH` environment variable when hosting elsewhere.

## Documentation / ドキュメント

- Requirements and implementation plan: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Real-time translation API research: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## License / ライセンス

[MIT](LICENSE) © 2026 yamadar
