# テーブルマップ実装

[English](TABLETOP_IMPLEMENTATION.md)

> 機能仕様は [`REQUIREMENTS.ja.md` §3.15](REQUIREMENTS.ja.md) を参照。
> 本書は **as-built（実装済みの実体）** を記述するコンパニオン文書で、
> モジュール構成・ワイヤプロトコル・ホスト権威のデータフロー・永続化・
> Konva 描画ツリー・実装履歴・テスト一覧をまとめる。
>
> 本機能は PR #134〜#190（以降も継続）で段階的に実装された。本書は元々
> 7 PR の計画書だったが、実際に着地した内容に合わせて書き直している。
> 実装は当初スコープを大きく超え、ヘックスグリッド・フォグ・フリーハンド
> 描画 / テキストラベル・マップギャラリーピッカー・NPC ライブラリ・GM の
> テーブルライブラリは、いずれも当初「Phase 2 以降」に置いていたものである。

## 1. スコープ

### 実装済み

- **グリッド**: `none` / `square` / フラットトップ **hex**（odd-q オフセット）。
  セルサイズ・原点オフセット・線色・線の不透明度・スナップ切替。
- **背景マップ**: 1 シーン 1 枚。**ファイル** / **URL** / アプリ内
  **ギャラリー**ピッカー（[trpg-map-organizer](https://yamadar.github.io/trpg-map-organizer/)、
  約 303 枚）/ 同梱**プリセット**（`public/maps/`）の 4 経路。すべて同一の
  縮小＋チャンク配信パイプラインに合流。「背景なし」（グリッドのみ）も可。
- **トークン**: PC トークン（セッションキャラに紐づきポートレートを再利用）と
  GM 専用トークン（NPC / モンスター / 小物）。配置・ドラッグ・サイズ変更
  （`0.6 / 1 / 2 / 3 / 4`）・削除・ラベル変更。1 キャラが複数トークンを持てる。
  トークンごとに**公開メモ**（全員編集可）と GM 専用の**非公開メモ**
  （ブロードキャストしない）。任意の**向き（facing）**: ポップオーバーの
  8 方位コンパスでトークンに方向矢印を描く（移動と同じ権限＝オーナー / GM）。
  任意の**バイタル**: HP プール（`{ current, max }`）をトークン下部に
  色分けバーで、固定カタログの**状態異常**をトークン上部に絵文字バッジで
  描く（どちらもオーナー / GM が編集可）。
- **NPC ライブラリ**: GM が用意する名前付き NPC 定義（名前 + 画像 + メモ）の
  ストック。何度でも配置でき、配置時に画像 / ラベル / メモをインラインに
  コピーするため、後からライブラリを編集しても配置済みトークンは変わらない。
- **テーブルライブラリ**: 名前付きの**テンプレート**（PC トークンを除去し
  `pcSpawn` を退避）と完全**スナップショット**。セッション横断（per-session
  でない）でグローバル保存されるので、GM が事前にシーンを準備して任意の
  ルームに読み込める。
- **注釈レイヤ**: フリーテキスト**ラベル**・フリーハンド**ペン描画**・
  グリッドセル単位の**フォグ・オブ・ウォー**（GM が塗る / プレイヤーには不透明）。
- **リアルタイム**: ホスト権威 / last-write-wins、約 20Hz の drag throttle、
  遅参者への welcome snapshot 同梱、IndexedDB によるリロード復元、
  ルームのエクスポート / インポート。
- **ピング**: 参加者全員が一時的な「ここ見て」マーカーを置ける。本人の
  プレイヤー色のさざ波 + 名前ラベルで全員にブロードキャストされ、約 2.6 秒で
  消える。設計上**揮発性**で、永続化・スナップショット・エクスポートのいずれも
  されないため、点灯前から在室していない遅参者には見えない。
- **表示**: 全画面モード（モバイル + デスクトップ）と下部ドック、チャット /
  ダイスの差し替えオーバーレイ、未読チャットドット、ロール元トークンから
  飛ぶ**ダイス演出**、発言者トークン上の**吹き出し**、初回チュートリアル、
  描画クラッシュ用の**エラーバウンダリ**。
- **キーボード操作**: 矢印キーで選択トークンを 1 マスずつ移動、`1`〜`5`
  （＋頭文字）でツール切替、`+`/`-`/`0` でズーム、`f` で選択へ寄せ、
  `[`/`]` で操作可能トークンを巡回、`Delete` で削除、`Esc` で選択解除
  →閉じる、`?` でショートカット早見表をトグル。キー→意図の対応は純粋な
  `tabletop/keymap.ts`。

### 対象外（Phase 2 以降）

ルーラー（マス距離測定）、1 セッション複数マップ（シーン一覧）、
ミニマップ。
§9 参照。

## 2. モジュール構成

### `src/tabletop/` — 純粋ロジック（単体テスト済み・React / Konva / DOM 非依存）

| ファイル | 役割 |
|---|---|
| `types.ts` | `TabletopState`・`Token`（`PcToken` / `GmToken`）・`Grid`・`MapBackground`・`NpcDef`・`MapText`・`DrawStroke`・`FogState`・`SavedTabletop`、各種上限定数、id 採番、`cellFromWorld`（square/hex 振り分け） |
| `grid.ts` | スクエアのスナップ・座標変換。サイズ対応スナップ（偶数サイズ→セル角、奇数 / サブセル→中心）、非ドリフトな `snapResizeToGrid`、`kind === 'hex'` 時は `hexGrid.ts` へ委譲 |
| `hexGrid.ts` | フラットトップ hex 計算（odd-q）: 中心 / 多角形 / pixel→cell / ビューポート走査。redblobgames 方式 |
| `tokens.ts` | PC トークンのライフサイクル・権限: `planPcTokenAdds`・`makeGmToken`・`canMoveToken`・`applyTokenMove/Upsert/Remove`・`defaultPlacementOrigin`（マップ中心→グリッド原点→`pcSpawn`）・4 列折り返しの `placementPosition`・`recenterTokensOnMap`・`snapAllTokensToGrid` |
| `annotations.ts` | テキスト / ストローク / フォグの適用＋権限判定（`canEditMapText`・`canEraseStroke`）、`setFogCells`・`isCellRevealed`・`nearestRevealedCellCenter`（フォグへ落としたトークンの救済） |
| `hostValidation.ts` | 受信した注釈リクエストのホスト側バリデータ（純粋関数）。`ownerPlayerId` を信頼できる接続元から再付与し、なりすましを防ぐ |
| `snapshot.ts` | ワイヤ用ヘルパー: `tokenForWire` / `stripMapBytesForWire`（送信前に `privateNote` とマップ `dataUrl` を除去）、`fillTabletopDefaults`（PR-12 以前のホストの欠落フィールドを補完） |
| `imageChunk.ts` | `chunkString` ＋ `ChunkBuffer`: data URL を 256KB チャンクに分割し、順不同到着でも再構築（進捗・長さ検査つき） |
| `imageBackground.ts` | マップ縮小（長辺 3000px、PNG は >6MB のとき JPEG q0.85、入力 ≤8MB）。`readMapBackground`・`fetchMapBlob` / `readMapBackgroundFromUrl`・`parseHttpUrl`、構造化エラータグ（`invalidUrl` / `fetchFailed` / `notImage` / `tooLarge` / `unreadable`） |
| `mapGallery.ts` | trpg-map-organizer の I/O: マニフェスト＋タグ辞書のパース、`originalUrl`（WebP）/ `thumbUrl`、`filterMaps`（4 分類・AND/OR）、`searchMaps`、`tagLabel`（言語対応） |
| `presetMaps.ts` | 同梱プリセットのローダ（`public/maps/manifest.json`）。`readMapBackground` を再利用 |

### `src/storage/` — 永続化

| ファイル | 役割 |
|---|---|
| `tabletop.ts` | セッション単位の `sessionTable`（DB v7+）: `saveTabletop` / `loadTabletop` / `deleteTabletopForSession` ＋ `sanitizeStoredTabletop`（任意の保存データを正当な state に矯正） |
| `tabletopLibrary.ts` | グローバルな `tabletopLibrary`（DB v8+）: `saveLibraryEntry` / `listLibrary` / `getLibraryEntry` / `deleteLibraryEntry` |
| `tabletopTutorial.ts` | localStorage フラグ `trpg-dice.tabletopTutorialSeen`（本体チュートリアルと別管理） |

### `src/components/` — UI

| ファイル | 役割 |
|---|---|
| `TablePanel.tsx` | 全画面の Konva レンダラ: Stage ＋各レイヤ、pan/zoom、トークン drag、描画 / テキスト / フォグのジェスチャ、トークン popover、ダイス演出・吹き出し、チャット / ダイスオーバーレイ。約 2,000 行 |
| `TableToolbar.tsx` | 右端のアイコンカテゴリパネル: **マップ＆グリッド**（グリッド設定＋4 タブのマップソース）・**フォグ**・**トークン**（マップ上＋追加・準備）・**ライブラリ** |
| `TableTools.tsx` | 左端のフローティングツールパレット: `select` / `text` / `pen` / `eraser` / `fog-reveal` / `fog-conceal` ＋色 / ペン幅 / 文字サイズの popover |
| `MapGalleryDialog.tsx` | ギャラリーピッカー: タグチップ（4 分類・AND/OR）・検索・サムネイルグリッド・選択と同期する `Lightbox` プレビュー（前後送り＋スワイプ） |
| `TabletopDock.tsx` | 全画面モード用の下部ドック: `chat` / `character` / `dice` / `returnToRoom`（＋未読チャットドット） |
| `TabletopTutorial.tsx` | 初回 7 ステップのチュートリアル（本体チュートリアルの装飾を流用） |
| `DiceRollAnimation.tsx` | キャンバス上でサイコロが上方へ回転して飛ぶ演出（単体） |

`Lightbox.tsx` は共用（テーブル専用ではない）。共通の画像ピッカー
（`ImagePickerDialog`）は NPC / キャラのトークン画像に
[trpg-chara-image-organizer](https://yamadar.github.io/trpg-chara-image-organizer/)
ギャラリー連携を提供する。

### 既存ファイルの変更

| ファイル | 変更内容 |
|---|---|
| `src/net/protocol.ts` | テーブルマップのメッセージ群（§3.3）、`Snapshot.tabletop?`、`MapMeta` |
| `src/hooks/useSession.ts` | ホスト権威の `tabletop` state ＋全アクション群（§3.2）、クライアント要求のバリデーション、チャンクマップ転送、フォグ落下救済、IndexedDB 永続化、ライブラリ load/save |
| `src/storage/roomLog.ts` | `DB_VERSION` → **8**。v7 で `sessionTable`、v8 で `tabletopLibrary`（`byUpdatedAt` index）を追加。`deleteSession` / `deleteAllSessions` は `sessionTable` も clear |
| `src/storage/roomExport.ts` / `roomImport.ts` | マニフェスト **v6**: `table.json` ＋ `attachments/maps/*`。旧書庫は table 空で import |
| `src/components/Dock.tsx` | `tabletop` `DockId` ＋ `TabletopIcon`（trailing スロット）。全画面モードを開く |
| `src/App.tsx` | `tabletopOpen` 全画面モード、エラーバウンダリ内での `TablePanel` の mount/unmount、チャット / ダイスオーバーレイ配線、未読チャット追跡 |
| `src/i18n/translations/*.ts`（19 言語） | `tabletop.*` キー（パリティテストで 19 言語を担保） |
| `package.json` | `konva` `^10.3.0`、`react-konva` `^19.2.4` |

## 3. 状態・同期・永続化

### 3.1 モデル

`TabletopState = { map?, grid, tokens[], npcLibrary[], pcSpawn?, texts[], strokes[], fog }`。
GM（P2P ホスト）が正本の state を保持し、各クライアントは welcome snapshot ＋
差分メッセージから複製する。トークン位置はトークン中心の**ピクセル**座標で、
描画時にグリッドへスナップする。よって将来のグリッド変更でワイヤ形式の
マイグレーションは不要。

### 3.2 `useSession` のアクション面

`useSession` は live な `tabletop` / `tabletopLibrary` state と、（ネスト
されない）フラットなアクション群を公開する。分類:

- **グリッド / マップ**: `updateGrid`・`setMapBackground(file)`・
  `setMapBackgroundFromUrl(input)`・`setMapFromPreset(preset)`・
  `clearMapBackground`。
- **トークン**: `placeMyCharacterToken`・`addPlayerToken`・`addGmToken`・
  `moveTokenLive` / `moveTokenCommit`・`setTokenSize`・`removeToken`・
  `updateGmToken`・`updateTokenNote`・`updateTokenPrivateNote`・
  `reorderToken`・`syncOwnTokenSnapshots`。
- **NPC ライブラリ**: `addNpcDef`・`updateNpcDef`・`removeNpcDef`・
  `reorderNpcDef`・`placeNpcFromLibrary`。
- **テーブルライブラリ**: `saveTabletopAs(name, kind)`・
  `loadTabletopFromLibrary(id)`・`deleteTabletopFromLibrary(id)`。
- **注釈**: `addMapText` / `updateMapText` / `removeMapText`・
  `addDrawStroke` / `removeDrawStroke`・`setFogEnabled`・`paintFog`・
  `commitFog`・`setFog`。

マップ読み込み系は `'ok'` か `MapImageError` を返し、ツールバーが具体的な
メッセージを出せるようにしている。ホストは全 state 変更を `applyTabletop(next)`
1 か所に通し、ref 更新・setState・`saveTabletop` の fire-and-forget を行う。

### 3.3 ワイヤプロトコル（`net/protocol.ts`）

**クライアント → ホスト**（いずれも反映前にホスト側で検証）:
`tokenMove`・`pcTokenPlaceRequest`・`tokenSizeRequest`・
`tokenRemoveRequest`・`tokenFacingRequest`・`tokenHpRequest`・
`tokenStatusRequest`・`tokenNoteRequest`・`mapTextAddRequest`・
`mapTextUpdateRequest`・`mapTextRemoveRequest`・`drawStrokeAddRequest`・
`drawStrokeRemoveRequest`・`pingRequest`。

**ホスト → クライアント**（権威）: `tokenMove`・`tokenUpsert`・
`tokenRemove`・`gridChange`・`mapMeta`・`mapChunk`・`mapCleared`・
`npcDefUpsert`・`npcDefRemove`・`tabletopState`（全置換。ライブラリ読込で
使用）・`mapTextUpsert`・`mapTextRemove`・`drawStrokeAdd`・
`drawStrokeRemove`・`fogSet`・`ping`。welcome `Snapshot` は任意の `tabletop`
を同梱する（マップ `dataUrl` は除去。§3.5）。

`ping` のペアだけは唯一の**揮発性**メッセージである。クライアントの
`pingRequest`（ワールド座標）をホストが検証（送信者が既知・座標が有限）し、
送信者 id を押し直して `ping` としてブロードキャストする。`TabletopState`
には一切触れないため、スナップショット・IndexedDB・エクスポート archive の
いずれにも現れない — マーカーは `useSession` の一時的な `lastPing` と描画側の
短命なアニメーションにのみ存在する。純粋なアニメーション / 検証計算は
`tabletop/ping.ts` にある。

### 3.4 トークン同期（ホスト権威 / last-write-wins）

1. クライアントが drag → ローカル即時表示、約 20Hz で `tokenMove` 送信。
2. ホストが `canMoveToken`（PC: オーナーか host / GM トークン: host）を検証し、
   `tokens` を更新して `tokenMove` をブロードキャスト。
3. クライアントは host の echo を「正」とみなす。同一トークンの drag 競合は
   後勝ち（last-write-wins）。
4. drag 終了時、非 GM が自分のトークンを（自分には見えない）フォグセルへ落と
   した場合、commit は `nearestRevealedCellCenter` へ寄せ、フォグ下で見失わない
   ようにする。

サイズ変更（`tokenSizeRequest`）・削除（`tokenRemoveRequest`）も同じ
「検証 → ブロードキャスト」経路。`tokenNoteRequest`（公開メモ）は**全参加者**
が書ける設計で、ホストは送信者が既知かだけ確認し、`privateNote` を**外して**
トークンをブロードキャストする。

### 3.5 背景マップ転送

`file` / `URL` / `gallery` / `preset` はすべて `readMapBackground` に合流し、
縮小済み data URL を得る。続いてホストは:

1. `mapMeta`（id・名前・寸法・`ChunkSpec`）をブロードキャスト;
2. data URL を 256KB の順序つき `mapChunk` で送信（`chunkString`）。小さな
   マップは 1 チャンク;
3. 受信側は `ChunkBuffer`（順不同許容・長さ検査）で再構築し、揃うまで読み込み
   中表示、完了後に永続化＋描画。

マップ `dataUrl` は welcome snapshot と `tabletopState` から**除去**
（`stripMapBytesForWire`）し、数 MB の画像が制御フレームにインライン同梱され
ないようにする（チャンク転送が別途追従）。`clearMapBackground` → `mapCleared`。

### 3.6 `privateNote` の機密性

送信経路（`tokenUpsert`・snapshot のトークン・`tabletopState`）はすべて
トークンを `tokenForWire` に通し、GM 専用の `privateNote` を除去する。よって
非ホストには決して届かない。これは設計上ホスト限定の唯一のフィールド。

### 3.7 永続化

- **セッション単位**: 変更のたび `saveTabletop(sessionId, state)` が
  `sessionTable` を upsert。リロード / 復帰時に `loadTabletop` が
  `sanitizeStoredTabletop` を通して復元し、任意の保存形（PR-10/11/12 以前の
  レコードを含む）を完全で正当な state に矯正する。
- **グローバルライブラリ**: `tabletopLibrary`（DB v8）が `SavedTabletop` の
  テンプレート＋スナップショットを `updatedAt` 順で保持。
- **エクスポート / インポート**: ルーム ZIP はマニフェスト **v6**。テーブルは
  `table.json` に入り、マップ画像は `attachments/maps/{id}.{ext}` に分離
  （チャット添付と同様）。v5 以前の書庫は table 空で読み込む。

> **解消（トークン向き PR）**: `sanitizeStoredTabletop`（リロード経路）は
> 共有ヘルパ `sanitizeTokenCommon` を通じてトークンの `size` / `note` /
> `privateNote` ＋ 新規 `facing` を往復させるようになった。従来これらは
> live 同期では生き残るが、ホストが IndexedDB から再読込すると失われていた。

## 4. 描画 & UI

### 4.1 Konva レイヤ（`TablePanel`）

`scale` / `position` が pan & zoom を駆動する `<Stage>` が 1 つ。z 順
（下 → 上）:

1. **背景** — ワールド原点のマップ画像（非インタラクティブ）。
2. **グリッド** — スクエアの走査線または hex 多角形。ビューポートでカリングし、
   線幅 `1 / scale` でどのズームでも約 1 デバイス px。
3. **ストローク** — ペン線（＋描画中のライブプレビュー）。eraser 時のみ listen。
4. **トークン** — 円形ポートレート（クリップ・"cover" フィット）または頭文字
   つきカラー円。サイズ連動の半径、下にラベル。`draggable` はツールが `select`
   かつ `canMoveToken` が真のときのみ。操作不可トークンは opacity 0.8。
5. **フォーカスパルス** — マップ上トークン一覧でクリックした際の一発リング。
6. **吹き出し** — 発言者トークン上に浮かぶチャット文。重なりを避けて自動配置、
   TTL 約 6 秒。
7. **ダイス演出** — ロール元トークンからサイコロが上方へ回転（`DiceRollAnimation`、
   約 1.1 秒）。
8. **テキストラベル** — マップ上テキスト（eraser 時のみ listen）。
9. **フォグ** — 未公開セル。GM は opacity 0.5、非 GM は 1.0（下の hit-test も
   遮断）。hex フォグは共有辺の二重描画を避けるため単一 `<Shape>` パス。

**pan**: 2 本指タッチ / 右ドラッグ / Space + 左ドラッグ。**zoom**: ホイール
（×1.1）/ ピンチ。0.25〜4 倍にクランプし、カーソル位置を基準にする。ピンチと
ドラッグは同一ジェスチャで併用しない。

### 4.2 トークン popover

トークンをタップすると、その画面位置にアンカーした DOM popover が開く。GM
（または PC トークンのオーナー）は編集ビュー: 名前 / ラベル（GM トークン）・
公開メモ・サイズ選択・NPC 画像変更・削除、加えて**非公開 GM メモ**（host のみ）と
「Character info」起動。非オーナーは読み取り専用ビューで、操作を許された者
（GM とオーナー）も併記される。

### 4.3 ツールバー & ツール

`TableToolbar` は右端のアイコンカテゴリ（同時に開くのは 1 つ）:
**マップ＆グリッド**（GM）— グリッドの種別 / サイズ / 原点 / 色 / 不透明度 /
スナップ＋4 タブのマップソース（Upload / Gallery / URL / Preset）と独立した
Replace/Clear; **フォグ**（GM）— 有効化＋全面化 / 全公開＋左ブラシへの案内;
**トークン**（全員）—『マップ上のトークン』（種別バッジ・クリックでフォーカス・
自分の PC をアクセント強調・GM の並び替え / 削除）と折りたたみ式『追加・準備』
（PC 配置リスト＋NPC ライブラリ編集）; **ライブラリ**（GM）— テンプレート /
スナップショット保存と読み込み / 削除。

`TableTools` は左端パレットで、左マウス / シングルタッチのジェスチャモードを
切り替える。ツール別の色 / ペン幅 / 文字サイズは、そのツールが使わないときは
自動的に隠れる。

### 4.4 全画面モード

`App` が `tabletopOpen` を切り替え、テーブルが画面を占有する（Dock のテーブル
ボタンで入り、`returnToRoom` で出る）。`TablePanel` は共通の**`ErrorBoundary`**
（`components/ErrorBoundary.tsx`）内に `TabletopErrorFallback` 復旧カードつきで
mount され、Konva の描画クラッシュ時には空白ではなく再試行 / マップ消去 /
閉じるを出す。チャットとダイスは差し替えオーバーレイ
（モバイルは `Sheet`、デスクトップはフローティング aside）で、`TabletopDock`
が駆動する。チャット非表示時は未読ドットがチャットアイコンに付く。専用の
`TableFeedSheet` コンポーネントは**存在しない** — 計画していた swipe-up フィードは
既存の `Sheet` ＋オーバーレイ方式で実現した。

## 5. 実装履歴

約 40 本の PR（#134〜#190）で実装。テーマ別:

| フェーズ | PR | 主な内容 |
|---|---|---|
| 基盤 | #134–#141 | 仕様、型 / プロトコル、ストレージ（DB v7）、Konva 基盤＋pan/zoom、PC トークン、チャンク背景転送、GM トークン、ツールバー / 編集メニュー |
| ロスター＆ライブラリ | #142–#147 | PC 名ラベル、NPC 画像 300px/200KB、パネルトグル、手持ち / 配置の分離＋PC マルチトークン＋NPC ライブラリ、PC 削除の host 限定、テーブルライブラリ（テンプレ / セーブ、DB v8） |
| 注釈＆堅牢化 | #148–#155 | 配置起点→マップ中心、テキスト / ペン / フォグレイヤ、描画**エラーバウンダリ**、フォグ落下トークン救済、ダイス＋パターンのパネル統合 |
| Hex＆UI 再編 | #156–#167 | **ヘックスグリッド**、下部ドック再編、右ツールバーのアイコンカテゴリ化、左ツールのフォーカス時テキスト、内容高さフィット、吹き出し＋未読ドット、チュートリアル、フォグ案内文、中心配置 |
| マップソース | #171–#177 | URL 読込、**ギャラリーピッカー**、トークンサイズ＋マップ変更時スナップ。後にギャラリーを mid-JPEG → original WebP へ切替 |
| トークン UX＆メモ | #181–#190 | hex フォグブラシ修正、トークン / NPC 編集刷新、操作キャラ切替のポートレート消失修正、公開＋非公開**メモ**＆権限マトリクス、ダイス通知ドット＋キャンバスのダイス演出、トークンパネル 2 セクション化、自分の PC 強調、グリッド折り返し配置、ドキュメント |

## 6. リスクと対処

| リスク | 対処 |
|---|---|
| drag 連発でデータチャネルが詰まる | drag 中は約 20Hz throttle、終了時に最終位置を送信 |
| Konva の再描画コスト | レイヤ分離、グリッド / フォグのビューポートカリング、hex フォグを単一パス化、受動レイヤは `listening={false}`、派生 state のメモ化 |
| 数 MB マップがチャネルを塞ぐ | 256KB チャンク転送。snapshot/state から `dataUrl` を外し別送 |
| 背景画像チャンクの欠落 | `ChunkBuffer` が順不同を許容、重複 / 別 id を破棄し、再構築を長さ検査 |
| `privateNote` 漏洩 | `tokenForWire` で全送信経路から除去。`snapshot.test.ts` で担保 |
| 注釈 / トークン要求の所有権なりすまし | ホストが `ownerPlayerId` を再付与し、`canMoveToken` / `canEditMapText` / `canEraseStroke` を再チェック（`hostValidation.ts`） |
| 自分のトークンをフォグ下に落として見失う | drag 終了 commit で `nearestRevealedCellCenter` 救済 |
| URL / ギャラリー読込の失敗種別 | 個別エラータグ（`invalidUrl` / `fetchFailed` / `notImage` / `tooLarge` / `unreadable`）→ ツールバーの具体的メッセージ |
| ギャラリーのマニフェスト変化（mid 廃止） | `mid` を任意化し WebP `originalUrl` へフォールバック。不正行は除去、id は parse 時に重複排除 |
| Konva 描画クラッシュでアプリが空白に | 共通 `ErrorBoundary` ＋ `TabletopErrorFallback`（再試行 / マップ消去 / 閉じる） |
| IndexedDB マイグレーション | v6→v7→v8 は `onupgradeneeded` でストアを*追加*するのみ。既存行は不変 |
| 旧エクスポート書庫 | マニフェスト版数で分岐。v5 以前は table 空で import |
| Vitest で Konva が動かない（`environment: 'node'`） | Canvas 非依存ロジックは `src/tabletop/*` 純粋モジュールに集約して単体テスト。Konva 連携は 2 タブで手動確認 |

## 7. テスト戦略

### 単体（Vitest・`environment: 'node'`）

`src/tabletop/`: `grid`・`hexGrid`・`tokens`・`annotations`・
`hostValidation`・`snapshot`・`imageChunk`・`imageBackground`（URL 検証 /
fetch ガード。テストは `imageBackgroundUrl.test.ts`）・`mapGallery`・
`presetMaps`・`ping`（座標検証 ＋ さざ波アニメーションのカーブ）・
`facing`（角度の正規化・画面空間の方向ベクトル・矢じりの幾何）・
`vitals`（HP のクランプ / 比率 / バー色と状態カタログのサニタイズ）・
`keymap`（キー → ツール / 矢印デルタ / ズーム / 選択ステップの意図と
編集対象ガード）。
`src/storage/`: `tabletop`（sanitize ＋ round-trip、fake-indexeddb）・
`roomExport`・`roomImport`（`table.json` 入りのマニフェスト v6）。

Canvas に依存する描画は意図的に単体テスト対象外。上記の純粋モジュールが、
カバーすべきロジックを担う。

### 結合（手動・2 タブ）

同一 PC トークンを両タブから drag（last-write-wins）; GM の追加 / 移動 /
サイズ変更 / 削除と NPC ライブラリ配置が非 GM タブに反映; 数 MB マップが
読み込み中表示つきで両側に届く; hex グリッドのスナップ; フォグの可視性
（プレイヤーは下が見えない）; テキスト / ペン / 消しゴムの所有権; リロード復元
（host 再ホスト・プレイヤー再参加）; 別ブラウザでのエクスポート → インポート;
テンプレート vs スナップショットの読込; モバイルのピンチ / drag / オーバーレイ。

### 公開後（`CLAUDE.md` 既定）

マージ後の GitHub Actions デプロイ完了を待ち、公開 URL
<https://yamadar.github.io/trpg-dice-online/> でゴールデンパスを確認。

## 8. Phase 2 以降の候補

おおよその優先度順（実装済みは除外）:

1. ルーラー（マス距離測定）
2. 1 セッション複数マップ（シーン一覧 / 切替）
3. ミニマップ

## 9. 改訂

- v0.1 — 初版（前向きの 7 PR 計画書。PR #134）。
- v1.0 — 実装済みコードを精査して as-built 仕様に書き直し（PR #134〜#190）:
  完全なモジュール構成・ワイヤプロトコル・データフロー・永続化（DB v8 /
  エクスポート v6）・Konva 描画ツリー・実装履歴、リスク / テスト / Phase 2
  一覧の更新。
- v1.1 — Phase 2: **ピング**（一時的な「ここ見て」マーカー）。揮発性の
  `pingRequest` / `ping` ワイヤペア、`tabletop/ping.ts` 純粋モジュール ＋
  テスト、左パレットの `ping` ツール、自己アニメーションする `PingMarker`
  描画レイヤを追加。対象外 / Phase 2 一覧から削除。
- v1.2 — Phase 2: **トークンの向き（facing）**。両トークン種別に任意の
  `facing`（北から時計回りの度数）、`tokenFacingRequest` ワイヤメッセージ
  （`canMoveToken` で検証）、ポップオーバーの 8 方位コンパス、`TokenView` の
  方向矢印を追加。`tabletop/facing.ts` 純粋モジュール ＋ テスト。あわせて
  §3.7 のリロードギャップも解消（`sanitizeStoredTabletop` が `size` /
  `note` / `privateNote` / `facing` を往復）。
- v1.3 — Phase 2: **HP バー / 状態アイコン**。両トークン種別に任意の `hp`
  （`{ current, max }`）と `statuses`（カタログキー）、`tokenHpRequest` /
  `tokenStatusRequest` ワイヤメッセージ（`canMoveToken` で検証し、ホスト側で
  クランプ / サニタイズ）、`TokenView` の HP バー ＋ 絵文字状態バッジ、
  ポップオーバーの HP 入力 ＋ 状態チップを追加。`tabletop/vitals.ts` 純粋
  モジュール ＋ テスト。リロードサニタイザも両方を往復する。
- v1.4 — Phase 2: **キーボード移動・ショートカットの完全対応**。`TablePanel`
  の単一 keydown ハンドラ（純粋な `tabletop/keymap.ts` ＋ テスト駆動）で、
  選択トークンの矢印キー 1 マス移動、`1`〜`5` / 頭文字のツール切替、
  `+`/`-`/`0` ズーム、`f` センタリング、`[`/`]` 選択巡回、`Delete`、
  `Esc`（選択解除→閉じる）、`?` の `ShortcutsOverlay` 早見表を実装。
  入力フィールド編集中はすべて抑制する。
