/**
 * Data layer for the [trpg-chara-image-organizer] sibling gallery.
 *
 * The site publishes a single `data/library.json` that splits its
 * 700+ portraits and 40+ monster icons into two arrays under known
 * tag taxonomies (race / gender / age / profession for characters,
 * `monster` for monsters). This module is the I/O + parse + filter
 * layer the picker UI sits on; it stays React-free so the parse
 * paths are unit-testable without driving a network or a DOM.
 *
 * [trpg-chara-image-organizer]:
 *   https://yamadar.github.io/trpg-chara-image-organizer/
 */

/**
 * Fall-back base URL. The fetched manifest carries its own
 * `base_url`, which the runtime uses; this constant is only a
 * safety net for the (very rare) case where parsing succeeds but
 * the field is missing, plus a stable target for tests.
 */
export const CHARA_LIBRARY_BASE =
  'https://yamadar.github.io/trpg-chara-image-organizer/'
const MANIFEST_PATH = 'data/library.json'

/** What the picker is hunting for. `'character'` and `'monster'`
 *  restrict to one of the two source arrays; `'both'` lets the user
 *  switch tabs inside the picker. */
export type CharaPickMode = 'character' | 'monster' | 'both'

/** A character entry. `labels` carry the localised Japanese tag
 *  copy that ships in the manifest — the picker prefers them over
 *  the bare English keys when the UI language is `ja`. */
export interface CharacterItem {
  id: string
  type: 'character'
  /** Path of the standard-size image relative to `baseUrl`. */
  file: string
  /** Path of the original-size image. May be absent on older
   *  manifests that only ship the 512 px variant. */
  original?: string
  race: string
  raceLabel?: string
  gender: string
  genderLabel?: string
  age: string
  ageLabel?: string
  profession: string
  professionLabel?: string
  tags: string[]
}

/** A monster entry. Variants share the same `monster` key (e.g.
 *  three `goblin` rows for three differently-armed goblins). */
export interface MonsterItem {
  id: string
  type: 'monster'
  file: string
  original?: string
  monster: string
  monsterLabel?: string
  variant?: number
  tags: string[]
}

export type LibraryItem = CharacterItem | MonsterItem

/** A single tag entry in the manifest's `tags.<category>` array. */
export interface LibraryTag {
  key: string
  labelJa?: string
}

/** Tag taxonomies. Characters use the first four; monsters use only
 *  `monster`. We keep the union flat so consumers can iterate the
 *  category list without per-mode branching. */
export type CharaCategory = 'race' | 'gender' | 'age' | 'profession'
export type MonsterCategory = 'monster'
export type LibraryCategory = CharaCategory | MonsterCategory

export const CHARA_CATEGORIES: ReadonlyArray<CharaCategory> = [
  'race',
  'gender',
  'age',
  'profession',
]
export const MONSTER_CATEGORIES: ReadonlyArray<MonsterCategory> = ['monster']

export interface LibraryManifest {
  /** Absolute URL prefix every `file` / `original` path resolves
   *  against. Reads `base_url` from the JSON, falls back to the
   *  bundled constant when missing so `url(item)` never returns a
   *  relative path. */
  baseUrl: string
  characters: ReadonlyArray<CharacterItem>
  monsters: ReadonlyArray<MonsterItem>
  /** Per-category tag rosters. Used by the picker to render filter
   *  chips even before the user has selected anything. */
  tags: {
    race: ReadonlyArray<LibraryTag>
    gender: ReadonlyArray<LibraryTag>
    age: ReadonlyArray<LibraryTag>
    profession: ReadonlyArray<LibraryTag>
    monster: ReadonlyArray<LibraryTag>
  }
}

/** Build the picker grid URL for an item. Uses the manifest's
 *  declared `baseUrl`; the upstream contract is that `file` is
 *  already URL-safe (lowercase ASCII, hyphens, slashes) so no
 *  encoding is needed beyond the slash-preserving default. */
export function itemUrl(item: LibraryItem, manifest: LibraryManifest): string {
  return joinBase(manifest.baseUrl, item.file)
}

/** Build the original-size URL when the manifest supplies one;
 *  falls back to the standard-size URL when it does not. */
export function itemOriginalUrl(
  item: LibraryItem,
  manifest: LibraryManifest,
): string {
  const path = item.original ?? item.file
  return joinBase(manifest.baseUrl, path)
}

