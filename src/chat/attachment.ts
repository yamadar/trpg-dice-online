import type { ChatFile } from '../net/protocol'

/**
 * Largest file a user may pick, before any image downscaling. Generous,
 * because images are shrunk afterwards; non-images are checked again
 * against MAX_PAYLOAD_BYTES once read.
 */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
/** Image attachments are downscaled so their longest edge fits this. */
export const MAX_IMAGE_EDGE = 1600
/**
 * Cap on the encoded payload actually sent over the P2P channel. WebRTC
 * data channels choke on very large messages, so anything bigger than
 * this is rejected after processing.
 */
export const MAX_PAYLOAD_BYTES = 3 * 1024 * 1024

export type AttachmentError = 'tooLarge' | 'unreadable'

export type AttachmentResult =
  | { ok: true; file: ChatFile }
  | { ok: false; error: AttachmentError }

export function isImageType(type: string): boolean {
  return type.startsWith('image/')
}

/** Human-readable size, e.g. "2.4 MB". Pure. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/**
 * Dimensions that fit (width, height) within a square of `maxEdge`,
 * keeping the aspect ratio. Returns the input unchanged when it already
 * fits. Pure.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge || longest === 0) return { width, height }
  const scale = maxEdge / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Approximate decoded byte size of a base64 data URL. Pure. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const b64 = dataUrl.slice(comma + 1)
  if (b64.length === 0) return 0
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

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
 * Downscale an image so it is cheap to send over P2P. Small images that
 * already fit are returned untouched; larger ones are redrawn on a canvas.
 * A PNG keeps its alpha channel when the result still fits the payload
 * cap; an oversized PNG falls back to JPEG rather than being rejected.
 */
async function downscaleImage(file: File): Promise<string> {
  const original = await readAsDataUrl(file)
  const img = await loadImage(original)
  const fit = fitWithin(img.naturalWidth, img.naturalHeight, MAX_IMAGE_EDGE)
  const unchanged = fit.width === img.naturalWidth && fit.height === img.naturalHeight
  if (unchanged && dataUrlBytes(original) <= MAX_PAYLOAD_BYTES) return original

  const canvas = document.createElement('canvas')
  canvas.width = fit.width
  canvas.height = fit.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  ctx.drawImage(img, 0, 0, fit.width, fit.height)
  // Keep PNG (lossless, alpha) only while it fits; otherwise JPEG, which
  // compresses photos far smaller — better than rejecting the file.
  if (file.type === 'image/png') {
    const png = canvas.toDataURL('image/png')
    if (dataUrlBytes(png) <= MAX_PAYLOAD_BYTES) return png
  }
  return canvas.toDataURL('image/jpeg', 0.82)
}

/**
 * Turn a picked File into a sendable ChatFile: images are downscaled,
 * other files are read as-is. Fails when the file is too big to read or
 * the encoded payload would still be too large for the P2P channel.
 */
export async function readAttachment(file: File): Promise<AttachmentResult> {
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'tooLarge' }
  try {
    const dataUrl = isImageType(file.type)
      ? await downscaleImage(file)
      : await readAsDataUrl(file)
    if (dataUrlBytes(dataUrl) > MAX_PAYLOAD_BYTES) return { ok: false, error: 'tooLarge' }
    return {
      ok: true,
      file: { name: file.name, type: file.type, size: file.size, dataUrl },
    }
  } catch {
    return { ok: false, error: 'unreadable' }
  }
}
