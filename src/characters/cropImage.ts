/**
 * Crop a source image into a square data URL using the pixel area
 * returned by react-easy-crop's `onCropComplete`. The crop canvas is
 * sized to the requested area's pixel dimensions, so the output keeps
 * the user's chosen zoom level (no extra downscale here — the
 * portrait pipeline takes care of the long-edge cap downstream).
 *
 * Returns `null` when the source cannot be decoded.
 */

interface PixelArea {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}

export async function cropImageToDataUrl(
  src: string,
  area: PixelArea,
): Promise<string | null> {
  try {
    const img = await loadImage(src)
    const size = Math.max(1, Math.round(Math.min(area.width, area.height)))
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // The portrait pipeline downstream re-encodes as JPEG with a quality
    // ladder, so the format chosen here is provisional — PNG keeps any
    // alpha pixels in the cropped area until that step runs.
    ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
