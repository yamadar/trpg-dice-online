# TRPG オンラインダイス — 要件定義 / 実装プラン

> Online dice roller for TRPG sessions. Requirements & implementation plan.
> 日本語と English を併記します。

## 1. 概要 / Overview

オンラインで各種ダイスを振り、結果を他のプレイヤーとリアルタイムで共有できる SPA。
An SPA where players roll TRPG dice and share results with other players in real time.

- 静的サイトとして GitHub Pages にホストする / Hosted as a static site on GitHub Pages
- バックエンドサーバーを持たず、ブラウザ間 P2P (PeerJS) で同期する / No backend server; browser-to-browser P2P sync via PeerJS
- 日本語 / English 切り替え対応 / Japanese / English UI

## 2. 用語 / Glossary

| 用語 | English | 定義 / Definition |
|------|---------|-------------------|
| ダイス (A) | Dice | 振るサイコロの「個数」と「種類」 / Count and type of dice |
| 補正 (B) | Modifier | 出た値に加減する整数 / Signed integer added to the rolled value |
| 種類 (C) | Kind | パターンの用途。`ダメージ` / `判定` の二種 / `damage` or `judgment` |
| パターン | Pattern | A + B + C の組み合わせ / Combination of A, B and C |
| 出目 | Result value | ダイスの合計 + 補正 / Sum of dice rolls + modifier |
| ロール | Roll | パターンを実際に振った一回の行為と結果 / A single roll act and its result |
| ルーム | Room | プレイヤーが集まる共有セッション / A shared session of players |
| GM | GM | ルームを作成したゲームマスター。ホストを兼ねる / Game master who created the room; also the P2P host |

## 3. 機能要件 / Functional Requirements

### 3.1 ダイス (A)
- 振る前に毎回「個数」と「種類」を指定できる / Choose count and type before each roll
- 種類: `D4, D6, D8, D10, D12, D20, D100`
- `D100` は D10 を 2 個振り、片方を 10 の位、もう片方を 1 の位として算出する。
  両方が 0 のときは 100 とする（範囲 1–100）。
  `D100` = roll two d10 as digits (0–9); tens×10 + ones; `00` reads as 100 (range 1–100).

### 3.2 補正 (B)
- 出目に対しプラス／マイナスの整数補正をかけられる / A signed integer modifier

### 3.3 種類 (C)
- `ダメージ / damage` と `判定 / judgment` の二種類 / Two kinds

### 3.4 パターン
- A + B + C を 1 つのパターンとして扱う / A pattern bundles A, B and C
- 名前を付けて保存できる / Can be saved with a name
- 保存したパターンは一覧から呼び出して再利用できる / Saved patterns can be recalled and reused
- 一覧からワンクリックで直接振れる（クイックロール）/ Quick-roll a saved pattern in one click
- パターンの削除は誤操作防止のため確認ダイアログを必須とする
  Deleting a pattern requires a confirmation dialog
- 保存先はブラウザの localStorage（個人ごと） / Stored per-browser in localStorage

### 3.5 ロールと出目の表記 / Roll output text
- 出目 = ダイス合計 + 補正 / Result value = dice sum + modifier
- 種類が `ダメージ`: 「`{パターン名}` `{出目}`ダメージ」（名前なしは「`{出目}`ダメージ」）
  Damage: "`{pattern}` `{value}` damage" ("`{value}` damage" when unnamed)
- 種類が `判定`: 「`{パターン名}` 判定の結果 `{出目}`」/ "Result of `{pattern name}` check: `{value}`"

### 3.6 履歴とチャットの統合表示 / Combined history & chat feed
- すべてのロール結果を時系列の履歴として残す / Every roll is kept in a chronological history
- 履歴にはダイスの内訳（各目）も保持する / History keeps the individual die faces
- 履歴とチャットは 1 つのフィードに時系列で統合表示する
  History and chat are merged into a single chronological feed
- 「すべて / 履歴のみ / チャットのみ」で表示を絞り込める
  A filter switches between All / Rolls only / Chat only
- 参加者ごとに固有の色を割り当て、フィードと参加者一覧で見分けやすくする
  Each participant gets a stable color so they are easy to tell apart
- 表示のクリアは誤操作で行われないよう、確認ダイアログを必須とする
  Clearing the feed requires a confirmation dialog to avoid accidental loss

### 3.7 オンライン共有 / Online sharing
- ルームを作成・参加でき、ロール履歴・チャット・参加者一覧を共有する
  Create / join a room and share roll history, chat, and the player list
- ルーム作成者が GM 兼ホストになる / The room creator becomes GM and P2P host
- ルーム未参加でもローカル単体で利用できる（オフラインモード）
  Works standalone offline when not in a room

### 3.8 GM の隠しロール / GM hidden rolls
- GM は「隠しロール」設定を ON にできる / The GM can toggle a "hidden roll" setting
- ON のとき GM のロールは他プレイヤーに出目を伏せて通知される
  When ON, the GM's rolls are broadcast to others with the value hidden
