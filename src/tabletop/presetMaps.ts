/**
 * Loader for the bundled preset maps shipped under `public/maps/`.
 *
 * The GM picks one from a dropdown in the tabletop toolbar; this
 * module fetches the manifest, fetches the selected image, downscales
 * it via the same pipeline as a hand-picked file
 * (`readMapBackground`), and hands the result back to `useSession`
 * which broadcasts the new background.
 *
 * Failures degrade to an empty list / error tag so a missing or
 * malformed manifest never crashes the toolbar — the GM still has the
 * hand-pick path.
 */

import type { MapImageError, MapImageResult } from './imageBackground'
import { readMapBackground } from './imageBackground'
import type { PresetMap } from './types'

const MANIFEST_PATH = 'maps/manifest.json'

/** Resolve a `public/`-relative path against Vite's BASE_URL. */
function resolveMapUrl(rel: string): string {
  const base = import.meta.env.BASE_URL || '/'
  // Strip leading slash off `rel` so `base + rel` works whether base
  // is "/" or "/sub-path/".
  const cleaned = rel.replace(/^\/+/, '')
  return base.endsWith('/') ? base + cleaned : `${base}/${cleaned}`
}

/**
 * Fetch the preset-map manifest. The manifest is a JSON array of
 * `PresetMap` entries; an empty list (or a fetch error) yields an
 * empty array, which the toolbar treats as "no presets available".
 */
export async function loadPresetMapManifest(): Promise<PresetMap[]> {
  try {
    const res = await fetch(resolveMapUrl(MANIFEST_PATH), {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as unknown
    if (!Array.isArray(data)) return []
    const out: PresetMap[] = []
    const seen = new Set<string>()
    for (const raw of data) {
      if (typeof raw !== 'object' || raw === null) continue
      const r = raw as Record<string, unknown>
      const id = typeof r.id === 'string' ? r.id : ''
      const name = typeof r.name === 'string' ? r.name : ''
      const file = typeof r.file === 'string' ? r.file : ''
      if (!id || !name || !file) continue
      if (seen.has(id)) continue
      seen.add(id)
      const description =
        typeof r.description === 'string' ? r.description : undefined
      out.push({ id, name, file, ...(description ? { description } : {}) })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Fetch a preset map and run it through the same downscale pipeline
 * as a hand-picked file. Returns the same `MapImageResult` shape so
 * the caller (toolbar → session) handles both paths uniformly.
 */
export async function loadPresetMap(preset: PresetMap): Promise<MapImageResult> {
  try {
    const res = await fetch(resolveMapUrl(`maps/${preset.file}`), {
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: 'unreadable' as MapImageError }
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) {
      return { ok: false, error: 'unreadable' as MapImageError }
    }
    const file = new File([blob], preset.file, { type: blob.type })
    const result = await readMapBackground(file)
    if (!result.ok) return result
    return { ...result, name: preset.name }
  } catch {
    return { ok: false, error: 'unreadable' as MapImageError }
  }
}
