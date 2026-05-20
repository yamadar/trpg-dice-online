# リアルタイム翻訳 API 調査

[English](TRANSLATION_API_RESEARCH.md)

> 調査日: 2026-05。名前・キャラクター情報・チャットなどの自由入力テキストを
> 日本語 ⇄ 英語でリアルタイム翻訳するための API 調査。**本書は調査のみ**で、
> 実装は含まない。設計への反映方針は末尾の「6. 設計への反映」を参照。

## 1. 前提と制約

本アプリは次の特徴を持つため、翻訳手段の選定は強く制約される。

- **完全な静的サイト**（GitHub Pages）。自前のサーバー／バックエンドを持たない。
- **P2P（PeerJS）**。データはピア間のみでやり取りし、第三者サーバーを経由しない。
- クライアント JS に API キーを直接埋め込むと、**誰でも鍵を盗める**ため不可。
- キー必須の商用 API を使うには、鍵を秘匿する **プロキシ（サーバーレス関数等）が
  別途必要**になり、「サーバーレス」という前提と相反する。

→ 「キー不要」「ブラウザ内で完結」する手段が最も相性が良い。

## 2. 候補 API 比較

| API | キー | 月間無料枠 | 品質(JA⇄EN) | バックエンド要否 | 備考 |
|-----|------|-----------|-------------|------------------|------|
| Chrome 内蔵 Translator API | 不要 | 無制限（端末内処理） | 良好 | **不要** | Chrome/Edge 138+。オンデバイス |
| MyMemory API | 不要 | 匿名 ≈5,000 語/日（メール登録で ≈50,000 語/日） | 中 | 不要（CORS 可） | レート制限あり。試作向け |
| DeepL API | 必要 | Free 50万字/月（※新規受付停止） | **最良** | プロキシ必須 | Pro: 約 $5.49 / 100万字 |
| Azure Translator | 必要 | F0 200万字/月（最初の12か月のみ） | 良好 | プロキシ必須 | 以降 約 $10 / 100万字 |
| Google Cloud Translation | 必要 | 50万字/月（恒久） | 良好 | プロキシ必須 | 約 $20 / 100万字 |
| LibreTranslate | 自前運用は不要 | 自己ホストなら無制限 | 中 | 自己ホスト時はサーバー必須 | 公開ホスト版は有料キー化 |

## 3. 各候補の詳細

### 3.1 Chrome 内蔵 Translator API（推奨・第一候補）

`Translator` というブラウザ標準 API（Chrome / Edge 138 以降、2026年時点で利用可）。

- **オンデバイス**で翻訳。言語パックを必要時にダウンロードし、以降はオフラインでも動作。
- **データを Google や第三者に一切送らない** → 本アプリのプライバシー方針と完全に一致。
- **キー不要・バックエンド不要** → 静的サイトのまま実装できる唯一級の選択肢。
- 利用例（概略）:
  ```js
  if ('Translator' in self) {
    const translator = await Translator.create({
      sourceLanguage: 'ja', targetLanguage: 'en',
    })
    const out = await translator.translate('こんにちは')
  }
  ```
- 制約: 対応ブラウザが限られる（Chromium 系のみ）。端末スペック要件あり
  （GPU は VRAM 4GB 超、または CPU 16GB RAM・4 コア以上）。初回は言語パックの
  ダウンロードが発生。`Translator.availability()` で利用可否を事前判定すべき。

### 3.2 MyMemory API（フォールバック候補）

- REST API（`https://api.mymemory.translated.net/get?q=...&langpair=ja|en`）。
  **キー不要**で、ブラウザから直接 fetch 可能（CORS 許可）。
- 無料・匿名で利用可能だが**レート制限が厳しい**（語数/日）。本番品質は保証されない。
- 内蔵 API 非対応ブラウザ向けの**フォールバック**として有用。

### 3.3 商用 API（DeepL / Azure / Google）

- 品質は高く（特に DeepL の JA⇄EN）、本番運用に堪える。
- いずれも **API キーが必須**。静的サイトでキーを秘匿するには、
  Cloudflare Workers などの**サーバーレスプロキシ**を別途用意し、そこで鍵を保持する
  必要がある（無料枠あり）。これは利用者によるアカウント作成・鍵発行が前提となるため、
  **本タスクでは調査のみ**とする。
- 将来、翻訳品質や対応ブラウザを優先する場合の選択肢。JA⇄EN 品質重視なら DeepL、
  無料枠重視なら Azure（初年度 200万字/月）。

### 3.4 LibreTranslate

- オープンソース。自己ホストすれば無制限・無料・完全プライベート。ただしサーバー運用が必要。
- 公開ホスト版は無料キーの提供を終了済み。

## 4. 推奨方針

1. **第一候補: Chrome 内蔵 Translator API**。キー不要・バックエンド不要・プライバシー保持で、
   本アプリの「サーバーレス静的サイト」「P2P」「プライバシー重視」とすべて整合する。
2. **フォールバック: MyMemory**。内蔵 API 非対応ブラウザでは、軽量な翻訳として利用。
   未対応・失敗時は**原文をそのまま表示**してアプリの動作は止めない。
3. **将来の高品質化**: 翻訳品質や対応範囲を上げたい場合は、DeepL 等の商用 API を
   サーバーレスプロキシ経由で導入する。これは利用者によるキー発行が前提のため別タスク。

## 5. 翻訳対象と方式

- **翻訳対象テキスト**: チャット本文、プレイヤー名 / キャラクター名、キャラクター背景情報、
  パターン名。
- ロール結果の定型文（「○ダメージ」等）は既に閲覧者の言語で整形されるため翻訳不要。
- **同期方式**: ネットワークには**原文と原文の言語**を送る。翻訳は**各閲覧者の端末で
  ローカルに行う**（送信側で翻訳しない）。P2P と整合し、閲覧者ごとに自分の言語へ
  翻訳でき、翻訳バックエンドの選択も各自に委ねられる。
- **表示**: 原文を即時表示し、翻訳が完了したら差し替える（非同期・ベストエフォルト）。
  原文と訳文を切り替えられる UI を検討する。
- **キャッシュ**: `(原文, 原言語, 訳言語)` をキーに翻訳結果をメモ化し、再翻訳を避ける。

## 6. 設計への反映（今後の実装が満たすべき条件）

リアルタイム翻訳を後から無理なく載せられるよう、今後の設計・実装で次を守る。

- 自由入力テキスト（チャット・名前・背景・パターン名）は、データモデル上に
  **原文の言語 (`lang`)** を持たせる。送信時に送信者の UI 言語を記録する。
- 翻訳は**表示層の関心事**として分離する（`src/i18n/` 配下に翻訳ユーティリティを置く想定）。
  ドメインモデルやネットワーク層は原文のみを扱う。
- 翻訳結果は**キャッシュ可能**な純粋関数的インターフェース
  （`translate(text, from, to) => Promise<string>`）にする。
- 翻訳の有無・成否にかかわらず UI が破綻しないこと（原文フォールバック）。

## 参考

- [Translator API — Chrome for Developers](https://developer.chrome.com/docs/ai/translator-api)
- [Client-side translation with AI — Chrome for Developers](https://developer.chrome.com/docs/ai/translate-on-device)
- [DeepL API plans — DeepL Help Center](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans)
- [Pricing — Azure Translator](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/translator/)
- [Pricing — Google Cloud Translation](https://cloud.google.com/translate/pricing)
- [MyMemory API technical specifications](https://mymemory.translated.net/doc/spec.php)
- [LibreTranslate — GitHub](https://github.com/LibreTranslate/LibreTranslate)
