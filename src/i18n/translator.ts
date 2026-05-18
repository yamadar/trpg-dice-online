/**
 * Free-text translation for chat messages. The on-device Chrome
 * Translator API is tried first; the keyless MyMemory REST API is the
 * fallback for when it is unavailable or fails. Results are memoized by
 * (from, to, text) so a message is translated once and so a room export
 * can carry the translations it already has.
 *
 * This is a display-layer utility — the domain and network layers only
 * ever handle the original text and its language.
 */

import type { Lang } from './translations'

// The Chrome built-in Translator API is not yet in the standard DOM types.
interface ChromeTranslator {
  translate(input: string): Promise<string>
}
interface ChromeTranslatorFactory {
  create(opts: { sourceLanguage: string; targetLanguage: string }): Promise<ChromeTranslator>
}
declare global {
  interface Window {
    Translator?: ChromeTranslatorFactory
  }
}

/** Resolved translations, keyed by `${backend}:${from}:${to}:${text}`. */
const results = new Map<string, string>()
/** In-flight translations, so the same text is only requested once. */
const inflight = new Map<string, Promise<string>>()

function cacheKey(from: Lang, to: Lang, text: string): string {
  return `${from}:${to}:${text}`
}

/** A translation that does not finish within this window is given up on. */
const TRANSLATE_TIMEOUT_MS = 20000

/**
 * Reject if the backend has not produced a result in time, so a stuck or
 * very slow backend degrades to showing the original text.
 */
function withTimeout(p: Promise<string>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('translation timed out')), TRANSLATE_TIMEOUT_MS)
    p.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      },
    )
  })
}

// One Chrome translator per language pair, created lazily and reused.
const chromeTranslators = new Map<string, Promise<ChromeTranslator>>()

async function chromeTranslate(text: string, from: Lang, to: Lang): Promise<string> {
  const factory = window.Translator
  if (!factory) throw new Error('Chrome Translator API unavailable')
  const pair = `${from}:${to}`
  let translator = chromeTranslators.get(pair)
  if (!translator) {
    translator = factory.create({ sourceLanguage: from, targetLanguage: to })
    chromeTranslators.set(pair, translator)
    translator.catch(() => chromeTranslators.delete(pair))
  }
  return (await translator).translate(text)
}

async function myMemoryTranslate(text: string, from: Lang, to: Lang): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`)
  const data = (await res.json()) as {
    responseStatus?: number | string
    responseData?: { translatedText?: string }
  }
  const out = data.responseData?.translatedText
  if (String(data.responseStatus) !== '200' || typeof out !== 'string' || out === '') {
    throw new Error('MyMemory translation failed')
  }
  return out
}

/**
 * Resolve a translation, preferring the on-device Chrome translator and
 * falling back to MyMemory when it is unavailable or fails. Rejects only
 * when both backends fail, so the caller can fall back to the original.
 */
async function translateWithFallback(text: string, from: Lang, to: Lang): Promise<string> {
  try {
    return await withTimeout(chromeTranslate(text, from, to))
  } catch {
    return await withTimeout(myMemoryTranslate(text, from, to))
  }
}

/**
 * Translate `text` from `from` to `to`. Memoized; rejects when both
 * backends fail so the caller can fall back to showing the original text.
 */
export function translateText(text: string, from: Lang, to: Lang): Promise<string> {
  if (from === to || text.trim() === '') return Promise.resolve(text)
  const key = cacheKey(from, to, text)
  const done = results.get(key)
  if (done !== undefined) return Promise.resolve(done)
  const pending = inflight.get(key)
  if (pending) return pending
  const p = translateWithFallback(text, from, to)
    .then((out) => {
      results.set(key, out)
      inflight.delete(key)
      return out
    })
    .catch((err) => {
      inflight.delete(key)
      throw err
    })
  inflight.set(key, p)
  return p
}

/** A cached translation, if one exists — read by the room export. */
export function getCachedTranslation(text: string, from: Lang, to: Lang): string | undefined {
  return results.get(cacheKey(from, to, text))
}

/** Pre-fill the cache — used when importing a room that carries translations. */
export function seedTranslation(text: string, from: Lang, to: Lang, translated: string): void {
  results.set(cacheKey(from, to, text), translated)
}
