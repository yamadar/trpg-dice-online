/**
 * In-app picker for the sibling [trpg-map-organizer] gallery.
 *
 * Renders a modal with:
 *   - A text search (file name + description, case-insensitive).
 *   - Four tag categories (theme / terrain / mood / location) as
 *     toggle chips, with an AND / OR mode switch matching the source
 *     site's behaviour.
 *   - A grid of thumbnail cards. Tapping a card selects it; the
 *     footer "Use this map" button drives the actual download via
 *     the parent's `onPick(midUrl)` callback, which goes through
 *     `setMapBackgroundFromUrl` and therefore the same downscale +
 *     chunked-broadcast pipeline as a hand-picked file.
 *
 * Tag labels follow the UI language: `ja` shows the source Japanese
 * strings verbatim, every other language pulls the English label
 * from the gallery's own `i18n.json` and falls back to the source
 * string when a tag is missing — never an empty chip.
 *
 * [trpg-map-organizer]: https://yamadar.github.io/trpg-map-organizer/
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { MapImageError } from '../tabletop/imageBackground'
import {
  type GalleryCategory,
  type GalleryManifest,
  type GalleryMap,
  type GalleryTagDict,
  filterMaps,
  loadGalleryManifest,
  loadGalleryTagDict,
  midUrl,
  searchMaps,
  tagLabel,
  thumbUrl,
} from '../tabletop/mapGallery'
import { CloseIcon } from './icons'

const CATEGORIES: GalleryCategory[] = ['theme', 'terrain', 'mood', 'location']

interface Props {
  open: boolean
  onClose: () => void
  /** Apply the picked map. Receives the `mid.jpg` URL; resolves to
   *  the same `'ok' | MapImageError` union as `setMapBackgroundFromUrl`
   *  so this dialog can surface the URL-specific failure tags inline
   *  rather than guessing the cause. */
  onPick: (url: string) => Promise<'ok' | MapImageError>
  /** Surface a flash message (success / error). Optional — when not
   *  provided, the dialog only closes / stays open. */
  onNotice?: (text: string, kind: 'success' | 'error') => void
}

type Selection = Record<GalleryCategory, Set<string>>

function emptySelection(): Selection {
  return {
    theme: new Set(),
    terrain: new Set(),
    mood: new Set(),
    location: new Set(),
  }
}

