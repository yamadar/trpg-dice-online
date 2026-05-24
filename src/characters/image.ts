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
/**
 * NPC token images are rendered at one grid cell (typically 50 px) and
 * peak at a couple-of-cells preview, so 300 px on the long edge is
 * plenty without being wasteful. Smaller bytes also make `tokenUpsert`
 * snappy since these travel inline.
 */
export const MAX_NPC_TOKEN_EDGE = 300
/** ~200 KB ceiling for NPC tokens — well under the P2P per-message cap. */
export const MAX_NPC_TOKEN_BYTES = 200 * 1024
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
 * to fit a (max edge, max bytes) budget: downscale long edge, keep the
 * source PNG when it already fits, otherwise re-encode as JPEG stepping
 * the quality down until it fits. Returns null when the input cannot be
 * read, decoded, or brought under the size budget.
 *
 * Shared by `prepareCharacterImage` (2560 px / 2 MB portraits) and
 * `prepareNpcTokenImage` (300 px / 200 KB tokens). Both budgets fall
 * out of how the result is shown — portraits open into a lightbox, so
 * they need detail; NPC tokens never render larger than a couple of
 * cells, so a tighter cap saves bytes per `tokenUpsert`.
 */
async function prepareImage(
  input: File | string,
  maxEdge: number,
  maxBytes: number,
): Promise<string | null> {
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
    const fit = fitWithin(img.naturalWidth, img.naturalHeight, maxEdge)
    const unchanged = fit.width === img.naturalWidth && fit.height === img.naturalHeight
    if (unchanged && dataUrlBytes(src) <= maxBytes) return src

    const canvas = document.createElement('canvas')
    canvas.width = fit.width
    canvas.height = fit.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, fit.width, fit.height)
    // Step the JPEG quality down until the encoded size fits the budget.
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const out = canvas.toDataURL('image/jpeg', quality)
      if (dataUrlBytes(out) <= maxBytes) return out
    }
    return null
  } catch {
    return null
  }
}

/** Portrait: 2560 px long edge, ~2 MB. */
export function prepareCharacterImage(input: File | string): Promise<string | null> {
  return prepareImage(input, MAX_PORTRAIT_EDGE, MAX_PORTRAIT_BYTES)
}

/** NPC / monster token image: 300 px long edge, ~200 KB. */
export function prepareNpcTokenImage(input: File | string): Promise<string | null> {
  return prepareImage(input, MAX_NPC_TOKEN_EDGE, MAX_NPC_TOKEN_BYTES)
}
