/**
 * In-app picker for the sibling [trpg-map-organizer] gallery.
 *
 * Renders a modal with:
 *   - A text search (file name + description, case-insensitive).
 *   - Four tag categories (theme / terrain / mood / location) in a
 *     fixed row of toggles. Tapping a category expands its tag
 *     chips beneath the row; only one category is expanded at a
 *     time (tapping the same toggle closes it). AND / OR mode
 *     switch (with arrow-key navigation matching the WAI-ARIA
 *     radiogroup pattern) lives in the toolbar above.
 *   - A grid of thumbnail cards. Tapping a card selects it; the
 *     footer "Use this map" button drives the actual download via
 *     the parent's `onPick(originalUrl)` callback, which goes through
 *     `setMapBackgroundFromUrl` and therefore the same downscale +
 *     chunked-broadcast pipeline as a hand-picked file. A hover
 *     magnifier on each card opens the same WebP in the Lightbox
 *     without affecting the picked state.
 *
 * Tag labels follow the UI language: `ja` shows the source Japanese
 * strings verbatim, every other language pulls the English label
 * from the gallery's own `i18n.json` and falls back to the source
 * string when a tag is missing — never an empty chip.
 *
 * State lifecycle: the dialog is kept mounted by the toolbar so
 * `manifest` and `tagDict` survive close → reopen as a memory cache,
 * but the user-driven picks / filters reset on close so a fresh
 * open always starts clean. A still-in-flight `onPick` from a prior
 * "Use this map" tap is cancelled (its eventual resolve is ignored)
 * when the user closes the dialog mid-apply.
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
  originalUrl,
  searchMaps,
  tagLabel,
  thumbUrl,
} from '../tabletop/mapGallery'
import { CloseIcon, TrashIcon } from './icons'
import { Lightbox } from './Lightbox'

const CATEGORIES: GalleryCategory[] = ['theme', 'terrain', 'mood', 'location']
const MODES: ('or' | 'and')[] = ['or', 'and']

interface Props {
  open: boolean
  onClose: () => void
  /** Apply the picked map. Receives the original-resolution WebP URL;
   *  resolves to the same `'ok' | MapImageError` union as
   *  `setMapBackgroundFromUrl` so this dialog can surface the URL-
   *  specific failure tags inline rather than guessing the cause. */
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

/** 14 px magnifier icon used on the hover-preview affordance. Inline
 *  rather than added to `icons.tsx` since it's only used here and
 *  the lucide-style geometry is tiny. */
function MagnifierIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

