# Translation API Research

[日本語版](TRANSLATION_API_RESEARCH.ja.md)

> Researched: 2026-05. A survey of APIs for translating free-form text
> (names, character info, chat) between Japanese and English in real time.
> **This document is research only**; no implementation is included. See the
> final "Design implications" section for the takeaways that informed the
> design.

## 1. Constraints

The app has the following characteristics that strongly constrain the choice
of translation backend:

- **Fully static site** (GitHub Pages). There is no backend we own.
- **P2P (PeerJS)**. Data flows only between peers, never through a third-party
  server we control.
- An API key embedded in client JS is **trivially extractable**, so it cannot
  be used directly.
- Using a paid API that requires a key would require **a separate proxy
  (e.g. a serverless function) to keep the key secret**, which conflicts with
  the "no backend" premise.

→ The "no key" / "fully in-browser" options are the best fit.

## 2. Candidate comparison

| API | Key | Free monthly tier | Quality (JA↔EN) | Backend? | Notes |
|-----|-----|-------------------|-----------------|----------|-------|
| Chrome built-in Translator API | No | Unlimited (on-device) | Good | **No** | Chrome/Edge 138+. On-device. |
| MyMemory API | No | ~5,000 words/day anonymously (~50,000/day with email registration) | Medium | No (CORS allowed) | Rate-limited. Prototype-grade. |
| DeepL API | Yes | Free 500k chars/month (*currently closed to new signups*) | **Best** | Proxy required | Pro: ~$5.49 per 1M chars. |
| Azure Translator | Yes | F0 2M chars/month (first 12 months only) | Good | Proxy required | After: ~$10 per 1M chars. |
| Google Cloud Translation | Yes | 500k chars/month (permanent) | Good | Proxy required | ~$20 per 1M chars. |
| LibreTranslate | None when self-hosted | Unlimited when self-hosted | Medium | Server required to self-host | The public host no longer offers free keys. |

## 3. Per-candidate details

### 3.1 Chrome built-in Translator API (recommended — first choice)

The `Translator` browser-standard API (Chrome / Edge 138+, available as of 2026).

- Translates **on device**. Language packs are downloaded on demand and reused
  offline thereafter.
- **Sends no data to Google or any third party**, matching the app's privacy
  posture exactly.
- **No key, no backend** — basically the only option that fits a static site.
- Sample usage:
  ```js
  if ('Translator' in self) {
    const translator = await Translator.create({
      sourceLanguage: 'ja', targetLanguage: 'en',
    })
    const out = await translator.translate('こんにちは')
  }
  ```
- Constraints: limited browser coverage (Chromium-based only). Hardware
  requirements (GPU with >4GB VRAM, or CPU with 16GB RAM and ≥4 cores).
  Language packs download on first use. Call `Translator.availability()`
  to feature-detect before relying on it.

### 3.2 MyMemory API (fallback)

- REST API (`https://api.mymemory.translated.net/get?q=...&langpair=ja|en`).
  **No key required**; can be fetched directly from the browser (CORS allowed).
- Free and anonymous, but **rate-limited fairly aggressively** (per-day word
  count). Production quality is not guaranteed.
- Useful as a **fallback** for browsers that lack the built-in API.

### 3.3 Commercial APIs (DeepL / Azure / Google)

- Quality is high (especially DeepL for JA↔EN) and these are production-grade.
- They all **require an API key**. Keeping that key secret on a static site
  needs a separate **serverless proxy** (Cloudflare Workers, etc.) that holds
  the key. Since this requires the operator to create an account and provision
  a key, **it is treated as research only here**.
- For future use when prioritising quality or browser coverage — DeepL for
  JA↔EN quality, Azure for the largest first-year free tier (2M chars/month).

### 3.4 LibreTranslate

- Open source. Self-hosted gives unlimited free use and full privacy, but you
  have to run the server.
- The public host has ended free keys.

## 4. Recommendation

1. **First choice: Chrome built-in Translator API.** No key, no backend, and
   privacy-preserving — fully aligned with the app's "static site / P2P /
   privacy-first" stance.
2. **Fallback: MyMemory.** Used as a lightweight backup on browsers without
   the built-in API. When neither works, fall back to **showing the original
   text** so the app keeps functioning.
3. **Future quality bump**: a commercial API (DeepL etc.) through a serverless
   proxy. Operator-provisioned and out of scope for this task.

## 5. What to translate and how

- **Targets**: chat text, player / character names, character background,
  pattern names.
- Stock roll-result strings ("X damage" etc.) are already formatted in each
  viewer's language and need no translation.
- **Sync model**: the network carries the **original text and its language**.
  Translation runs **locally in each viewer's browser** (the sender does not
  translate). This aligns with P2P, lets each viewer pick their own target
  language, and lets each pick their own translation backend.
- **Display**: show the original immediately and swap in the translation when
  ready (asynchronous, best effort). A UI to flip between original and
  translation is worth providing.
- **Cache**: memoise by `(text, sourceLang, targetLang)` to avoid retranslating.

## 6. Design implications (constraints the implementation must satisfy)

So that real-time translation can be added later without rework, the current
design / implementation must:

- Carry an **original-language field (`lang`)** on every free-form text in
  the data model (chat, names, background, pattern names). Record the
  sender's UI language at send time.
- Keep translation as a **display-layer concern**, separated from the
  domain and network layers. A natural home is `src/i18n/`. The domain model
  and the network layer deal only with the original text.
- Use a **cacheable, pure-functional interface** like
  `translate(text, from, to) => Promise<string>`.
- Never let translation success or failure break the UI — always fall back
  to the original.

## References

- [Translator API — Chrome for Developers](https://developer.chrome.com/docs/ai/translator-api)
- [Client-side translation with AI — Chrome for Developers](https://developer.chrome.com/docs/ai/translate-on-device)
- [DeepL API plans — DeepL Help Center](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans)
- [Pricing — Azure Translator](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/translator/)
- [Pricing — Google Cloud Translation](https://cloud.google.com/translate/pricing)
- [MyMemory API technical specifications](https://mymemory.translated.net/doc/spec.php)
- [LibreTranslate — GitHub](https://github.com/LibreTranslate/LibreTranslate)
