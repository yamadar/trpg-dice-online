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
- 同名・同用途のパターンが既に存在する場合は、置き換える（更新する）かを確認する
  If a pattern of the same name and kind exists, confirm before replacing it
- 保存したパターンは一覧から呼び出して再利用できる / Saved patterns can be recalled and reused
- 一覧からワンクリックで直接振れる（クイックロール）/ Quick-roll a saved pattern in one click
- 一覧内でパターンを並び替えできる。順序は書き出し／読み込みでも保たれる。
  Patterns can be reordered; the order is kept through export / import.
- パターンの削除は誤操作防止のため確認ダイアログを必須とする
  Deleting a pattern requires a confirmation dialog
- パターンが無い場合は、そのキャラクターにパターンが無い旨と、パターンが
  キャラクター単位であることを明示する
  When empty, the list states that this character has no patterns and that
  patterns are stored per character
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
- フィードの名前をタップすると、その発言・ロール時点のキャラクター名・
  プレイヤー名・背景情報をカードで表示する（PC・モバイル両対応）。表示は
  タップした項目のキャラクターのスナップショットで、その後プレイヤーが
  キャラクターを変更しても当時のキャラクターが表示される。
  Tapping a name in the feed shows the character name, player name and
  background as they were when that entry was created (works on desktop
  and mobile); it is a snapshot, so switching characters later does not
  change what an old entry shows.

### 3.7 オンライン共有 / Online sharing
- ルームを作成・参加でき、ロール履歴・チャット・参加者一覧を共有する
  Create / join a room and share roll history, chat, and the player list
- ルーム作成者が GM 兼ホストになる / The room creator becomes GM and P2P host
- ルーム作成時、GM はルームコードを指定できる（空欄なら自動生成）。指定した
  コードが他のルームで使用中の場合はエラーを表示する。
  When creating a room the GM may choose the room code (blank = random);
  a code already used by another room shows an error.
- GM は参加中のルームのコードを変更できる。参加者は自動的に新しいコードへ
  移行し、履歴は保持される。他のルームのコードには影響しない。
  The GM can change the code of a live room; players migrate to the new
  code automatically with their feed kept, and other rooms are unaffected.
- GM はルームに名前を付けられ、ルーム名は参加者全員に共有される
  The GM can name the room; the room name is shared with all players
- ルーム内のやり取り（ロール・チャット・参加者）はそのルーム内で完結し、
  他のルームには一切影響しない。
  Everything that happens in a room (rolls, chat, players) stays within
  that room and never affects another room.
- ルームごとに URL（`?room=コード`）を発行し、リンクの共有で参加できる
  Each room has its own URL (`?room=CODE`); sharing the link lets others join
- ルーム参加の試行中は「接続中」を表示する
  While a join is in progress, a "connecting" indicator is shown
- 意図しない切断（タブのバックグラウンド化・通信断など）は自動で同じルームへ
  再接続を試みる。バックオフ付きで数回試行し、履歴は保持する。「退出」を
  押した意図的な切断では再接続しない。
  An unintentional disconnect (a backgrounded tab, a network blip) auto-
  reconnects to the same room with a backoff, keeping the feed; a
  deliberate "leave" never reconnects.
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
- チャットにファイルを添付できる。バックエンドを持たないため、ファイルは
  base64 データ URL として P2P 経路で送信する。画像は送信前に縮小する。
  Files can be attached to chat; with no backend they travel as base64 data
  URLs over the P2P channel, and images are downscaled before sending.
- 画像の添付はフィードにサムネイルで表示し、タップで全画面ビューア
  （ライトボックス）を開く。画像以外はダウンロード用のチップで表示する。
  Image attachments show a thumbnail in the feed and open a fullscreen
  viewer (lightbox) on tap; non-images show a download chip.
- ライトボックスは左右スワイプ・矢印キー・画面の前後ボタンで、フィード内の
  他の画像へ移動できる。
  The lightbox steps through the feed's other images via a horizontal
  swipe, the arrow keys, or on-screen prev/next buttons.