function joinBase(base: string, path: string): string {
  const trimmedBase = base.endsWith('/') ? base : `${base}/`
  const trimmedPath = path.startsWith('/') ? path.slice(1) : path
  return trimmedBase + trimmedPath
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function parseTag(raw: unknown): LibraryTag | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const key = typeof r.key === 'string' ? r.key : null
  if (!key) return null
  const labelJa = typeof r.labelJa === 'string' ? r.labelJa : undefined
  return labelJa !== undefined ? { key, labelJa } : { key }
}

function parseTagArray(raw: unknown): LibraryTag[] {
  if (!Array.isArray(raw)) return []
  const out: LibraryTag[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    const t = parseTag(entry)
    if (!t) continue
    if (seen.has(t.key)) continue
    seen.add(t.key)
    out.push(t)
  }
  return out
}

function parseCharacter(raw: unknown): CharacterItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.type !== 'character') return null
  const id = typeof r.id === 'string' ? r.id : null
  const file = typeof r.file === 'string' ? r.file : null
  if (!id || !file) return null
  const original = typeof r.original === 'string' ? r.original : undefined
  return {
    id,
    type: 'character',
    file,
    ...(original !== undefined ? { original } : {}),
    race: typeof r.race === 'string' ? r.race : '',
    ...(typeof r.raceLabel === 'string' ? { raceLabel: r.raceLabel } : {}),
    gender: typeof r.gender === 'string' ? r.gender : '',
    ...(typeof r.genderLabel === 'string' ? { genderLabel: r.genderLabel } : {}),
    age: typeof r.age === 'string' ? r.age : '',
    ...(typeof r.ageLabel === 'string' ? { ageLabel: r.ageLabel } : {}),
    profession: typeof r.profession === 'string' ? r.profession : '',
    ...(typeof r.professionLabel === 'string'
      ? { professionLabel: r.professionLabel }
      : {}),
    tags: parseStringArray(r.tags),
  }
}

function parseMonster(raw: unknown): MonsterItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.type !== 'monster') return null
  const id = typeof r.id === 'string' ? r.id : null
  const file = typeof r.file === 'string' ? r.file : null
  if (!id || !file) return null
  const original = typeof r.original === 'string' ? r.original : undefined
  return {
    id,
    type: 'monster',
    file,
    ...(original !== undefined ? { original } : {}),
    monster: typeof r.monster === 'string' ? r.monster : '',
    ...(typeof r.monsterLabel === 'string'
      ? { monsterLabel: r.monsterLabel }
      : {}),
    ...(typeof r.variant === 'number' && Number.isFinite(r.variant)
      ? { variant: r.variant }
      : {}),
    tags: parseStringArray(r.tags),
  }
}

/**
 * Parse a raw manifest payload. Split out from the fetcher so tests
 * can feed handcrafted shapes through the same path. Returns `null`
 * when neither array is recognisable — a few invalid entries are
 * tolerated and silently dropped (same policy as the map manifest).
 */
export function parseCharaManifest(raw: unknown): LibraryManifest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.characters) && !Array.isArray(r.monsters)) return null
  const characters: CharacterItem[] = []
  if (Array.isArray(r.characters)) {
    const seen = new Set<string>()
    for (const entry of r.characters) {
      const c = parseCharacter(entry)
      if (!c) continue
      if (seen.has(c.id)) continue
      seen.add(c.id)
      characters.push(c)
    }
  }
  const monsters: MonsterItem[] = []
  if (Array.isArray(r.monsters)) {
    const seen = new Set<string>()
    for (const entry of r.monsters) {
      const m = parseMonster(entry)
      if (!m) continue
      if (seen.has(m.id)) continue
      seen.add(m.id)
      monsters.push(m)
    }
  }
  const tagsRaw = (
    typeof r.tags === 'object' && r.tags !== null ? r.tags : {}
  ) as Record<string, unknown>
  return {
    baseUrl:
      typeof r.base_url === 'string' && r.base_url
        ? r.base_url
        : CHARA_LIBRARY_BASE,
    characters,
    monsters,
    tags: {
      race: parseTagArray(tagsRaw.race),
      gender: parseTagArray(tagsRaw.gender),
      age: parseTagArray(tagsRaw.age),
      profession: parseTagArray(tagsRaw.profession),
      monster: parseTagArray(tagsRaw.monster),
    },
  }
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

/** Fetch and validate the chara-image-organizer manifest. Returns
 *  `null` on any failure — the picker UI surfaces a single
 *  "couldn't load" message rather than guessing at the cause. */
export async function loadCharaManifest(): Promise<LibraryManifest | null> {
  const raw = await fetchJson(CHARA_LIBRARY_BASE + MANIFEST_PATH)
  return parseCharaManifest(raw)
}

