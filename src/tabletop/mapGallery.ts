/**
 * Data-access layer for the bundled "TRPG map gallery" picker — a
 * small wrapper around the sibling [trpg-map-organizer] GitHub Pages
 * site, which publishes a `maps.json` manifest, a per-language
 * `i18n.json` and three image resolutions (thumbnail / mid / original)
 * for ~300 hand-curated tabletop maps.
 *
 * The picker UI lives in `components/MapGalleryDialog.tsx`; this file
 * is just the I/O + validation layer so the dialog stays render-only
 * and the manifest parsing is unit-testable in the Node-only Vitest
 * environment.
 *
 * [trpg-map-organizer]: https://yamadar.github.io/trpg-map-organizer/
 */

/** Where the gallery lives. Hard-coded because the picker is
 *  *specifically* this sibling project; environment override would
 *  imply a generic gallery contract, which we don't promise. */
export const GALLERY_BASE = 'https://yamadar.github.io/trpg-map-organizer/'

const MANIFEST_PATH = 'data/maps.json'
const I18N_PATH = 'data/i18n.json'
/** Original PNGs sit under `originals/<file>` (the project's
 *  app.js confirms this with `originals/${encodeURIComponent(m.file)}`). */
const ORIGINAL_DIR = 'originals/'
/** Mid-resolution JPEGs (≈1280 px long edge) under `images/mid/<mid>`. */
const MID_DIR = 'images/mid/'
/** Thumbnails under `images/thumb/<thumb>`. The picker uses these in
 *  the grid; a 300-thumbnail page stays under ~3 MB of image bytes. */
const THUMB_DIR = 'images/thumb/'

/** One map entry as published in `maps.json`. The id is an integer
 *  in the source; we keep it as `number` and only stringify when used
 *  as a React key. */
export interface GalleryMap {
  id: number
  /** Filename of the original PNG (relative to `originals/`). */
  file: string
  /** Filename of the thumbnail JPG (relative to `images/thumb/`). */
  thumb: string
  /** Filename of the mid-resolution JPG (relative to `images/mid/`). */
  mid: string
  /** One-line Japanese description (~40-80 chars). The i18n.json
   *  ships a translated UI but tag-strings only, so `desc` stays
   *  Japanese regardless of the UI language. */
  desc: string
  theme: string[]
  terrain: string[]
  mood: string[]
  location: string[]
}

/** Four tag taxonomies the gallery groups maps by. The keys are the
 *  canonical Japanese tag strings — same as in `GalleryMap` arrays —
 *  and the i18n layer maps them to display strings. */
export interface GalleryTagSets {
  theme: string[]
  terrain: string[]
  mood: string[]
  location: string[]
}

export interface GalleryManifest {
  generatedAt: string
  total: number
  hasOriginals: boolean
  tags: GalleryTagSets
  maps: GalleryMap[]
}

/** Tag translations as shipped in `data/i18n.json`. Keys are the
 *  canonical Japanese tag strings, values are their English label.
 *  A missing tag falls back to the Japanese key — the picker never
 *  shows a blank chip. */
export type GalleryTagDict = Record<string, string>

export type GalleryCategory = keyof GalleryTagSets

/** Build the original (PNG) URL for a map. Used by the picker's
 *  "open original" affordance; the toolbar itself loads `mid` to keep
 *  download size predictable. The upstream contract is that file /
 *  thumb / mid are raw (un-encoded) filenames containing
 *  no folder separators, so `encodeURIComponent` is the right
 *  encoder — it matches the upstream `app.js` and handles spaces,
 *  Japanese, and other non-ASCII safely. */
export function originalUrl(map: GalleryMap): string {
  return GALLERY_BASE + ORIGINAL_DIR + encodeURIComponent(map.file)
}

/** Build the mid-resolution JPEG URL. The mid file is ≈1280 px and a
 *  fraction of the original PNG's bytes; comfortably under the
 *  toolbar's 8 MB pre-downscale cap and a sweet spot for "set as
 *  background" in one click. */
export function midUrl(map: GalleryMap): string {
  return GALLERY_BASE + MID_DIR + encodeURIComponent(map.mid)
}

/** Build the thumbnail URL for the picker grid. */
export function thumbUrl(map: GalleryMap): string {
  return GALLERY_BASE + THUMB_DIR + encodeURIComponent(map.thumb)
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function parseMap(raw: unknown): GalleryMap | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  // `typeof NaN === 'number'` and `typeof Infinity === 'number'` —
  // both would pass a bare typeof check yet break find()/React keys.
  // Require a finite number so id collisions and "NaN doesn't equal
  // NaN" don't silently misroute clicks.
  const id =
    typeof r.id === 'number' && Number.isFinite(r.id) ? r.id : null
  const file = typeof r.file === 'string' ? r.file : null
  const thumb = typeof r.thumb === 'string' ? r.thumb : null
  const mid = typeof r.mid === 'string' ? r.mid : null
  if (id === null || !file || !thumb || !mid) return null
  return {
    id,
    file,
    thumb,
    mid,
    desc: typeof r.desc === 'string' ? r.desc : '',
    theme: parseStringArray(r.theme),
    terrain: parseStringArray(r.terrain),
    mood: parseStringArray(r.mood),
    location: parseStringArray(r.location),
  }
}

function parseTagSets(raw: unknown): GalleryTagSets {
  const empty: GalleryTagSets = {
    theme: [],
    terrain: [],
    mood: [],
    location: [],
  }
  if (typeof raw !== 'object' || raw === null) return empty
  const r = raw as Record<string, unknown>
  return {
    theme: parseStringArray(r.theme),
    terrain: parseStringArray(r.terrain),
    mood: parseStringArray(r.mood),
    location: parseStringArray(r.location),
  }
}

