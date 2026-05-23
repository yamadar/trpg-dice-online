# テーブルマップ実装プラン

[English](TABLETOP_IMPLEMENTATION.md)

> 機能仕様は [`REQUIREMENTS.ja.md` §3.15](REQUIREMENTS.ja.md) を参照。
> 本書は実装の進め方（PR 分割・リスク・テスト方針）に焦点を置く。

## 1. スコープ

- **対象**: スクエアグリッド + PC トークン + GM 専用トークン + 背景画像 1 枚 +
  リロード復元 + ルームエクスポート / インポート対応
- **対象外（Phase 2 以降）**: ヘックスグリッド、ルーラー、ピング、サイズ違い
  トークン、向き、HP バー、フォグ・オブ・ウォー、フリーハンドドロー、複数
  マップ、ミニマップ、キーボード移動

## 2. アーキテクチャの変更点

### 新規ファイル

| ファイル | 役割 |
|---|---|
| `src/tabletop/types.ts` | `TabletopState`, `Token`, `Grid` の型定義 |
| `src/tabletop/grid.ts` | グリッド計算・スナップの純粋関数 |
| `src/tabletop/imageChunk.ts` | 大きな画像のチャンク分割・再構築 |
| `src/components/TablePanel.tsx` | Konva ベースのテーブル画面（全画面モード） |
| `src/components/TableFeedSheet.tsx` | 全画面時の swipe-up bottom sheet フィード |
| `src/components/TableToolbar.tsx` | グリッド設定・マップ設定・GM トークン管理 UI |
| `src/storage/tabletop.ts` | IndexedDB の `sessionTable` ストア操作 |

### 既存への変更

| ファイル | 変更内容 |
|---|---|
| `src/net/protocol.ts` | メッセージ型追加（`tableState` / `tokenMove` / `tokenUpsert` / `tokenRemove` / `mapMeta` / `mapChunk` / `gridChange`）、`Snapshot` に `tabletopState` |
| `src/hooks/useSession.ts` | `tabletopState` の host 権威同期、`tableActions` API、welcome snapshot 拡張 |
| `src/storage/roomLog.ts` | `DB_VERSION` 6→7、`sessionTable` ストア新設 + マイグレーション |
| `src/storage/roomExport.ts` / `roomImport.ts` | マニフェスト v6 へ。`table.json` と `attachments/maps/*` を入出力（v5 以前互換） |
| `src/components/Dock.tsx` | テーブルマップアイコンと `SheetId` 追加 |
| `src/App.tsx` | テーブルマップは Dock のシートではなく全画面モードで起動。`showTable` state を新設 |
| `src/i18n/translations/*.ts`（19 言語） | `tabletop.*` キー追加（パリティテストで担保） |
| `package.json` | `react-konva`, `konva` を依存に追加 |

### データフロー

**トークン同期（ホスト権威 / last-write-wins）**:
1. クライアントが drag → ローカル即時表示 + 約 20Hz で `tokenMove` 送信
2. ホストが受信 → `tabletopState.tokens` を更新 → 全員に `tokenMove`
   ブロードキャスト
3. 各クライアントは host 経由の更新を「正」として上書き
4. 同一トークンの drag 競合は host の後勝ち（last-write-wins）

**背景画像のチャンク分割転送**:
1. GM がアップロード → ホストで長辺 3000px に縮小 + PNG/JPEG 化
2. 3MB 以下なら `mapMeta` 1 通で送信。超過時は `mapChunk(seq, total, bytes)`
   で分割
3. クライアントは受信中「読み込み中」表示、揃ったら data URL に再構築
4. IndexedDB の `sessionTable.background` に保存（送信元・受信先とも）

## 3. PR 分割

各 PR は **実装 → 単体テスト → セルフレビュー → コメント整備 → commit →
push → PR 作成 → Copilot レビュー対応 → マージ** の順で進める（`CLAUDE.md`
規定）。ブランチは `feature/tabletop-{step}` を基本とし、PR は base = `main`
で出す。

### PR 1: 型・プロトコル・純粋ユーティリティ

**目的**: 基礎の型と純粋関数の整備。UI なし。