export function MapGalleryDialog({ open, onClose, onPick, onNotice }: Props) {
  const { t, lang } = useI18n()
  // Cached manifest / dict survive across opens — the source site
  // regenerates infrequently, and 303 maps × tag-arrays is a few
  // hundred KB. The first open after mount pays the network round-trip;
  // subsequent opens are instant. `tagDict === null` means "haven't
  // got it yet" (initial state OR a previous fetch failure) — the
  // next open re-tries; `tagDict === {}` means "fetched, server
  // returned no tags" (don't retry).
  const [manifest, setManifest] = useState<GalleryManifest | null>(null)
  const [tagDict, setTagDict] = useState<GalleryTagDict | null>(null)
  const [loading, setLoading] = useState(false)
  // Error is stored as a translation key (not a translated string) so
  // we can re-render with the latest UI language without depending on
  // `t` from inside the load effect (which would re-fire the fetch on
  // every language switch).
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Selection>(emptySelection)
  const [mode, setMode] = useState<'and' | 'or'>('or')
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)
  // Exclusive expansion: only one category's chips are visible at a
  // time. Tapping the active category closes it. The category row
  // itself stays in place — only the chip cluster beneath it appears
  // or disappears.
  const [expandedCat, setExpandedCat] = useState<GalleryCategory | null>(null)
  // Lightbox preview state: which map is being previewed (full-res
  // image) on top of the dialog. `null` means no preview. Tapping
  // the magnifier on a card or hitting Enter on a focused card opens
  // it; this is independent of `pickedId` so previewing does not
  // disturb the user's selection.
  const [previewMapId, setPreviewMapId] = useState<number | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  /** Wraps the category row + the expandable chip cluster. Used by
   *  the outside-pointerdown handler so a tap anywhere else in the
   *  grid / footer collapses the chips without needing an extra
   *  close affordance. */
  const filtersWrapRef = useRef<HTMLDivElement | null>(null)
  // Cancellation token for an in-flight `onPick`. Closing the
  // dialog mid-apply flips this to `false` so the eventual resolve
  // is ignored — without it, a "Use this map" tap followed by a
  // backdrop click would still apply the map after the user thought
  // they cancelled.
  const inFlightPickRef = useRef(false)

  // Lazy first load + tag-dict retry. `manifest` survives across
  // opens as a memory cache; `tagDict === null` means the previous
  // attempt failed (or hadn't started), so we retry on each open.
  // A successful fetch returns `{}` (truthy), which is treated as
  // "fetched, nothing to translate" and not retried.
  //
  // The `setLoading(true)` happens inside the async IIFE so the
  // effect body itself doesn't synchronously call setState (which
  // `react-hooks/set-state-in-effect` would flag), and the
  // `finally` clears it even when the cancellation early-returns —
  // otherwise a close-then-reopen could leave loading stuck on.
  useEffect(() => {
    if (!open) return
    if (manifest && tagDict !== null) return
    let cancelled = false
    void (async () => {
      try {
        if (!manifest) setLoading(true)
        setErrorKey(null)
        const [man, dict] = await Promise.all([
          manifest ? Promise.resolve(manifest) : loadGalleryManifest(),
          tagDict !== null
            ? Promise.resolve(tagDict)
            : loadGalleryTagDict(),
        ])
        if (cancelled) return
        if (!man) {
          setErrorKey('tabletop.gallery.loadFailed')
          return
        }
        if (man !== manifest) setManifest(man)
        if (dict !== null && dict !== tagDict) setTagDict(dict)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, manifest, tagDict])

  // Escape: when the gallery is open, swallow the key in the capture
  // phase so the underlying TablePanel's window-level Escape handler
  // doesn't also fire and close the whole tabletop sheet behind us.
  // If a Lightbox preview is up, close that first; otherwise close
  // the dialog itself.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (previewMapId !== null) {
        setPreviewMapId(null)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose, previewMapId])

  // Focus the close button when the dialog opens — gives keyboard
  // users a predictable starting point and prevents focus from being
  // stuck behind the backdrop.
  useEffect(() => {
    if (open) closeBtnRef.current?.focus({ preventScroll: true })
  }, [open])

  // Tap outside the filter row / chip cluster while a category is
  // expanded → collapse it. Without this, a chip strip can swallow
  // a meaningful fraction of the dialog on phones, and the user
  // has no obvious way back besides retapping the same category.
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

  const filteredMaps = useMemo(() => {
    if (!manifest) return [] as GalleryMap[]
    return filterMaps(searchMaps(manifest.maps, search), selected, mode)
  }, [manifest, search, selected, mode])

  // A picked map that the current filters/search hide from the grid
  // would otherwise still be apply-able from the (visible) footer
  // button — surprising and easy to misclick. The "Use this map"
  // button stays disabled until the pick is visible in the grid.
  const pickedIsVisible = useMemo(() => {
    if (pickedId === null) return false
    return filteredMaps.some((m) => m.id === pickedId)
  }, [pickedId, filteredMaps])

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

  const clearFilters = useCallback(() => {
    // Collapse the chip strip too: leaving it expanded after
    // clearing reads as "still filtering" but with zero chips
    // active, which is more confusing than helpful.
    setSelected(emptySelection())
    setSearch('')
    setExpandedCat(null)
  }, [])

  /** Tap a category row → expand its chips, or collapse if it was
   *  already the active one. Exclusive: tapping a different category
   *  replaces the open chip set rather than stacking them. */
  const toggleCategory = useCallback((cat: GalleryCategory) => {
    setExpandedCat((prev) => (prev === cat ? null : cat))
  }, [])

  /**
   * Close the dialog AND cancel any in-flight `onPick` so the
   * eventual resolve does not fire side effects. Also reset all
   * user-driven state (selection, filters, preview) so a reopen
   * starts from a clean grid — `manifest` / `tagDict` / `mode` are
   * preserved as a memory cache + a user setting.
   *
   * Every close path (backdrop, X, Cancel, Escape, successful
   * apply) routes through this so the reset is in one place.
   */
  const handleClose = useCallback(() => {
    inFlightPickRef.current = false
    setApplying(false)
    setPreviewMapId(null)
    setPickedId(null)
    setSearch('')
    setExpandedCat(null)
    setSelected(emptySelection())
    setErrorKey(null)
    onClose()
  }, [onClose])

  /**
   * Apply a specific map by id. The id is passed in (rather than
   * read from `pickedId` via closure) so a double-click handler can
   * `setPickedId(map.id); void handlePick(map.id)` without the
   * second call seeing a stale closure value.
   */
  const handlePick = useCallback(
    async (id: number) => {
      if (!manifest) return
      const map = manifest.maps.find((m) => m.id === id)
      if (!map) return
      inFlightPickRef.current = true
      setApplying(true)
      try {
        // The original is shipped as WebP now, which is roughly the
        // same byte count as the old `mid` JPEG would have been. The
        // mid file is being retired upstream, so use the original
        // directly — it stays under the 8 MB ingest cap thanks to
        // WebP's compression and gives us a sharper preview.
        const result = await onPick(originalUrl(map))
        // User closed the dialog mid-apply; skip the side effects
        // so we don't surprise them with a delayed "applied"
        // notice or re-fire onClose on an already-closed dialog.
        if (!inFlightPickRef.current) return
        if (result === 'ok') {
          onNotice?.(t('tabletop.map.set'), 'success')
          handleClose()
        } else if (result === 'tooLarge') {
          onNotice?.(t('tabletop.map.tooLarge'), 'error')
        } else if (result === 'fetchFailed') {
          onNotice?.(t('tabletop.mapUrl.fetchFailed'), 'error')
        } else if (result === 'notImage') {
          onNotice?.(t('tabletop.mapUrl.notImage'), 'error')
        } else if (result === 'invalidUrl') {
          // Internal error — the dialog only ever passes the
          // canonical gallery URL, so reaching this branch points
          // at a bug upstream. Surface as a generic failure rather
          // than the user-facing "Invalid URL" copy.
          onNotice?.(t('tabletop.gallery.applyFailed'), 'error')
        } else {
          onNotice?.(t('tabletop.map.unreadable'), 'error')
        }
      } catch {
        // An uncaught throw from `onPick` would otherwise bubble out
        // through `void handlePick(...)` to an unhandled rejection
        // with no UI feedback. Surface a generic "could not apply"
        // toast so the GM knows the click registered but failed.
        if (inFlightPickRef.current) {
          onNotice?.(t('tabletop.gallery.applyFailed'), 'error')
        }
      } finally {
        if (inFlightPickRef.current) {
          setApplying(false)
          inFlightPickRef.current = false
        }
      }
    },
    [manifest, onPick, onNotice, handleClose, t],
  )

  if (!open) return null

  const pickedMap =
    pickedId === null
      ? null
      : manifest?.maps.find((m) => m.id === pickedId) || null

  const previewMap =
    previewMapId === null
      ? null
      : manifest?.maps.find((m) => m.id === previewMapId) || null

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
        aria-labelledby="map-gallery-title"
      >
        <header className="map-gallery-header">
          <h2 id="map-gallery-title" className="map-gallery-title">
            {t('tabletop.gallery.title')}
            {/* Status pill: shows loading / error / count side-by-side
                with the title rather than carving out a dedicated
                status row. Exactly one state renders at a time so the
                layout stays stable as the manifest resolves. */}
            <span className="map-gallery-count" aria-live="polite">
              {loading
                ? t('tabletop.gallery.loading')
                : errorKey
                  ? t(errorKey)
                  : manifest
                    ? t('tabletop.gallery.count', {
                        shown: filteredMaps.length,
                        total: manifest.maps.length,
                      })
                    : ''}
            </span>
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="icon-btn"
            aria-label={t('tabletop.gallery.close')}
            onClick={handleClose}
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
          <div
            className="map-gallery-mode"
            role="radiogroup"
            aria-label={t('tabletop.gallery.mode')}
          >
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                className={`map-gallery-mode-btn${mode === m ? ' active' : ''}`}
                role="radio"
                aria-checked={mode === m}
                // WAI-ARIA radiogroup: only the active radio is in
                // the tab sequence; arrow keys move the selection
                // among siblings.
                tabIndex={mode === m ? 0 : -1}
                onClick={() => setMode(m)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault()
                    setMode(MODES[(MODES.indexOf(m) + 1) % MODES.length]!)
                  } else if (
                    e.key === 'ArrowLeft' ||
                    e.key === 'ArrowUp'
                  ) {
                    e.preventDefault()
                    setMode(
                      MODES[
                        (MODES.indexOf(m) - 1 + MODES.length) % MODES.length
                      ]!,
                    )
                  }
                }}
              >
                {t(
                  m === 'or'
                    ? 'tabletop.gallery.modeOr'
                    : 'tabletop.gallery.modeAnd',
                )}
              </button>
            ))}
          </div>
        </div>

        {manifest && (
          <div ref={filtersWrapRef}>
            <div className="map-gallery-cat-row">
              {CATEGORIES.map((cat) => {
                const tags = manifest.tags[cat]
                if (tags.length === 0) return null
                const isExpanded = expandedCat === cat
                const selectedCount = selected[cat].size
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`map-gallery-cat-toggle${isExpanded ? ' active' : ''}`}
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
                )
              })}
              {(Object.values(selected).some((s) => s.size > 0) || search) && (
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
                  const on = selected[expandedCat].has(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`map-gallery-chip${on ? ' active' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggleTag(expandedCat, tag)}
                    >
                      {tagLabel(tag, lang, tagDict)}
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

        <div className="map-gallery-grid">
          {filteredMaps.map((map) => {
            const isPicked = map.id === pickedId
            const handleSelect = () => setPickedId(map.id)
            return (
              <div
                key={map.id}
                role="button"
                tabIndex={0}
                aria-pressed={isPicked}
                aria-label={map.file}
                // The scroll-into-view helper (used by the Lightbox
                // prev/next handler) finds the card by id via this
                // attribute — querying by data attribute is cheap
                // and avoids 303-ref bookkeeping.
                data-map-id={map.id}
                className={`map-gallery-item${isPicked ? ' picked' : ''}`}
                onClick={handleSelect}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelect()
                  }
                }}
                onDoubleClick={() => {
                  setPickedId(map.id)
                  void handlePick(map.id)
                }}
                title={map.desc || map.file}
              >
                <img
                  src={thumbUrl(map)}
                  alt=""
                  loading="lazy"
                  className="map-gallery-thumb"
                />
                <button
                  type="button"
                  className="map-gallery-preview-btn"
                  aria-label={t('tabletop.gallery.preview')}
                  title={t('tabletop.gallery.preview')}
                  onClick={(e) => {
                    // Don't let the click bubble to the parent
                    // card's onClick, but DO select the card —
                    // previewing a map is a strong intent signal
                    // ("I'm interested in this one"), so picking it
                    // matches what the GM is about to do anyway.
                    e.stopPropagation()
                    setPickedId(map.id)
                    setPreviewMapId(map.id)
                  }}
                >
                  <MagnifierIcon />
                </button>
                <span className="map-gallery-item-name">{map.file}</span>
              </div>
            )
          })}
          {!loading && !errorKey && manifest && filteredMaps.length === 0 && (
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
            <button type="button" onClick={handleClose}>
              {t('tabletop.gallery.cancel')}
            </button>
            <button
              type="button"
              className="primary"
              disabled={!pickedIsVisible || applying}
              onClick={() => {
                if (pickedId !== null) void handlePick(pickedId)
              }}
            >
              {applying
                ? t('tabletop.gallery.applying')
                : t('tabletop.gallery.use')}
            </button>
          </div>
        </footer>
      </div>
      {previewMap && (
        <Lightbox
          // Hand the Lightbox every currently-visible map so prev /
          // next walk through the user's actual working set —
          // search and tag filters in the dialog above carry into
          // the preview navigation. Use the original (WebP) here so
          // the preview matches what "Use this map" actually applies;
          // WebP compression keeps the bytes close to the retired
          // mid-resolution JPEG.
          images={filteredMaps.map((m) => ({
            name: m.file,
            dataUrl: originalUrl(m),
          }))}
          index={Math.max(
            0,
            filteredMaps.findIndex((m) => m.id === previewMap.id),
          )}
          onIndexChange={(nextIdx) => {
            const next = filteredMaps[nextIdx]
            if (!next) return
            setPreviewMapId(next.id)
            // Moving in the preview is a stronger intent signal
            // than just hovering — mirror the pick state and pull
            // the card into view in the grid behind so a quick
            // dismiss lands back on the right thumbnail.
            setPickedId(next.id)
            const el = document.querySelector<HTMLElement>(
              `[data-map-id="${next.id}"]`,
            )
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }}
          onClose={() => setPreviewMapId(null)}
          // Surface the map's description below the preview so the
          // GM doesn't have to dismiss the Lightbox to read it.
          caption={previewMap.desc || previewMap.file}
        />
      )}
    </div>
  )
}