/**
 * Parse a raw value that may have been fetched from `maps.json`. Kept
 * separate from `loadGalleryManifest` so unit tests can drive bad /
 * partial JSON shapes without mocking `fetch`.
 *
 * Returns `null` for shapes that aren't recognisable as a manifest at
 * all (missing `maps` array, not an object, etc). Partial garbage —
 * individual map entries with missing fields — is dropped silently so
 * the picker still works on the salvageable rows.
 */
export function parseGalleryManifest(raw: unknown): GalleryManifest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.maps)) return null
  const maps: GalleryMap[] = []
  // De-dup by id (first occurrence wins). A duplicated id collides
  // on React keys in the grid AND makes
  // `manifest.maps.find(m => m.id === pickedId)` return the wrong
  // entry on the second one, so we drop the dupe at parse time.
  const seen = new Set<number>()
  for (const entry of r.maps) {
    const m = parseMap(entry)
    if (!m) continue
    if (seen.has(m.id)) continue
    seen.add(m.id)
    maps.push(m)
  }
  return {
    generatedAt:
      typeof r.generated_at === 'string' ? r.generated_at : '',
    // `Number.isFinite` keeps NaN/Infinity from sneaking through as
    // a valid `total` (typeof NaN is 'number').
    total:
      typeof r.total === 'number' && Number.isFinite(r.total)
        ? r.total
        : maps.length,
    hasOriginals: r.has_originals === true,
    tags: parseTagSets(r.tags),
    maps,
  }
}

/**
 * Parse a raw value that may have been fetched from `i18n.json`.
 * Currently we only consume the `tags` mapping (Japanese →
 * English) — the manifest's `ui` section is for the upstream site's
 * own UI and would conflict with this app's translation pipeline.
 */
export function parseGalleryTagDict(raw: unknown): GalleryTagDict {
  if (typeof raw !== 'object' || raw === null) return {}
  const r = raw as Record<string, unknown>
  const tags = r.tags
  if (typeof tags !== 'object' || tags === null) return {}
  const out: GalleryTagDict = {}
  for (const [k, v] of Object.entries(tags as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

/**
 * Render a tag for the user's current UI language. Japanese UI uses
 * the source tag verbatim (since the canonical form *is* Japanese);
 * every other language pulls the English label from `i18n.json` and
 * falls back to the source tag when an entry is missing — the picker
 * never displays an empty chip.
 *
 * Marked pure so it can also be used inside `useMemo` calculations
 * without surprising re-renders.
 */
export function tagLabel(
  tag: string,
  lang: string,
  dict: GalleryTagDict | null,
): string {
  if (lang === 'ja') return tag
  const en = dict?.[tag]
  return en || tag
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as unknown
  } catch {
    return null
  }
}

/** Fetch and validate the gallery manifest. Returns `null` for any
 *  failure — the picker UI then surfaces a generic "could not load"
 *  message rather than guessing at the cause. */
export async function loadGalleryManifest(): Promise<GalleryManifest | null> {
  const raw = await fetchJson(GALLERY_BASE + MANIFEST_PATH)
  return parseGalleryManifest(raw)
}

/** Fetch the tag translation dictionary. Returns `null` on a network
 *  / parse failure so the caller can distinguish "haven't tried yet"
 *  from "tried, got nothing" — useful for a one-shot retry on a
 *  later open. A successful fetch with an empty `tags` map returns
 *  `{}` (truthy), which the caller treats as "tried, nothing here". */
export async function loadGalleryTagDict(): Promise<GalleryTagDict | null> {
  const raw = await fetchJson(GALLERY_BASE + I18N_PATH)
  if (raw === null) return null
  return parseGalleryTagDict(raw)
}

/**
 * Tag-filter logic. `selected` is per-category — a category with an
 * empty set imposes no constraint. Across categories we always AND;
 * within a single category the caller picks `mode`:
 *   - `'or'` (default): the map matches if it carries ANY of the
 *     selected tags in that category.
 *   - `'and'`: the map must carry EVERY selected tag in that category.
 *
 * Pulled out as a pure function so unit tests can verify the matrix
 * (single category, multi-category, mode flips) without rendering.
 */
export function filterMaps(
  maps: ReadonlyArray<GalleryMap>,
  selected: Readonly<Record<GalleryCategory, ReadonlySet<string>>>,
  mode: 'and' | 'or',
): GalleryMap[] {
  const cats: GalleryCategory[] = ['theme', 'terrain', 'mood', 'location']
  return maps.filter((m) => {
    for (const cat of cats) {
      const want = selected[cat]
      if (want.size === 0) continue
      const have = m[cat]
      if (mode === 'and') {
        for (const t of want) {
          if (!have.includes(t)) return false
        }
      } else {
        let ok = false
        for (const t of want) {
          if (have.includes(t)) {
            ok = true
            break
          }
        }
        if (!ok) return false
      }
    }
    return true
  })
}

/**
 * Substring search over file name and description. Both are folded
 * to lower-case so a user typing "DUNGEON" still hits "dungeon" in
 * the filename. The search is intentionally simple — no fuzzy
 * matching — so a future translation pass can replace it with
 * something language-aware without breaking expectations.
 */
export function searchMaps(
  maps: ReadonlyArray<GalleryMap>,
  query: string,
): GalleryMap[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...maps]
  return maps.filter(
    (m) =>
      m.file.toLowerCase().includes(q) ||
      m.desc.toLowerCase().includes(q),
  )
}
