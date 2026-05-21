# サードパーティ素材・クレジット

このページは、アプリに同梱しているサードパーティ素材と、その再配布
ライセンスを一覧にしたものです。

## アイコン

### Lucide

UI 部品（クローズ・ゴミ箱・フィードフィルタの「すべて」「チャット」
「ファイル」チップ）は [Lucide](https://lucide.dev) を `lucide-react`
パッケージ経由で利用しています。

- ライセンス: [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE)

### Game Icons — `dice-twenty-faces-twenty`

フィードフィルタ「ダイス」に使う 20 面ダイスのシルエットは
[game-icons.net](https://game-icons.net/1x1/delapouite/dice-twenty-faces-twenty.html)
の素材です。

- 作者: **Delapouite** (https://delapouite.com)
- ライセンス: **CC BY 3.0** — https://creativecommons.org/licenses/by/3.0/deed.ja
- 変更点: 原本の `fill="#000"` を `currentColor` に置換し、周囲の
  テキストカラーを継承するようにしました。
- ファイル: [`src/assets/icons/dice-twenty-faces-twenty.svg`](../src/assets/icons/dice-twenty-faces-twenty.svg)
  に SVG コメント形式で同じ帰属を残しています。同じパスデータは
  [`src/components/icons.tsx`](../src/components/icons.tsx) の
  `D20Icon` コンポーネントにもインライン化しています。
