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

export type MapImageError = 'tooLarge' | 'unreadable'

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