export function MapGalleryDialog({ open, onClose, onPick, onNotice }: Props) {
  const { t, lang } = useI18n()
  // Cached manifest / dict survive across opens — the source site
  // regenerates infrequently, and 303 maps × tag-arrays is a few
  // hundred KB. The first open after mount pays the network round-trip;
  // subsequent opens are instant.
  const [manifest, setManifest] = useState<GalleryManifest | null>(null)
  const [tagDict, setTagDict] = useState<GalleryTagDict | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Selection>(emptySelection)
  const [mode, setMode] = useState<'and' | 'or'>('or')
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)
  // Tracks which tag categories the user has expanded. All start
  // collapsed so 300+ tag chips don't dominate the viewport on first
  // open — the user expands the one they care about.
  const [expandedCats, setExpandedCats] = useState<Set<GalleryCategory>>(
    () => new Set(),
  )
  const cardRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  // Lazy first load. `manifest` itself acts as the cache flag —
  // once populated, subsequent `open` flips skip the network round-
  // trip entirely. The `setLoading(true)` happens inside the async
  // IIFE so the effect body itself doesn't synchronously call
  // setState (which `react-hooks/set-state-in-effect` would flag).
  useEffect(() => {
    if (!open || manifest) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const [man, dict] = await Promise.all([
        loadGalleryManifest(),
        loadGalleryTagDict(),
      ])
      if (cancelled) return
      if (!man) {
        setError(t('tabletop.gallery.loadFailed'))
        setLoading(false)
        return
      }
      setManifest(man)
      setTagDict(dict)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, manifest, t])

  // Escape closes the dialog. Registered in the capture phase so a
  // parent Sheet listening to Escape on the window doesn't also
  // close behind us.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  // Focus the close button when the dialog opens — gives keyboard
  // users a predictable starting point and prevents focus from being
  // stuck behind the backdrop.
  useEffect(() => {
    if (open) closeBtnRef.current?.focus({ preventScroll: true })
  }, [open])

  const filteredMaps = useMemo(() => {
    if (!manifest) return [] as GalleryMap[]
    return filterMaps(searchMaps(manifest.maps, search), selected, mode)
  }, [manifest, search, selected, mode])

  const toggleTag = useCallback((cat: GalleryCategory, tag: string) => {
    setSelected((prev) => {
      const next = { ...prev }
      const nextSet = new Set(prev[cat])
      if (nextSet.has(tag)) nextSet.delete(tag)
      else nextSet.add(tag)
      next[cat] = nextSet
      return next
    })
  }, [])

  const clearTags = useCallback(() => {
    setSelected(emptySelection())
  }, [])

  const toggleCategory = useCallback((cat: GalleryCategory) => {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const handlePick = useCallback(async () => {
    if (pickedId === null || !manifest) return
    const map = manifest.maps.find((m) => m.id === pickedId)
    if (!map) return
    setApplying(true)
    try {
      // `mid` is the right resolution for the toolbar: ≈1280 px JPEG,
      // ≤ 2 MB in practice — comfortably under the 8 MB ingest cap
      // and a fraction of the original's bytes.
      const result = await onPick(midUrl(map))
      if (result === 'ok') {
        onNotice?.(t('tabletop.map.set'), 'success')
        onClose()
      } else if (result === 'tooLarge') {
        onNotice?.(t('tabletop.map.tooLarge'), 'error')
      } else if (result === 'fetchFailed') {
        onNotice?.(t('tabletop.mapUrl.fetchFailed'), 'error')
      } else if (result === 'notImage') {
        onNotice?.(t('tabletop.mapUrl.notImage'), 'error')
      } else if (result === 'invalidUrl') {
        // Internal error — the dialog only ever passes the canonical
        // gallery URL, so reaching this branch points at a bug
        // upstream. Surface as a generic failure rather than the
        // user-facing "Invalid URL" copy.
        onNotice?.(t('tabletop.gallery.applyFailed'), 'error')
      } else {
        onNotice?.(t('tabletop.map.unreadable'), 'error')
      }
    } finally {
      setApplying(false)
    }
  }, [pickedId, manifest, onPick, onNotice, onClose, t])

  if (!open) return null

  const pickedMap =
    pickedId === null
      ? null
      : manifest?.maps.find((m) => m.id === pickedId) || null

  return (
    <div className="map-gallery-layer" role="presentation">
      <div
        className="map-gallery-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={cardRef}
        className="map-gallery-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-gallery-title"
      >
        <header className="map-gallery-header">
          <h2 id="map-gallery-title" className="map-gallery-title">
            {t('tabletop.gallery.title')}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="icon-btn"
            aria-label={t('tabletop.gallery.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="map-gallery-toolbar">
          <input
            type="search"
            className="map-gallery-search"
            placeholder={t('tabletop.gallery.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="map-gallery-mode" role="radiogroup" aria-label={t('tabletop.gallery.mode')}>
            <button
              type="button"
              className={`map-gallery-mode-btn${mode === 'or' ? ' active' : ''}`}
              role="radio"
              aria-checked={mode === 'or'}
              onClick={() => setMode('or')}
            >
              {t('tabletop.gallery.modeOr')}
            </button>
            <button
              type="button"
              className={`map-gallery-mode-btn${mode === 'and' ? ' active' : ''}`}
              role="radio"
              aria-checked={mode === 'and'}
              onClick={() => setMode('and')}
            >
              {t('tabletop.gallery.modeAnd')}
            </button>
          </div>
        </div>

        {manifest && (
          <div className="map-gallery-filters">
            {CATEGORIES.map((cat) => {
              const tags = manifest.tags[cat]
              if (tags.length === 0) return null
              const isExpanded = expandedCats.has(cat)
              const selectedCount = selected[cat].size
              return (
                <div key={cat} className="map-gallery-cat">
                  <button
                    type="button"
                    className="map-gallery-cat-toggle"
                    aria-expanded={isExpanded}
                    onClick={() => toggleCategory(cat)}
                  >
                    <span>{t(`tabletop.gallery.cat.${cat}`)}</span>
                    {selectedCount > 0 && (
                      <span className="map-gallery-cat-count">
                        {selectedCount}
                      </span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="map-gallery-chips">
                      {tags.map((tag) => {
                        const on = selected[cat].has(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`map-gallery-chip${on ? ' active' : ''}`}
                            aria-pressed={on}
                            onClick={() => toggleTag(cat, tag)}
                          >
                            {tagLabel(tag, lang, tagDict)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {(Object.values(selected).some((s) => s.size > 0) || search) && (
              <button
                type="button"
                className="map-gallery-clear"
                onClick={() => {
                  clearTags()
                  setSearch('')
                }}
              >
                {t('tabletop.gallery.clearFilters')}
              </button>
            )}
          </div>
        )}

        <div className="map-gallery-status" aria-live="polite">
          {loading && t('tabletop.gallery.loading')}
          {error && !loading && <span className="error">{error}</span>}
          {!loading && !error && manifest && (
            <span>
              {t('tabletop.gallery.count', {
                shown: filteredMaps.length,
                total: manifest.maps.length,
              })}
            </span>
          )}
        </div>

        <div className="map-gallery-grid">
          {filteredMaps.map((map) => {
            const isPicked = map.id === pickedId
            return (
              <button
                key={map.id}
                type="button"
                className={`map-gallery-item${isPicked ? ' picked' : ''}`}
                aria-pressed={isPicked}
                onClick={() => setPickedId(map.id)}
                onDoubleClick={() => {
                  setPickedId(map.id)
                  void handlePick()
                }}
                title={map.desc || map.file}
              >
                <img
                  src={thumbUrl(map)}
                  alt=""
                  loading="lazy"
                  className="map-gallery-thumb"
                />
                <span className="map-gallery-item-name">{map.file}</span>
              </button>
            )
          })}
          {!loading && !error && manifest && filteredMaps.length === 0 && (
            <p className="map-gallery-empty">{t('tabletop.gallery.empty')}</p>
          )}
        </div>

        <footer className="map-gallery-footer">
          {pickedMap && (
            <p className="map-gallery-picked-desc" title={pickedMap.desc}>
              {pickedMap.desc || pickedMap.file}
            </p>
          )}
          <div className="map-gallery-actions">
            <button type="button" onClick={onClose}>
              {t('tabletop.gallery.cancel')}
            </button>
            <button
              type="button"
              className="primary"
              disabled={pickedId === null || applying}
              onClick={() => void handlePick()}
            >
              {applying
                ? t('tabletop.gallery.applying')
                : t('tabletop.gallery.use')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