/**
 * Localise a tag key for display. The upstream ships `labelJa` next
 * to each `key`, so Japanese UI uses the label verbatim and every
 * other language falls back to the key itself (English-ish snake-
 * case). When the manifest is empty the key stays as the label so
 * a chip is never blank.
 */
export function charaTagLabel(
  category: LibraryCategory,
  key: string,
  lang: string,
  manifest: LibraryManifest | null,
): string {
  if (!manifest) return key
  const list =
    category === 'race'
      ? manifest.tags.race
      : category === 'gender'
        ? manifest.tags.gender
        : category === 'age'
          ? manifest.tags.age
          : category === 'profession'
            ? manifest.tags.profession
            : manifest.tags.monster
  const match = list.find((t) => t.key === key)
  if (!match) return key
  if (lang === 'ja' && match.labelJa) return match.labelJa
  return match.key
}

/**
 * Pick a "headline" label for a single item — what the card caption
 * shows. Characters concatenate race + profession (e.g. "人間 戦士");
 * monsters use their `monsterLabel` (e.g. "ゴブリン"). Falls through
 * to the id when nothing else is available so a card is never blank.
 */
export function itemDisplayLabel(
  item: LibraryItem,
  lang: string,
  manifest: LibraryManifest | null,
): string {
  if (item.type === 'character') {
    const race =
      lang === 'ja' && item.raceLabel
        ? item.raceLabel
        : charaTagLabel('race', item.race, lang, manifest)
    const prof =
      lang === 'ja' && item.professionLabel
        ? item.professionLabel
        : charaTagLabel('profession', item.profession, lang, manifest)
    const joined = [race, prof].filter(Boolean).join(' ')
    return joined || item.id
  }
  const monster =
    lang === 'ja' && item.monsterLabel
      ? item.monsterLabel
      : charaTagLabel('monster', item.monster, lang, manifest)
  return monster || item.id
}

/** Selection state mirrored from the picker UI. Each category set
 *  may be empty (no constraint). */
export type CharaSelection = Record<CharaCategory, ReadonlySet<string>>
export type MonsterSelection = Record<MonsterCategory, ReadonlySet<string>>

export function emptyCharaSelection(): CharaSelection {
  return {
    race: new Set(),
    gender: new Set(),
    age: new Set(),
    profession: new Set(),
  }
}

export function emptyMonsterSelection(): MonsterSelection {
  return { monster: new Set() }
}

/**
 * AND-across-categories character filter. Within a single category
 * `mode === 'or'` matches any selected tag and `mode === 'and'`
 * requires all of them. The character library is small enough
 * (<1000 entries) to scan linearly per keystroke.
 */
export function filterCharacters(
  items: ReadonlyArray<CharacterItem>,
  selected: CharaSelection,
  mode: 'and' | 'or',
): CharacterItem[] {
  return items.filter((item) =>
    CHARA_CATEGORIES.every((cat) =>
      matchesCategory(item[cat], selected[cat], mode),
    ),
  )
}

/** Monster equivalent of `filterCharacters` — there is only the
 *  one `monster` category so AND / OR collapse to the same result
 *  for any non-empty selection; we keep the parameter to mirror the
 *  character API so the picker UI can route both modes uniformly. */
export function filterMonsters(
  items: ReadonlyArray<MonsterItem>,
  selected: MonsterSelection,
  mode: 'and' | 'or',
): MonsterItem[] {
  return items.filter((item) =>
    matchesCategory(item.monster, selected.monster, mode),
  )
}

function matchesCategory(
  itemKey: string,
  want: ReadonlySet<string>,
  mode: 'and' | 'or',
): boolean {
  if (want.size === 0) return true
  if (mode === 'and') {
    // A single-key field can only satisfy AND when the set has
    // exactly one element matching it.
    if (want.size !== 1) return false
    return want.has(itemKey)
  }
  return want.has(itemKey)
}

/** Case-insensitive substring search over id / labels / tags. */
export function searchItems<T extends LibraryItem>(
  items: ReadonlyArray<T>,
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...items]
  return items.filter((item) => {
    if (item.id.toLowerCase().includes(q)) return true
    if (item.tags.some((tag) => tag.toLowerCase().includes(q))) return true
    if (item.type === 'character') {
      if (
        item.raceLabel?.toLowerCase().includes(q) ||
        item.genderLabel?.toLowerCase().includes(q) ||
        item.ageLabel?.toLowerCase().includes(q) ||
        item.professionLabel?.toLowerCase().includes(q)
      ) {
        return true
      }
    } else {
      if (item.monsterLabel?.toLowerCase().includes(q)) return true
    }
    return false
  })
}