- 他プレイヤーには「GM が隠しロールを行いました」とだけ表示される
  Other players only see "The GM made a hidden roll"
- GM 自身は自分の出目を確認できる / The GM still sees their own value

### 3.9 チャット / Chat
- ルーム参加者でテキストチャットができる / Room members can exchange text messages
- 他の参加者が入力中のとき、控えめに「入力中…」を表示する
  Show a subtle "typing…" indicator while another player is typing

### 3.10 ルームの退出・終了 / Leaving and closing a room
- GM の退出はルームの終了を意味する。GM には確認を求め、各クライアントには
  「GM がルームを閉じました」と通知する（接続エラー扱いにしない）。
  The GM leaving closes the room: the GM is asked to confirm, and clients
  are told "the GM closed the room" rather than seeing a connection error.
- ルームの参加・退出はフィードにシステムメッセージとして記録する
  Room join/leave events are recorded in the feed as system messages
- 退出後も履歴は残すが、退出済みルームの記録だと分かるよう淡く表示する
  After leaving, the feed is kept but past-room entries are dimmed so it
  is clear they belong to a room the player is no longer in
- 「退出」を押さずに切断した場合（タブを閉じる・通信断・リロード等）も、
  ハートビートで検知して参加者一覧から取り除く。同じプレイヤーが再参加した
  際は古い接続を破棄し、二重表示しない。
  Disconnects without pressing "leave" (closed tab, lost network, reload)
  are detected by a heartbeat and removed from the player list. When the
  same player rejoins, the stale connection is dropped so they are never
  listed twice.

### 3.11 多言語 / i18n
- UI を日本語 / English で切り替えられる / Toggle the UI between Japanese and English
- 言語設定は localStorage に保存 / Language preference stored in localStorage
- ロール結果はデータとして同期し、表示は閲覧者の言語で整形する
  Rolls are synced as data; text is formatted in each viewer's language

### 3.12 キャラクター / Characters
- プレイヤー（人）とは別に「キャラクター」の概念を持つ / Characters are distinct from the player
- キャラクターは 名前 / 背景情報（公開）/ メモ（非公開）/ パターン一覧 を持つ
  A character has a name, public background, private memo, and pattern list
- 複数のキャラクターを保持でき、操作するキャラクターを任意で切り替えられる
  Multiple characters can be kept; the active one can be switched freely
- キャラクターとして発言・ロールすると、名前は「{キャラ名}（{PL 名}）」と表記される
  Acting as a character displays the name as "{character}（{player}）"
- 背景情報はルーム内に共有される。メモは端末内のみで共有されない
  The background is shared with the room; the memo never leaves the device
- パターンはキャラクターごとに保持される / Patterns belong to a character
- 各キャラクターは JSON ファイルとして書き出し・読み込みできる
  Each character can be exported to / imported from a JSON file

### 3.13 アプリ的な UI / App-like UI
- ダイスの個数は 1〜10 をボタンで選ぶ。補正はステッパー（−／＋）で選ぶ
  Dice count 1-10 is picked from buttons; the modifier uses a −／＋ stepper
- 使用頻度の低い操作（プレイヤー名・言語）は設定メニュー内に格納する
  Low-frequency controls (player name, language) live in a settings menu
- キャラクターの背景情報・メモは折りたたみ可能にする
  Character background and memo are collapsible

## 4. 非機能要件 / Non-functional

- SPA（シングルページ） / Single-page application
- 完全な静的サイト。サーバー不要 / Fully static; no own server
- レスポンシブ（PC / モバイル） / Responsive layout
- ライセンス: MIT / MIT License

## 5. 技術スタック / Tech Stack

| 領域 | 採用 | 理由 |
|------|------|------|
| ビルド / Build | Vite | 高速・静的出力 |
| UI | React 19 + TypeScript | 型安全な SPA |
| リアルタイム / Realtime | PeerJS (WebRTC P2P) | バックエンド不要で GitHub Pages と両立 |
| 永続化 / Persistence | localStorage | パターン・名前・言語の保存 |
| テスト / Test | Vitest | ダイスロジックの単体テスト |
| ホスティング / Hosting | GitHub Pages + GitHub Actions | 自動ビルド・デプロイ |

### リアルタイム同期方式 / Realtime model
ホスト権威型 (host-authoritative)。GM がホストとなり、全プレイヤーは GM に接続する
スター型トポロジ。GM が共有状態（参加者・履歴・チャット）を保持し、イベントを全員に中継する。
Star topology: the GM is the host; all players connect to the GM, who holds the
authoritative shared state and relays events to everyone.

## 6. データモデル / Data Model