- `src/tabletop/types.ts`
- `src/tabletop/grid.ts`: `snapToGrid`, `worldToCell`, etc.
- `src/tabletop/imageChunk.ts`: `chunkBytes`, `reassembleChunks`
- `src/net/protocol.ts`: メッセージ型を追加、`Snapshot` に `tabletopState`
- Vitest 単体テスト（スナップ計算・チャンク往復・型ガード）

**受け入れ**: `npm run build`, `npm test`, `npm run lint` がすべて通る。

### PR 2: IndexedDB v7 + ストレージ層

**目的**: テーブル状態の永続化基盤。

- `src/storage/roomLog.ts`: `DB_VERSION` 6→7、`sessionTable` ストア新設
- `src/storage/tabletop.ts`: `saveTabletop` / `loadTabletop` /
  `deleteTabletopForSession`
- `deleteSession` / `deleteAllSessions` で `sessionTable` も clear
- 単体テスト（fake-indexeddb）

**受け入れ**: 既存の永続化テストが通る + 新規ストアの保存・取得が動く。

### PR 3: TablePanel + Konva 基盤（トークンなし）

**目的**: Stage・グリッド描画・pan / zoom の骨格。

- 依存追加: `react-konva`, `konva`
- `useSession`: `tabletopState` を host 権威で保持、メッセージ受信処理、
  welcome snapshot に同梱、変更時の broadcast。トークンはまだ空配列のまま
- `src/components/TablePanel.tsx`: Konva Stage、グリッドレイヤ（square のみ）
- pan: タッチ 2 本指 / マウス右ドラッグ / Space + ドラッグ
- zoom: ピンチ / マウスホイール（25%〜400%）
- `src/components/TableToolbar.tsx`: グリッド設定 UI（セルサイズ・原点
  オフセット・線色・透明度・スナップ）
- `src/components/Dock.tsx`: テーブルマップアイコン追加（Lucide `Grid2X2` 採用案）
- `src/App.tsx`: 全画面モードの開閉 state
- i18n: `tabletop.title` / `tabletop.grid.*` を ja/en のみ追加（残り 17 言語は PR 7）

**受け入れ**: GM がテーブルマップを開き、グリッドを設定でき、pan/zoom が動作する。

### PR 4: PC トークン

**目的**: セッションキャラから PC トークン生成・ドラッグ・同期。

- `useSession`: トークン CRUD reducer + 約 20Hz throttled drag broadcaster
- `TablePanel`: トークンレイヤ（円形 + ポートレート画像）、ドラッグ
- PC トークン自動追加: キャラがセッション参加時に未配置位置で生成
- 権限: PC トークンはオーナーと GM のみドラッグ可
- ピンチとドラッグの混在禁止（pointerCount で分岐）
- 単体テスト: throttle、権限判定、スナップ
- 結合テスト: 2 タブで last-write-wins を確認

**受け入れ**: 2 タブで PC トークンを動かしあえ、drag 中も滑らかで release 後の
最終位置が双方で一致する。

### PR 5: 背景マップアップロード + チャンク転送

**目的**: 背景画像の配置と大画像対応。

- `TableToolbar`: 「マップを設定」ボタン・ドロップエリア（GM のみ）
- 新規 `src/tabletop/imageBackground.ts`（長辺 3000px、PNG/JPEG、最大 8MB 入力）
- 3MB 超のチャンク送信: `mapMeta` で総バイト・チャンク数予告 →
  `mapChunk(seq, bytes)` で順次送信 → 完了検知で確定
- クライアント側: 受信中は loading 表示、揃ったら IndexedDB 保存 + 描画
- 原点オフセット調整 UI（背景内部のグリッドと論理グリッドの位置合わせ）
- 単体テスト: チャンク round-trip

**受け入れ**: 3000×2000px / 5MB の PNG を投げて参加者全員に届く。背景なし
モードも維持。

### PR 6: GM 専用トークン

**目的**: NPC / モンスター用の独立トークン。

- `TableToolbar`: 「GM トークンを追加」ボタン → 画像アップロードダイアログ
  （`prepareCharacterImage` を流用、長辺 2560px / 約 2MB）
- ラベル入力（任意）
- 配置・移動・削除（GM のみ）、削除確認は既存 `useConfirm()` を流用
- 権限: 非 GM は UI を出さず、メッセージも無視

**受け入れ**: GM のみが GM トークンを追加・移動・削除できる。非 GM タブでは
追加 UI が出ない。