- フィードのフィルターに「ファイル」を追加し、添付付きメッセージのみを
  一覧表示できるようにする。
  The feed filter has a "Files" view listing only messages with an
  attachment.
- 「@ユーザー名」でそのユーザーを、「@all / @ALL」で全員をメンションでき、
  対象ユーザーにはそのメッセージが強調表示される。メンションはプレイヤー
  ID で保持し、名前変更や同名ユーザーがいても正しく扱う。入力中に「@」を
  打つとユーザー名のサジェストを表示する。
  "@username" mentions a user and "@all" / "@ALL" mentions everyone; the
  message is highlighted for each mentioned user. Mentions are stored by
  player id, so renames and duplicate names are handled correctly, and
  typing "@" shows a username autocomplete.

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
- 各キャラクターは JSON ファイルとして書き出し・読み込みできる。書き出し時に
  非公開のメモを含めるかを選べる（既定は含めない）。
  Each character can be exported to / imported from a JSON file; the export
  can optionally include the private memo (off by default).
- 参加者一覧では各参加者の行を開いてキャラクターの詳細（名前・背景）を閲覧できる
  In the player list, each row expands to show that player's character
  details (name and background)

### 3.13 アプリ的な UI / App-like UI
- ダイスの個数は 1〜10 をボタンで選ぶ。補正はステッパー（−／＋）で選ぶ
  Dice count 1-10 is picked from buttons; the modifier uses a −／＋ stepper
- 使用頻度の低い操作（プレイヤー名・言語）は設定メニュー内に格納する
  Low-frequency controls (player name, language) live in a settings menu
- キャラクターの背景情報・メモは折りたたみ可能にする
  Character background and memo are collapsible
- ルーム名・キャラクター名の変更やパターンの保存は Toast で通知する
  Saving / changing room and character names and saving patterns is
  confirmed with a toast
- ページを離れる前（リロード・戻る・閉じる）に確認ダイアログを表示する
  A confirmation is shown before the page is left (reload, back, close)
- 履歴＆チャットを主画面とし、画面の大半を占有する。最小限の状態
  （ルーム・キャラクター・参加者数）はヘッダーに常時表示する。
  History & chat is the dominant, always-visible view; the header keeps a
  minimal status (room, character, player count).
- ヘッダーのルーム／キャラクター表示はタップでそれぞれのシートを開く。
  キャラクター未選択時の表示は「なし（PL 本人）」とする。
  Tapping the header's room / character status opens the matching sheet;
  with no character it reads "None (as player)".
- ルームシートの参加者詳細は開閉キャレットを目立たせ、全員の詳細を
  一括で開閉するボタンを用意する。
  The room sheet's participant detail uses a prominent toggle caret and a
  button to expand / collapse every participant's detail at once.
- ルーム／キャラクター／ダイス／パターンはボトムドックから必要時に
  シート（オンデマンドのパネル）として開く。モバイルではボトムシート、
  デスクトップでは中央モーダルとして表示する。
  Room / character / dice / patterns open on demand from a bottom dock as
  a sheet — a bottom sheet on mobile, a centered modal on desktop.
- サイト名・ライセンス・GitHub リンクは設定メニューの下部に格納する
  The site name, license and GitHub link are tucked into the settings menu
- プレイヤー名が未設定の場合は入力を必須とし、入力するまで利用を開始できない
  （設定からいつでも変更できる旨も案内する）。
  When no player name is set, entering one is required before the app can
  be used (with a note that it can be changed later in the settings).
- 初回起動時に使い方をオーバーレイ表示するチュートリアルを出す。設定メニュー
  からはいつでもヘルプとして再表示できる。
  On first run, an overlay tutorial walks through how to use the app; it
  can be reopened anytime from the settings menu as the in-app help.

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

