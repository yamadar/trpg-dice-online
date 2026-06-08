/* eslint-disable react-hooks/preserve-manual-memoization,
   react-hooks/refs, react-hooks/immutability */
/**
 * Unified image picker: tabs for "upload a file" vs the two
 * sibling [trpg-chara-image-organizer] libraries (characters /
 * monsters). The dialog hands the result back as a `File` no
 * matter which tab the user landed on, so the caller can keep
 * its existing per-file flow (crop / downscale / upsert) without
 * branching on the input source.
 *
 * NOTE: React Compiler can't preserve the manual `useCallback`s
 * around the cancel-on-close / cancel-on-unmount pattern (it
 * conservatively refuses to memoise closures that mutate a
 * `useRef`). The two relevant lint rules are disabled at the file
 * level so the code can keep the explicit cancellation tokens —
 * the perf impact is nil because the dialog isn't on the hot path.
 *
 * The `mode` prop trims the tab strip:
 *   - `'character'` — Upload + Character tabs.
 *   - `'monster'`   — Upload + Monster tabs.
 *   - `'both'`      — Upload + Character + Monster tabs.
 *
 * The library tabs are inert until the manifest finishes loading;
 * the dialog stays mounted by the caller so the manifest is
 * fetched once across reopens (mirrors `MapGalleryDialog`'s cache
 * pattern).
 *
 * [trpg-chara-image-organizer]:
 *   https://yamadar.github.io/trpg-chara-image-organizer/
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useDialogFocus } from '../hooks/useDialogFocus'
import {
  CHARA_CATEGORIES,
  type CharaCategory,
  type CharaPickMode,
  type CharaSelection,
  type CharacterItem,
  type LibraryItem,
  type LibraryManifest,
  type MonsterItem,
  type MonsterSelection,
  charaTagLabel,
  emptyCharaSelection,
  emptyMonsterSelection,
  filterCharacters,
  filterMonsters,
  itemDisplayLabel,
  itemUrl,
  loadCharaManifest,
  searchItems,
} from '../characters/charaLibrary'
import { CloseIcon, ImageUpIcon, TrashIcon } from './icons'

interface Props {
  open: boolean
  onClose: () => void
  /** Which libraries the user can browse from. The "Upload" tab is
   *  always available; this only affects the library tabs. */
  mode: CharaPickMode
  /** Receives the chosen image as a `File`. For "Upload" this is
   *  the user's pick; for library tabs the dialog fetches the
   *  thumbnail and synthesises a `File` so the caller's downstream
   *  pipeline (crop / `prepareNpcTokenImage` / upsert) is the same.
   *  `opts.fromLibrary` is `true` when the source was a library tab
   *  — callers that want to skip a crop step for already-cropped
   *  library art can branch on it. */
  onPick: (file: File, opts: { fromLibrary: boolean }) => Promise<void> | void
}

type Tab = 'upload' | 'character' | 'monster'

/** A chosen-but-not-yet-applied selection. Library picks and uploads
 *  both stage here so the footer "Use this image" button is the single
 *  apply path (matching the map gallery): a single click only selects,
 *  it never applies. */
type Pending =
  | { kind: 'library'; item: LibraryItem }
  | { kind: 'upload'; file: File; url: string }

/** Convert a remote image URL into a synthetic `File`. The Lightbox
 *  / `prepareNpcTokenImage` pipelines need a `File` to drive their
 *  data-URL conversion; fetching the bytes here also lets us bail
 *  out with a recognisable error for CORS / 404 / non-image responses
 *  rather than handing a poisoned URL to a downstream `<img>` and
 *  letting it silently fail. */
async function fetchUrlAsFile(url: string): Promise<File | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    // Pull the trailing path segment for a stable filename; the
    // dialog only needs SOMETHING readable, not the canonical name.
    const name = url.split('/').pop()?.split('?')[0] || 'library-image'
    return new File([blob], name, { type: blob.type })
  } catch {
    return null
  }
}

