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
  `00` reads as 100.
- **Modifier (B) / 補正** — apply a signed `+/-` modifier to the result.
- **Kind (C) / 種類** — `damage` or `judgment`. Damage shows `{value} damage`;
  judgment shows `Result of {pattern} check: {value}`.
- **Patterns / パターン** — bundle A + B + C, name it, save it, and reload it
  later (stored in your browser).
- **History / 履歴** — every roll is kept in a chronological log.
- **Online rooms / オンラインルーム** — create a room to become the GM, or join
  one with a 6-character code. History, chat and the player list are shared
  peer-to-peer.
- **GM hidden rolls / GM の隠しロール** — the GM can hide a roll's value; other
  players only see that a hidden roll happened.
- **Chat / チャット** — text chat for everyone in the room.
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

The full requirements and implementation plan are in
[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md).

## License / ライセンス

[MIT](LICENSE) © 2026 yamadar
