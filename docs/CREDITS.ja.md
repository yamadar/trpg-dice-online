# サードパーティ素材・クレジット

このページは、アプリに同梱しているサードパーティ素材と、その再配布
ライセンスを一覧にしたものです。

## アイコン

### Lucide

UI 部品（クローズ・ゴミ箱・フィードフィルタの「すべて」「チャット」
「ファイル」チップ）は [Lucide](https://lucide.dev) を `lucide-react`
パッケージ経由で利用しています。

- ライセンス: [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE)

### Game Icons — `perspective-dice-six-faces-one`

UI 全体のダイス表象（フィードフィルタ「ダイス」、Dock の「ダイス」、
チュートリアルの「ダイスを振る」ステップ）に使う 6 面ダイスの
透視シルエットは
[game-icons.net](https://game-icons.net/1x1/delapouite/perspective-dice-six-faces-one.html)
の素材です。小さい表示サイズ（16–22 px）でも形が崩れない d6 を採用し、
ディテールが詰まりすぎる d20 は使っていません。

- 作者: **Delapouite** (https://delapouite.com)
- ライセンス: **CC BY 3.0** — https://creativecommons.org/licenses/by/3.0/deed.ja
- 変更点: 原本の `fill="#000"` を `currentColor` に置換し、周囲の
  テキストカラーを継承するようにしました。
- ファイル: [`src/assets/icons/perspective-dice-six-faces-one.svg`](../src/assets/icons/perspective-dice-six-faces-one.svg)
  に SVG コメント形式で同じ帰属を残しています。同じパスデータは
  [`src/components/icons.tsx`](../src/components/icons.tsx) の
  `DiceIcon` コンポーネントにもインライン化しています。

## 外部画像ライブラリ

### trpg-chara-image-organizer

NPC エディタとトークンポップオーバーの「画像を変更」から開く統合
ピッカーの 2 つのライブラリタブは、姉妹リポジトリ
[trpg-chara-image-organizer](https://yamadar.github.io/trpg-chara-image-organizer/)
（同じ作者）からキャラクター画像とモンスター画像を取得して表示します。
タグ分類（種族 / 性別 / 年齢 / 職業、モンスターは `monster`）と画像
メタデータは同プロジェクトの `data/library.json` から、512 px の
WebP サムネイルも同サイトから提供されています。

- ソース: https://github.com/yamadar/trpg-chara-image-organizer
- ライブラリはピッカー初回オープン時にオンデマンドで読み込まれ
  （セッションあたり 1 回）、画像は `dist/` には含まれません。

### trpg-map-organizer

テーブルの「ギャラリー」タブは姉妹リポジトリ
[trpg-map-organizer](https://yamadar.github.io/trpg-map-organizer/)
（同じ作者が管理）からマップを取得して表示します。タグ分類
（テーマ / 地形 / 雰囲気 / 場所）とマップごとのメタデータは
同プロジェクトの `data/maps.json` から、サムネイルとオリジナル
画像（WebP）も同サイトから提供されています。

- ソース: https://github.com/yamadar/trpg-map-organizer
- ギャラリーはユーザーがピッカーを開いたときのみオンデマンドで
  読み込まれ、画像は `dist/` には含まれません。
