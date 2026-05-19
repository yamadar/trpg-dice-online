/**
 * Character portrait processing. A picked file or an imported data URL is
 * normalized into a portrait that is cheap to store and to carry in an
 * export: the longest edge is capped, and if the result is still over the
 * byte budget the image is re-encoded as progressively-lower-quality JPEG.
 */

import { dataUrlBytes, fitWithin } from '../chat/attachment'

/** A portrait's longest edge is capped to this many pixels. */
export const MAX_PORTRAIT_EDGE = 2560
/** A processed portrait is kept under this many encoded bytes (~2 MB). */
export const MAX_PORTRAIT_BYTES = 2 * 1024 * 1024
/** A source larger than this is refused outright rather than processed. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024

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
 * Normalize an image — a picked `File` or an existing `image/*` data URL —
 * into a character portrait: downscale so the longest edge fits
 * `MAX_PORTRAIT_EDGE` and, when the encoding is still over
 * `MAX_PORTRAIT_BYTES`, re-encode as JPEG with the quality stepped down
 * until it fits. A small image that already fits is returned untouched so
 * a PNG keeps its transparency. Returns null when the input cannot be
 * read, decoded, or brought under the size budget.
 */
export async function prepareCharacterImage(input: File | string): Promise<string | null> {
  try {
    let src: string
    if (typeof input === 'string') {
      if (dataUrlBytes(input) > MAX_SOURCE_BYTES) return null
      src = input
    } else {
      if (input.size > MAX_SOURCE_BYTES) return null
      src = await readAsDataUrl(input)
    }
    const img = await loadImage(src)
    const fit = fitWithin(img.naturalWidth, img.naturalHeight, MAX_PORTRAIT_EDGE)
    const unchanged = fit.width === img.naturalWidth && fit.height === img.naturalHeight
    if (unchanged && dataUrlBytes(src) <= MAX_PORTRAIT_BYTES) return src

    const canvas = document.createElement('canvas')
    canvas.width = fit.width
    canvas.height = fit.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, fit.width, fit.height)
    // Step the JPEG quality down until the encoded size fits the budget.
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const out = canvas.toDataURL('image/jpeg', quality)
      if (dataUrlBytes(out) <= MAX_PORTRAIT_BYTES) return out
    }
    return null
  } catch {
    return null
  }
}