```ts
DiceType   = 'D4'|'D6'|'D8'|'D10'|'D12'|'D20'|'D100'
PatternKind = 'damage' | 'judgment'

Lang        = 'ja' | 'en'

Pattern    = { id, name, kind, diceType, diceCount, modifier }
RollResult = { id, patternName, kind, diceType, diceCount,
               faces: number[], modifier, value, playerId,
               playerName, hidden, timestamp }
ChatMessage = { id, playerId, playerName, text, timestamp, lang }
// Player carries the active character's public info; memo is never synced.
Player      = { id, name, isGM, characterName, background, lang }
Character   = { id, name, background, memo, patterns: Pattern[], lang }

// Local-only feed annotations (not synced); they record room events.
MarkerType  = 'created'|'joined'|'youLeft'|'youClosed'
            | 'gmClosed'|'hostLost'|'playerJoined'|'playerLeft'
SystemMarker = { id, timestamp, type: MarkerType, roomCode?, playerName? }
FeedItem    = roll | chat | system marker, merged and sorted by time
```

参加者の色は `playerId` のハッシュから決まり、同期不要で全クライアントが一致する。
Player colors are derived by hashing `playerId`, so all clients agree with no sync.

`lang` フィールドは将来のリアルタイム翻訳（`docs/TRANSLATION_API_RESEARCH.md`）に
備えて原文の言語を保持するもので、現時点では挙動に影響しない。
The `lang` fields carry the source language for future real-time translation
(see `docs/TRANSLATION_API_RESEARCH.md`); they do not affect behaviour yet.

## 7. 実装プラン / Implementation Plan

各ステップごとに commit する。 / Commit after each step.

1. **Initial commit** — 要件定義（本書）とプロジェクト雛形 / Requirements + project scaffold
2. **Core dice logic** — ダイス型定義・ロール計算・D100・出目算出 + 単体テスト
3. **i18n** — 日本語 / English の辞書と切り替え機構
4. **Patterns** — パターン作成 UI と localStorage 保存・呼び出し
5. **Realtime + Chat + Hidden rolls** — PeerJS ルーム、チャット、GM 隠しロール
6. **UI assembly & styling** — 画面統合・レスポンシブスタイル
7. **Tests & review** — テスト整備・セルフレビュー・修正
8. **Docs & deploy** — README・LICENSE・GitHub Actions・GitHub Pages 公開

## 8. 受け入れ条件 / Acceptance Criteria

- [x] 6 種類のダイス + D100 を個数指定で振れる
- [x] 補正と種類を設定でき、出目が正しく算出される
- [x] ダメージ（パターン名つき）/ 判定で表記が要件どおり切り替わる
- [x] パターンを保存・呼び出し・クイックロールできる
- [x] 履歴とチャットが 1 つのフィードに統合され、絞り込みできる
- [x] 入力中インジケータが表示される
- [x] 参加者が色で見分けられる
- [x] ルームを作成・参加して履歴・チャットが共有される
- [x] GM がルームを閉じると全員へ正しく通知される
- [x] 退出後の履歴が退出済みルームのものだと分かる
- [x] GM の隠しロールが他プレイヤーに伏せられる
- [x] 日本語 / English を切り替えられる
- [x] キャラクターを作成・切替・書き出し／読み込みできる
- [x] キャラクターの名前・背景がルーム内で共有され、メモは共有されない
- [x] ダイス個数 1〜10・補正をボタン／ステッパーで選べる
- [x] GitHub Pages で公開され、ブラウザで動作する

## 9. 改訂 / Revisions

- v1.1 — レビュー反映: ダメージ表記にパターン名を追加、履歴とチャットの統合
  フィード（絞り込み付き）、入力中インジケータ、参加者カラー、ルーム終了の
  正しい通知、退出済み履歴の明示、クイックロール。
  Review feedback: named damage text, combined history/chat feed with
  filters, typing indicator, player colors, graceful room close, dimmed
  past-room history, and pattern quick-roll.
- v1.2 — レビュー反映: IME（日本語入力）変換中に送信ボタンを押した際の
  二重送信・未クリア不具合を修正、表示クリアに確認ダイアログを追加。
  Review feedback: fixed the IME (e.g. Japanese) send-button race that
  double-sent and failed to clear the box; clearing the feed now confirms.
- v1.3 — レビュー反映: パターン削除に確認ダイアログを追加、未退出のまま
  切断したユーザーが参加者一覧に残り再参加で二重表示される不具合を、
  ハートビート検知と再参加時の重複排除で修正。
  Review feedback: pattern deletion now confirms; fixed ghost players
  that lingered after an ungraceful disconnect and duplicated on rejoin,
  via a heartbeat and de-duplication of a player's stale connection.
- v1.4 — リアルタイム翻訳の API 調査（`docs/TRANSLATION_API_RESEARCH.md`）、
  キャラクター管理（作成・切替・背景／メモ・書き出し／読み込み、パターンの
  キャラクター単位化）、アプリ的な UI（個数 1〜10 ボタン・補正ステッパー・
  設定メニュー）を追加。翻訳に備え `lang` フィールドを各データに付与。
  Add translation-API research, character management (create / switch /
  background / memo / export / import, per-character patterns) and an
  app-like UI (1-10 count buttons, modifier stepper, settings menu).
  `lang` fields are carried on shared data in preparation for translation.