export function ImagePickerDialog({ open, onClose, mode, onPick }: Props) {
  const { t, lang } = useI18n()
  // Manifest cache: lazy-loaded on first open, kept across reopens
  // until the dialog unmounts. The fetch is upstream of the tab
  // selection so switching tabs is instant once we're populated.
  const [manifest, setManifest] = useState<LibraryManifest | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(() =>
    mode === 'monster' ? 'monster' : mode === 'character' ? 'character' : 'upload',
  )
  // When the caller opens us in a different `mode` than before
  // (e.g. NPC editor → monster, then chara editor → character),
  // reset the tab to the default for the new mode so the user
  // doesn't land on an irrelevant strip.
  const lastModeRef = useRef(mode)
  if (lastModeRef.current !== mode) {
    lastModeRef.current = mode
    setTab(
      mode === 'monster' ? 'monster' : mode === 'character' ? 'character' : 'upload',
    )
  }

  const [search, setSearch] = useState('')
  const [charaSelected, setCharaSelected] = useState<CharaSelection>(
    emptyCharaSelection,
  )
  const [monsterSelected, setMonsterSelected] = useState<MonsterSelection>(
    emptyMonsterSelection,
  )
  const [expandedCat, setExpandedCat] = useState<CharaCategory | null>(null)
  const [applying, setApplying] = useState(false)
  // The staged selection (library item or uploaded file). Applied only
  // when the user confirms via the footer "Use this image" button.
  const [pending, setPending] = useState<Pending | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const filtersWrapRef = useRef<HTMLDivElement | null>(null)
  /** Cancellation flag for an in-flight `onPick`. Toggled by
   *  `handleClose` so a slow library fetch doesn't apply an image
   *  the user already dismissed. */
  const inFlightPickRef = useRef(false)


  useEffect(() => {
    if (!open || manifest) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErrorKey(null)
      const m = await loadCharaManifest()
      if (cancelled) return
      if (!m) {
        setErrorKey('tabletop.imagePicker.loadFailed')
        setLoading(false)
        return
      }
      setManifest(m)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, manifest])

  // Move focus to the close button on open, trap Tab within the dialog,
  // and restore focus to the trigger on close. `active: open` engages
  // the trap only while the (kept-mounted) dialog is actually visible.
  useDialogFocus(cardRef, { active: open, initialFocusRef: closeBtnRef })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        handleClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Collapse the expanded category chip cluster on any outside tap.
  useEffect(() => {
    if (!open || expandedCat === null) return
    const onDown = (e: PointerEvent) => {
      const t = e.target
      if (t instanceof Node && filtersWrapRef.current?.contains(t)) return
      setExpandedCat(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, expandedCat])

  const handleClose = useCallback(() => {
    inFlightPickRef.current = false
    // Reset transient picks / filters so reopen starts from a clean
    // slate. Manifest cache is intentionally left alone.
    setApplying(false)
    setErrorKey(null)
    setSearch('')
    setCharaSelected(emptyCharaSelection())
    setMonsterSelected(emptyMonsterSelection())
    setExpandedCat(null)
    setPending((prev) => {
      if (prev?.kind === 'upload') URL.revokeObjectURL(prev.url)
      return null
    })
    onClose()
  }, [onClose])

  /** Switch source tab, dropping any staged selection — it belonged to
   *  the tab the user just left. */
  const chooseTab = useCallback((next: Tab) => {
    setTab(next)
    setPending((prev) => {
      if (prev?.kind === 'upload') URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  /** Apply a staged selection — a library item or an uploaded file —
   *  then close. The single apply path for every tab, driven by the
   *  footer "Use this image" button (and double-click on a library
   *  card). The selection is passed in (not read from `pending` via
   *  closure) so a double-click handler can stage-and-apply in one go
   *  without seeing a stale value. Wrapped in the same `inFlightPickRef`
   *  cancellation pattern as the map-gallery picker so closing
   *  mid-fetch doesn't trip a delayed upsert. */
  const applyPending = useCallback(
    async (sel: Pending | null) => {
      if (!sel) return
      inFlightPickRef.current = true
      setApplying(true)
      try {
        if (sel.kind === 'upload') {
          await onPick(sel.file, { fromLibrary: false })
        } else {
          if (!manifest) return
          const file = await fetchUrlAsFile(itemUrl(sel.item, manifest))
          if (!inFlightPickRef.current) return
          if (!file) {
            setErrorKey('tabletop.imagePicker.fetchFailed')
            return
          }
          await onPick(file, { fromLibrary: true })
        }
        if (!inFlightPickRef.current) return
        handleClose()
      } finally {
        setApplying(false)
        inFlightPickRef.current = false
      }
    },
    [manifest, onPick, handleClose],
  )

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      // Stage the file (with a preview URL) instead of applying — the
      // footer "Use this image" confirms it. Revoke a prior staged
      // upload first so we don't leak object URLs.
      setPending((prev) => {
        if (prev?.kind === 'upload') URL.revokeObjectURL(prev.url)
        return { kind: 'upload', file, url: URL.createObjectURL(file) }
      })
    },
    [],
  )

  const filteredCharacters = useMemo(() => {
    if (!manifest) return [] as CharacterItem[]
    return filterCharacters(
      searchItems(manifest.characters, search),
      charaSelected,
      'or',
    )
  }, [manifest, search, charaSelected])

  const filteredMonsters = useMemo(() => {
    if (!manifest) return [] as MonsterItem[]
    return filterMonsters(
      searchItems(manifest.monsters, search),
      monsterSelected,
      'or',
    )
  }, [manifest, search, monsterSelected])

  const toggleCharaTag = (cat: CharaCategory, key: string) => {
    setCharaSelected((prev) => {
      const next = { ...prev }
      const ns = new Set(prev[cat])
      if (ns.has(key)) ns.delete(key)
      else ns.add(key)
      next[cat] = ns
      return next
    })
  }

  const toggleMonsterTag = (key: string) => {
    setMonsterSelected((prev) => {
      const ns = new Set(prev.monster)
      if (ns.has(key)) ns.delete(key)
      else ns.add(key)
      return { monster: ns }
    })
  }

  const clearFilters = () => {
    setCharaSelected(emptyCharaSelection())
    setMonsterSelected(emptyMonsterSelection())
    setSearch('')
    setExpandedCat(null)
  }

  const filtersActive =
    Object.values(charaSelected).some((s) => s.size > 0) ||
    monsterSelected.monster.size > 0 ||
    search.trim().length > 0

  if (!open) return null

  const showCharaTab = mode === 'character' || mode === 'both'
  const showMonsterTab = mode === 'monster' || mode === 'both'
  const activeList: LibraryItem[] =
    tab === 'character'
      ? filteredCharacters
      : tab === 'monster'
        ? filteredMonsters
        : []
  const shown = activeList.length
  const total =
    tab === 'character'
      ? manifest?.characters.length ?? 0
      : tab === 'monster'
        ? manifest?.monsters.length ?? 0
        : 0

  return (
    <div className="map-gallery-layer" role="presentation">
      <div
        className="map-gallery-backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="map-gallery-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-picker-title"
        ref={cardRef}
      >
        <header className="map-gallery-header">
          <h2 id="image-picker-title" className="map-gallery-title">
            {t('tabletop.imagePicker.title')}
            {tab !== 'upload' && manifest && (
              <span className="map-gallery-count" aria-live="polite">
                {loading
                  ? t('tabletop.imagePicker.loading')
                  : errorKey
                    ? t(errorKey)
                    : t('tabletop.gallery.count', { shown, total })}
              </span>
            )}
            {tab === 'upload' && (errorKey || loading) && (
              <span className="map-gallery-count" aria-live="polite">
                {loading ? t('tabletop.imagePicker.loading') : t(errorKey!)}
              </span>
            )}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="icon-btn"
            aria-label={t('tabletop.imagePicker.close')}
            onClick={handleClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div
          className="tabletop-map-source-tabs"
          role="tablist"
          aria-label={t('tabletop.imagePicker.source')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upload'}
            aria-label={t('tabletop.imagePicker.upload')}
            title={t('tabletop.imagePicker.upload')}
            className={`tabletop-map-source-tab${tab === 'upload' ? ' active' : ''}`}
            onClick={() => chooseTab('upload')}
          >
            <ImageUpIcon size={18} />
          </button>
          {showCharaTab && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'character'}
              aria-label={t('tabletop.imagePicker.character')}
              title={t('tabletop.imagePicker.character')}
              className={`tabletop-map-source-tab${tab === 'character' ? ' active' : ''}`}
              onClick={() => chooseTab('character')}
            >
              {/* Reuse "image-search" glyph for parity with the
                  gallery-picker tab — it's still "browse a set of
                  pictures by tag". */}
              <CharacterTabIcon />
            </button>
          )}
          {showMonsterTab && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'monster'}
              aria-label={t('tabletop.imagePicker.monster')}
              title={t('tabletop.imagePicker.monster')}
              className={`tabletop-map-source-tab${tab === 'monster' ? ' active' : ''}`}
              onClick={() => chooseTab('monster')}
            >
              <MonsterTabIcon />
            </button>
          )}
        </div>
        <div className="tabletop-map-source-header">
          <h4 className="tabletop-map-source-name">
            {tab === 'upload'
              ? t('tabletop.imagePicker.upload')
              : tab === 'character'
                ? t('tabletop.imagePicker.character')
                : t('tabletop.imagePicker.monster')}
          </h4>
          <p className="tabletop-map-source-desc">
            {tab === 'upload'
              ? t('tabletop.imagePicker.uploadDesc')
              : tab === 'character'
                ? t('tabletop.imagePicker.characterDesc')
                : t('tabletop.imagePicker.monsterDesc')}
          </p>
        </div>

        {tab === 'upload' && (
          <div className="map-gallery-grid" style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                gap: 12,
                padding: 32,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFile}
              />
              {pending?.kind === 'upload' && (
                <img
                  src={pending.url}
                  alt=""
                  style={{
                    maxWidth: 200,
                    maxHeight: 200,
                    borderRadius: 8,
                    objectFit: 'contain',
                  }}
                />
              )}
              <button
                type="button"
                className="tabletop-toolbar-button"
                disabled={applying}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('tabletop.imagePicker.choose')}
              </button>
            </div>
          </div>
        )}

        {tab !== 'upload' && (
          <>
            <div className="map-gallery-toolbar">
              <input
                type="search"
                className="map-gallery-search"
                placeholder={t('tabletop.imagePicker.searchPlaceholder')}
                aria-label={t('tabletop.imagePicker.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {tab === 'character' && manifest && (
              <div ref={filtersWrapRef}>
                <div className="map-gallery-cat-row">
                  {CHARA_CATEGORIES.map((cat) => {
                    const tags = manifest.tags[cat]
                    if (tags.length === 0) return null
                    const isExpanded = expandedCat === cat
                    const count = charaSelected[cat].size
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`map-gallery-cat-toggle${isExpanded ? ' active' : ''}`}
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedCat((cur) => (cur === cat ? null : cat))
                        }
                      >
                        <span>{t(`tabletop.imagePicker.cat.${cat}`)}</span>
                        {count > 0 && (
                          <span className="map-gallery-cat-count">{count}</span>
                        )}
                      </button>
                    )
                  })}
                  {filtersActive && (
                    <button
                      type="button"
                      className="map-gallery-clear"
                      onClick={clearFilters}
                      aria-label={t('tabletop.gallery.clearFilters')}
                      title={t('tabletop.gallery.clearFilters')}
                    >
                      <TrashIcon />
                      <span>{t('tabletop.gallery.clear')}</span>
                    </button>
                  )}
                </div>
                {expandedCat && manifest.tags[expandedCat].length > 0 && (
                  <div className="map-gallery-chips">
                    {manifest.tags[expandedCat].map((tag) => {
                      const active = charaSelected[expandedCat].has(tag.key)
                      return (
                        <button
                          key={tag.key}
                          type="button"
                          className={`map-gallery-chip${active ? ' active' : ''}`}
                          aria-pressed={active}
                          onClick={() => toggleCharaTag(expandedCat, tag.key)}
                        >
                          {charaTagLabel(expandedCat, tag.key, lang, manifest)}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className="map-gallery-chips-close"
                      aria-label={t('tabletop.gallery.closeFilter')}
                      title={t('tabletop.gallery.closeFilter')}
                      onClick={() => setExpandedCat(null)}
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
            {tab === 'monster' && manifest && manifest.tags.monster.length > 0 && (
              <div ref={filtersWrapRef}>
                <div className="map-gallery-cat-row">
                  {manifest.tags.monster.map((tag) => {
                    const active = monsterSelected.monster.has(tag.key)
                    return (
                      <button
                        key={tag.key}
                        type="button"
                        className={`map-gallery-chip${active ? ' active' : ''}`}
                        aria-pressed={active}
                        onClick={() => toggleMonsterTag(tag.key)}
                      >
                        {charaTagLabel('monster', tag.key, lang, manifest)}
                      </button>
                    )
                  })}
                  {filtersActive && (
                    <button
                      type="button"
                      className="map-gallery-clear"
                      onClick={clearFilters}
                      aria-label={t('tabletop.gallery.clearFilters')}
                      title={t('tabletop.gallery.clearFilters')}
                    >
                      <TrashIcon />
                      <span>{t('tabletop.gallery.clear')}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="map-gallery-grid">
              {activeList.map((item) => {
                const isPicked =
                  pending?.kind === 'library' && pending.item.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`map-gallery-item${isPicked ? ' picked' : ''}`}
                    aria-label={itemDisplayLabel(item, lang, manifest)}
                    aria-pressed={isPicked}
                    disabled={applying}
                    // Single click only selects; the footer "Use this
                    // image" applies. Double-click is the power-user
                    // shortcut (select + apply in one).
                    onClick={() => setPending({ kind: 'library', item })}
                    onDoubleClick={() => {
                      const sel: Pending = { kind: 'library', item }
                      setPending(sel)
                      void applyPending(sel)
                    }}
                    title={itemDisplayLabel(item, lang, manifest)}
                  >
                    {manifest && (
                      <img
                        src={itemUrl(item, manifest)}
                        alt=""
                        loading="lazy"
                        className="map-gallery-thumb"
                      />
                    )}
                    <span className="map-gallery-item-name">
                      {itemDisplayLabel(item, lang, manifest)}
                    </span>
                  </button>
                )
              })}
              {!loading && !errorKey && manifest && activeList.length === 0 && (
                <p className="map-gallery-empty">{t('tabletop.gallery.empty')}</p>
              )}
            </div>
          </>
        )}
        <footer className="map-gallery-footer">
          <div className="map-gallery-actions">
            <button type="button" onClick={handleClose}>
              {t('tabletop.gallery.cancel')}
            </button>
            <button
              type="button"
              className="primary"
              disabled={!pending || applying}
              onClick={() => void applyPending(pending)}
            >
              {applying
                ? t('tabletop.imagePicker.applying')
                : t('tabletop.imagePicker.use')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

/** Lucide-style "user" glyph for the character tab. */
function CharacterTabIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/** Lucide-style stylised "ghost/monster" glyph for the monster tab. */
function MonsterTabIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </svg>
  )
}
