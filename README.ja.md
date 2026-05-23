<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>TRPG の卓に、ポケットサイズのダイスルームを。</strong></p>

<p align="center">
  ページを開いて、短いルームコードを伝えるだけ。<br/>
  アカウントもインストールも、ゲーム用サーバーも要りません。リンクとダイス、それだけです。
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>デモを開く →</strong></a>
</p>

<p align="center">
  <em><strong>Languages:</strong></em>
  <a href="README.md">English</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.hi.md">हिन्दी</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.uk.md">Українська</a>
</p>

<p align="center">
  <img src="public/images/lobby-mobile.png" width="280" alt="スマートフォンに表示された空のロビーとブランドマーク" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="ダイスロールとチャットがひとつのフィードに並んだ画面" />
</p>

## なぜ次のセッションに選ぶのか

- **コードを伝えるだけで卓が立つ。** GM がルームを作り、4〜6 文字のコードを読み上げる。プレイヤーはそれを入力するだけ。アカウントもメール確認も、登録するものは何もありません。
- **ロールは仲間の間にとどまります。** WebRTC による完全な P2P 通信なので、ロールもチャットも端末から端末へ直接届きます。私たちのサーバーは経由しません。
- **卓上のスマートフォンにちょうどいい。** モバイル優先のレイアウトで、iOS / Android に PWA としてインストールすれば全画面で起動します。
- **19 言語に対応、しかもチャットを自動翻訳。** 自分の母語のままで卓を進められるので、世界中の卓に混ざっても物語を止めません。
- **また開きたくなる作り。** キャラクター・パターン・テーマ・文字サイズ・過去のセッションまで、すべて端末のローカルに保存されます。共用キオスクではなく、あなた専用のダイス入れのように振る舞います。

## 30 秒でセッションを始める

1. **GM:** デモを開き、**ルーム → 作成**をタップしてコードを読み上げる。
2. **プレイヤー:** デモを開き、**ルーム → 参加**をタップしてコードを入力する。
3. **全員:** 振って、書き込んで、最初のクリティカル 20 にみんなで沸く。

GM はホストです。タブを開いている間だけルームは生きています。タブを閉じればセッションは終了 — それでも過去のルームはローカルに保存されているので、あとからログを読み返せます。

## ダイス入れの中身

### 読みやすいダイス

`d4 ・ d6 ・ d8 ・ d10 ・ d12 ・ d20 ・ d100`。個数・補正値、そして **ダメージ／判定**の種別。結果は卓で口に出すままの文面で表示されます — *「判定の結果 18」「グレートソード 11 ダメージ」*。出目は各ダイスを真上から見たシルエットのアイコンに数字を載せて表示するので、一目で読み取れます。

### パターン — 得意の一手をワンタップで

`2D6 + 3 ・ ダメージ`を*「グレートソード」*と名付けて保存しておけば、次のラウンドはワンタップ。パターンはキャラクター単位なので、同じ端末でふたりの PC を運用しても混ざりません。

### ポートレート・メモつきのキャラクター

ひとりのプレイヤーが複数の PC を持てます。それぞれに名前・公開背景情報・自分だけ見える非公開メモ・任意のポートレート・専用のパターン一覧・「メモも書き出しに含める」設定。JSON で書き出してバックアップし、別の端末で読み込めば、そのまま次回の卓に連れていけます。キャラクターとして振舞っているときの表示は `キャラクター名（プレイヤー名）`。

### ロールもチャットも、ひとつのフィードに

ロールとチャットは時系列でひとつのフィードに並びます。**すべて／ロール／チャット／ファイル**で絞り込めるフィルタつき。`@`メンションは候補補完つきで、`@all` は卓全員に届きます。画像を添付すると自動でダウンスケールしてから送信します。

### 過去のルームを読み返す

過去のセッションはセッション単位の永続ログとしてローカルに保存されます。ロビーから昔のルームを読み取り専用で開けますし、当時のキャラクター・最後のポートレートまで残っています。ルームまるごと（チャット・ロール・画像）を ZIP として書き出すこともできます。

### GM 向けの道具

GM は**隠しロール**を振れます。他のプレイヤーには*「隠しロールが行われた」*とだけ届き、数値は見えません。GM セクションにはルーム名の変更とコード再発行が折りたたまれており、退出ボタンは **ルームを閉じる** という表記で、セッション終了であることを明確にしています。

### UI 19 言語 &amp; チャット自動翻訳

