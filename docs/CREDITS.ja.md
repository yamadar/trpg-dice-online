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