WebRTC の NAT 越えには STUN に加えて TURN（中継）サーバーを使う。公衆 Wi-Fi の
対称型 NAT や UDP 遮断下でも接続できるよう、既定では Open Relay Project の無料
公開 TURN を使用する。`VITE_TURN_*` ビルド変数で自前の TURN サーバーに差し替え
られる（`.env.example` を参照）。TURN は通信を中継するだけでアプリのバックエンド
ではないため、静的サイト構成は維持される。
NAT traversal uses TURN relays in addition to STUN. By default the free public
Open Relay Project TURN servers are used so players behind symmetric NAT or
UDP-blocking public Wi-Fi can still connect; the `VITE_TURN_*` build variables
swap in a self-owned TURN server (see `.env.example`). A TURN server only relays
traffic, so the app stays a fully static site.

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
- v1.5 — モバイル向けにアプリシェル化。履歴＆チャットを主画面とし、ルーム・
  キャラクター・ダイス・パターンをボトムドックからシートで開く方式に変更。
  サイト名・ライセンス・GitHub リンクを設定メニューへ移動。
  Reshape the layout into an app shell for mobile: history & chat is the
  main view, and room / character / dice / patterns open from a bottom
  dock as sheets. The site name, license and GitHub link move into the
  settings menu.
- v1.6 — プレイヤー名の入力を初回必須化（名前ゲート）、GM がルームに名前を
  付けられる機能、モバイルでのフィードヘッダー（タイトル・絞り込み・クリア）の
  折り返し改善。
  Require a player name on first run (name gate), let the GM name the
  room, and fix wrapping of the feed header (title, filter, clear) on
  mobile.
- v1.7 — 初回チュートリアル（オーバーレイ式の使い方ガイド）を追加し、設定
  メニューから「使い方」としていつでも再表示できるようにした。
  Add a first-run overlay tutorial that walks through the app, reopenable
  anytime from the settings menu as the in-app help.
- v1.8 — UI の細部改善: 参加者数をアイコン表示、長いルーム名／キャラクター名の
  省略表示、パターンの並び替え、書き出し時のメモ含有オプション（既定 OFF）、
  閉じるボタンの×を SVG 化、「表示をクリア」の控えめ化、参加者詳細の展開閲覧。
  UI refinements: icon for the player count, truncation of long room /
  character names, pattern reordering, an optional memo in the export
  (off by default), an SVG close icon, a quieter "clear view" button, and
  expandable participant details.
- v1.9 — フィードの呼称を実態に合わせて変更: 「履歴 & チャット」→「ダイス &
  チャット」、絞り込みの「履歴」→「ダイス」、クリア確認文も同様に更新。
  Rename the feed to match what it holds: "History & Chat" → "Dice &
  Chat", the "rolls" filter label to "Dice" (JA), and the clear
  confirmation text accordingly.
- v1.10 — ルーム名・キャラクター名の変更とパターン保存の Toast 通知、ページ
  離脱前の確認ダイアログ、ルームごとの URL（リンク共有・コピー）、ルーム参加中の
  「接続中」表示を追加。
  Add toasts for room/character name changes and pattern saves, a
  confirmation before leaving the page, per-room URLs (shareable /
  copyable link), and a "connecting" indicator while joining a room.
- v1.11 — 同名・同用途のパターン保存時に置き換え確認を追加。パターン一覧が
  空のとき、キャラクター単位で保存される旨を明示するメッセージに変更。
  Confirm before replacing a pattern of the same name and kind; the empty
  pattern list now states that patterns are stored per character.
- v1.12 — ヘッダーのルーム／キャラクター表示をタップで各シートを開けるように
  し、キャラクター未選択時の表示を「なし（PL 本人）」に変更。ルームシートの
  参加者詳細の開閉キャレットを目立たせ、全員を一括で開閉するボタンを追加。
  Make the header's room/character status open their sheets on tap, change
  the no-character label to "None (as player)", give the participant detail
  a prominent caret, and add an expand/collapse-all button.