UI は 19 言語に対応。自動翻訳をオンにすると、他プレイヤーのチャットを自分の UI 言語へ翻訳します。端末内蔵の Chrome Translator API を優先的に使い、利用できない場合は鍵不要の [MyMemory](https://mymemory.translated.net/) REST API にフォールバックします。翻訳済みメッセージの **原文** をタップすれば、相手が送ったままの文を確認できます。

### ちょっとした手触り

参加者ごとの固定カラー、控えめな入力中インジケータ、入退室イベントのフィード表示、テーマ切り替え、文字サイズ調整、GM がルームを閉じたときの丁寧な通知。

## スマホにインストール（PWA）

本サイトは Progressive Web App として動作します。一度ホーム画面に追加すれば、ブラウザの UI なしで全画面起動します。

- **Android（Chrome）:** デモを開き、メニューから **アプリをインストール**（または *ホーム画面に追加*）を選択。
- **iOS（Safari）:** デモを開き、共有ボタンから **ホーム画面に追加** を選択。

Service Worker がアプリシェルをプリキャッシュするので再起動は瞬時です。ただしルーム自体は WebRTC の P2P なので、参加・共有時はネットワークが必要です。

**画面の向き:** マニフェストでは画面向きを固定・上書きしないため、端末側の自動回転 / 画面ロック設定にそのまま従います（例: Android で自動回転を OFF にしていれば、PWA として起動したアプリでも向きは変わりません）。

## オンライン共有のしくみ

ルームは [PeerJS](https://peerjs.com/) による **WebRTC の P2P 接続** を使います。ルーム作成者（GM）がホストとなり、他のプレイヤーは GM に直接接続して、GM が共有状態を中継します。このプロジェクトが運営するサーバーを経由するゲームデータはありません。P2P であるため、ルームは GM がタブを開いている間だけ有効です。

## 技術スタック

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/)（WebRTC P2P ルーム）
- [Vitest](https://vitest.dev/)（ユニットテスト）
- GitHub Pages + GitHub Actions（ホスティング）

## 開発

```bash
npm install      # 依存パッケージのインストール
npm run dev      # 開発サーバー起動
npm test         # ユニットテスト実行
npm run lint     # ソースの Lint
npm run build    # 本番ビルド（dist/ へ出力）
```

## 設定（TURN リレー、任意）

WebRTC は、UDP がブロックされていたり対称型 NAT のネットワーク（カフェや公衆 Wi-Fi に多い）でも接続するために TURN リレーが必要です。既定では Open Relay Project の無料公開 TURN サーバーにフォールバックします（試用には十分ですが、ベストエフォートです）。

本格運用には `.env.example` を `.env` にコピーして以下を設定してください。

- `VITE_TURN_URLS` — カンマ区切りの TURN URL。UDP がブロックされた環境でも繋がるよう TCP/443 の `turns:` エントリを含めること。
- `VITE_TURN_USERNAME` — TURN のユーザー名。
- `VITE_TURN_CREDENTIAL` — TURN の資格情報（パスワード）。

> **セキュリティ注意:** Vite はすべての `VITE_*` 変数を本番ビルドへインライン化するため、ここに設定した TURN 認証情報はサイトを開いた誰でも閲覧できる状態になります。乱用リスクを抑えるため、短寿命 / 一時的な TURN 認証情報（例: TURN REST API による時限式クレデンシャル）と、プロバイダー側の制限（許可オリジン・IP フィルタ・月次クォータ）を組み合わせて運用してください。長期間有効な本番用認証情報を流用しないこと。

GitHub Pages にデプロイして使う場合は、これらをリポジトリ Secrets に追加し、`.github/workflows/deploy.yml` のビルドステップに渡します。無料の選択肢としては [Metered](https://www.metered.ca/) の無料枠や [coturn](https://github.com/coturn/coturn) のセルフホストがあります。

## デプロイ

`main` への push で GitHub Actions ワークフロー（`.github/workflows/deploy.yml`）が走り、lint・テスト・ビルドの後 GitHub Pages へ公開されます。本番のベースパスは `/trpg-dice-online/` ですが、別のホストに置く場合は `BASE_PATH` 環境変数で上書きできます。

## ドキュメント

- 要件定義・実装プラン: [`docs/REQUIREMENTS.ja.md`](docs/REQUIREMENTS.ja.md)
- 変更履歴: [`docs/CHANGELOG.ja.md`](docs/CHANGELOG.ja.md)
- リアルタイム翻訳 API の調査: [`docs/TRANSLATION_API_RESEARCH.ja.md`](docs/TRANSLATION_API_RESEARCH.ja.md)

## ライセンス

[MIT](LICENSE) © 2026 yamadar
