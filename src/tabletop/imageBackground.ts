/**
 * Background-map image processing.
 *
 * Battle maps run larger than chat attachments (chat caps at 1600 px /
 * 3 MB; a map keeps its detail at 3000 px). The wire-level chunking in
 * `./imageChunk.ts` lets the result be megabytes, so there is no
 * payload ceiling here — only the long-edge cap and a sanity limit on
 * the input file size.
 *
 * The function is shaped like `chat/attachment.ts`'s `downscaleImage`,
 * but kept separate so the chat path's tight 3 MB ceiling does not
 * accidentally start rejecting maps (or vice versa).
 */

import { dataUrlBytes, fitWithin } from '../chat/attachment'

/** Largest file a GM may pick before downscaling. Generous because the
 *  result gets shrunk; matches the chat ceiling so the UI message is
 *  the same. */
export const MAX_MAP_INPUT_BYTES = 8 * 1024 * 1024
/** Long-edge cap for the downscaled map. */
export const MAX_MAP_EDGE = 3000
/** JPEG quality used when a PNG would be too large. */
const JPEG_QUALITY = 0.85

/** `notImage` is the URL-load–specific tag for "fetched, but the bytes are
 *  not an image" — surfaced as a distinct message so the GM understands
 *  the URL resolved but pointed at a HTML page / 404 body / etc. */
export type MapImageError = 'tooLarge' | 'unreadable' | 'notImage' | 'invalidUrl' | 'fetchFailed'

export type MapImageResult =
  | {
      ok: true
      dataUrl: string
      width: number
      height: number
      name: string
    }
  | { ok: false; error: MapImageError }

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}

/**
 * Parse a user-supplied string into an HTTP(S) URL, rejecting anything
 * else (data:, file:, javascript:, blank input). Returning `null` lets
 * the caller surface a structured error tag rather than catching an
 * exception.
 */
export function parseHttpUrl(input: string): URL | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

/**
 * Derive a sensible display name for a fetched map. The URL's last path
 * segment is the obvious choice; falling back to the hostname keeps the
 * tooltip non-empty for "naked" URLs like `https://example.com/`.
 */
export function filenameFromUrl(url: URL): string {
  const segments = url.pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  if (last) {
    try {
      return decodeURIComponent(last)
    } catch {
      return last
    }
  }
  return url.hostname || 'map'
}

export type FetchedMapBlob =
  | { ok: true; file: File }
  | { ok: false; error: MapImageError }

/**
 * Pull a remote map image into a `File` ready for `readMapBackground`.
 * Split out from `readMapBackgroundFromUrl` so the URL-validation +
 * fetch + content-type + size guard stack can be unit-tested without
 * driving the `<canvas>` pipeline (which the Node-only Vitest env can't
 * host).
 *
 * Error tags:
 *   - `invalidUrl`   bad / empty / non-HTTP input
 *   - `fetchFailed`  network error, CORS block, or non-2xx response
 *   - `notImage`     URL resolved but the body is not an image
 *   - `tooLarge`     blob exceeds the same 8 MB ceiling as a picked file
 */
export async function fetchMapBlob(input: string): Promise<FetchedMapBlob> {
  const parsed = parseHttpUrl(input)
  if (!parsed) return { ok: false, error: 'invalidUrl' }
  let res: Response
  try {
    res = await fetch(parsed.toString(), { cache: 'no-store' })
  } catch {
    return { ok: false, error: 'fetchFailed' }
  }
  if (!res.ok) return { ok: false, error: 'fetchFailed' }
  let blob: Blob
  try {
    blob = await res.blob()
  } catch {
    return { ok: false, error: 'fetchFailed' }
  }
  if (!blob.type.startsWith('image/')) {
    return { ok: false, error: 'notImage' }
  }
  if (blob.size > MAX_MAP_INPUT_BYTES) {
    return { ok: false, error: 'tooLarge' }
  }
  const name = filenameFromUrl(parsed)
  const file = new File([blob], name, { type: blob.type })
  return { ok: true, file }
}

/**
 * Fetch a remote image by URL and run it through the same downscale
 * pipeline as a hand-picked file. Error tags mirror `fetchMapBlob`
 * plus the `unreadable` tag that the underlying `<canvas>` decode
 * surfaces when a fetched blob is malformed.
 */
export async function readMapBackgroundFromUrl(
  input: string,
): Promise<MapImageResult> {
  const fetched = await fetchMapBlob(input)
  if (!fetched.ok) return { ok: false, error: fetched.error }
  return readMapBackground(fetched.file)
}

/**
 * Turn a picked image File into a sendable background map. Files are
 * downscaled to fit `MAX_MAP_EDGE` on the long edge. The result keeps
 * the original PNG when it makes sense; otherwise JPEG re-encodes for
 * a fraction of the byte count.
 */
export async function readMapBackground(file: File): Promise<MapImageResult> {
  if (file.size > MAX_MAP_INPUT_BYTES) return { ok: false, error: 'tooLarge' }
  if (!file.type.startsWith('image/')) return { ok: false, error: 'unreadable' }
  try {
    const original = await readAsDataUrl(file)
    const img = await loadImage(original)
    const fit = fitWithin(img.naturalWidth, img.naturalHeight, MAX_MAP_EDGE)
    const unchanged =
      fit.width === img.naturalWidth && fit.height === img.naturalHeight
    if (unchanged) {
      return {
        ok: true,
        dataUrl: original,
        width: fit.width,
        height: fit.height,
        name: file.name,
      }
    }
    const canvas = document.createElement('canvas')
    canvas.width = fit.width
    canvas.height = fit.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      // No 2D context available (extremely rare). Surface the original
      // as-is rather than silently dropping the map.
      return {
        ok: true,
        dataUrl: original,
        width: img.naturalWidth,
        height: img.naturalHeight,
        name: file.name,
      }
    }
    ctx.drawImage(img, 0, 0, fit.width, fit.height)
    // PNG keeps the alpha channel; JPEG is the smaller fallback for
    // photographic maps where the file would otherwise be many MB.
    let dataUrl: string
    if (file.type === 'image/png') {
      const png = canvas.toDataURL('image/png')
      // 6 MB threshold: above this, the PNG is photographic enough that
      // re-encoding as JPEG saves orders of magnitude. Lossless PNG
      // stays the default for line art / dungeon maps.
      dataUrl = dataUrlBytes(png) > 6 * 1024 * 1024
        ? canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        : png
    } else {
      dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    }
    return {
      ok: true,
      dataUrl,
      width: fit.width,
      height: fit.height,
      name: file.name,
    }
  } catch {
    return { ok: false, error: 'unreadable' }
  }
}