### PR 7: モバイル UX、エクスポート、i18n、仕上げ

**目的**: 完成度を上げる仕上げ作業。

- 全画面モードの仕上げ: モバイルでヘッダ・Dock を隠す、safe-area 対応、
  専用閉じるボタン
- `TableFeedSheet`: 画面下から swipe-up する高さ可変フィード（つまみで調整、
  最小=ヘッダのみ・最大=半分、本体は既存 FeedList 再利用）
- 自分の最新発言の短時間トースト（最小高さでも気付けるよう）
- デスクトップでも全画面モード（同じ実装）
- `roomExport.ts` / `roomImport.ts`: マニフェスト v6、`table.json` /
  `attachments/maps/*`。v5 以前は table 空で読み込み
- i18n: `tabletop.*` を全 19 言語に追加（`translations.test.ts` のパリティで担保）
- チュートリアル: テーブルマップ紹介ステップ追加
- 多トークン時の再描画調整（`<Layer>` 分離・`batchDraw`）
- バグ修正

**受け入れ**: REQUIREMENTS §8 の Tabletop 項目すべてにチェックが入る。

## 4. リスクと対策

| リスク | 対策 |
|---|---|
| WebRTC データチャネルが drag 連発で詰まる | 20Hz throttle、必要なら unreliable mode の検討 |
| Konva 多トークン時の再描画コスト | `<Layer>` を背景・グリッド・トークンで分離、token 更新時は token layer のみ `batchDraw` |
| IndexedDB マイグレーション失敗 | v6→v7 は `onupgradeneeded` 同期内に空ストア追加するだけ。既存データは触らない |
| 背景画像のチャンク欠落 | 受信側で 5 秒以上 chunk が来なければ `tableState` を再要求するリカバリパス |
| モバイル Safari のジェスチャ干渉 | Stage コンテナに `touch-action: none`、`Konva.hitOnDragEnabled = true` |
| GM トークン削除時の race | tokenId ベースの idempotent 操作（未知 id は no-op） |
| 既存エクスポート書庫互換 | `fileVersion` 判定で v5 以前は table 空として import |
| Vitest で Konva が動かない | Canvas を必要としないロジックは `src/tabletop/*` の pure functions に集約してユニットテスト、Konva 連携は手動結合テスト |

## 5. テスト戦略

### 単体テスト（Vitest）

- グリッドスナップ・座標変換（`tabletop/grid.ts`）
- チャンク分割・再構築の round-trip（`tabletop/imageChunk.ts`）
- 権限判定（誰がどの token を動かせるか）
- throttle 関数（fake timer）
- ストレージ層（fake-indexeddb）
- メッセージ型ガード

`CLAUDE.md` 既定方針通り、`environment: 'node'` で Canvas が必要なロジックは
切り出さず純粋関数に保つ。Konva 連携は手動結合テストでカバー。

### 結合テスト（手動・2 タブ）

- 2 タブで PC トークンを同時に動かして last-write-wins が成立する
- GM タブで GM トークンを追加・移動・削除して非 GM 側に正しく反映される
- 背景画像（3000×2000px / 5MB）が両側に届く、読み込み中の表示が出る
- リロード後の復元（GM タブの再ホスト・非 GM タブの再参加）
- エクスポート ZIP → 別ブラウザで import → 状態が復元される
- モバイル（実機 / DevTools のレスポンシブモード）でピンチ / ドラッグ /
  フィードシートの動作

### 公開後の動作確認（`CLAUDE.md` 既定）

- `main` マージ後の GitHub Actions デプロイ完了を待つ
- 公開 URL でゴールデンパス確認

## 6. Phase 2 以降の候補

優先度順：

1. ヘックスグリッド対応（pointy / flat、honeycomb-grid 採用）
2. ルーラー（マス数距離測定）
3. 複数マップ管理（シーン切替）
4. ピング（一時的な「ここ見て」マーカー）
5. トークンサイズ違い（1×1, 2×2, 4×4 ...）
6. トークンの向き（facing）
7. HP バー / 状態アイコン
8. フリーハンドドロー
9. フォグ・オブ・ウォー
10. ミニマップ
11. キーボード操作完全対応

## 7. 改訂

- v0.1 — 初版（PR 分割・リスク・テスト方針）