- v1.13 — フィードのプレイヤー名をタップすると、そのプレイヤーの情報カード
  （キャラクター名・プレイヤー名・背景情報）をシートで表示するようにした。
  Tapping a player name in the feed opens a sheet card with that player's
  character name, player name and background.
- v1.14 — チャットにファイル添付を追加。画像はサムネイル表示・タップで
  ライトボックス、画像以外はダウンロード用チップで表示する。フィードに
  「ファイル」フィルターを追加。画像は送信前に縮小し、P2P 経路の負荷を抑える。
  Add chat file attachments: images show a thumbnail with a tap-to-open
  lightbox, other files show a download chip, and a "Files" feed filter is
  added. Images are downscaled before sending to keep the P2P payload small.
- v1.15 — WebRTC に TURN サーバーを追加。既定で Open Relay Project の無料
  公開 TURN を使い、対称型 NAT や UDP 遮断下（公衆 Wi-Fi 等）でも接続できる
  ようにした。`VITE_TURN_*` で自前 TURN に差し替え可能。
  Add a TURN server to the WebRTC config: the free public Open Relay Project
  TURN is used by default so players behind symmetric NAT or UDP-blocking
  Wi-Fi can connect; `VITE_TURN_*` swaps in a self-owned TURN server.
- v1.16 — 接続エラーのバナーを画面上部に固定表示し、ルームのシートより
  前面に出るようにした。参加失敗時にバナーがモーダルの背後に隠れない。
  Pin the connection-error banner to the top of the screen above open
  sheets so a failed join is no longer hidden behind the room modal.
- v1.17 — ルーム参加コード入力欄の初期値を、最後に作成・参加したルーム
  コードにするようにした（URL のコードがあればそちらを優先）。
  The room join field prefills with the last room code created or joined
  (a code from the URL still takes precedence).
- v1.18 — 意図しない切断（タブのバックグラウンド化・通信断など）を検知し、
  同じルームへ自動再接続するようにした。バックオフ付きで数回試行し、履歴は
  保持される。「退出」を押した意図的な切断では再接続しない。
  Detect unintentional disconnects (a backgrounded tab, a network blip)
  and auto-reconnect to the same room with a backoff, keeping the feed; a
  deliberate "leave" never triggers a reconnect.
- v1.19 — ルーム作成時に GM がルームコードを指定できるようにした（使用中の
  コードはエラー）。参加中のルームのコードも変更でき、参加者は履歴を保った
  まま自動的に新しいコードへ移行する。ルーム間の独立性を 2 タブ以上で確認。
  Let the GM pick the room code when creating a room (a taken code errors)
  and change a live room's code, with players migrating automatically and
  keeping their feed. Room isolation verified across multiple tabs.
- v1.20 — フィードの各発言・ロールに当時のキャラクター名・背景情報を保存し、
  名前タップ時はその時点のキャラクター情報を表示するようにした（その後
  キャラクターを変更しても古い発言は当時のキャラクターを表示）。添付アイコン
  とステータスバー 2 ボタンの表示位置を整えた。
  Each feed entry now stores the character name / background in use at the
  time, so tapping a name shows that character even after the sender
  switches; also tidied the attach-icon and status-bar alignment.
- v1.21 — ライトボックスに前後の画像へ移動する操作（左右スワイプ・矢印
  キー・画面上の前後ボタン）と画像枚数の表示を追加した。
  Add prev/next navigation to the lightbox (swipe, arrow keys, on-screen
  buttons) plus an image counter.
- v1.22 — チャットの @メンションを追加。「@ユーザー名」「@all」で対象に
  メッセージを強調表示する。メンションはプレイヤー ID で保持し、入力中の
  「@」でユーザー名のサジェストを出す。
  Add chat @mentions: "@username" / "@all" highlight the message for the
  target. Mentions are stored by player id and typing "@" autocompletes
  usernames.
