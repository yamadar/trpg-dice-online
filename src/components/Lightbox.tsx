import { useCallback, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { useDialogEscape } from '../hooks/useDialogEscape'
import { CloseIcon } from './icons'

/** The minimum the viewer needs to show an image. A `ChatFile` satisfies it. */
export interface LightboxImage {
  name: string
  dataUrl: string
}

interface Props {
  /** Images to page through, in order. */
  images: LightboxImage[]
  /** Index of the image being shown. */
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  /** Optional caption overlay shown along the bottom edge of the
   *  viewer — used by the map-gallery picker to surface each map's
   *  description without leaving the preview. */
  caption?: string
}

/** Minimum horizontal travel (px) for a touch to count as a swipe. */
const SWIPE_THRESHOLD = 40

/**
 * Fullscreen image viewer. The image is shown fit-to-screen; the previous
 * / next image is reached with the arrow keys, a horizontal swipe, or the
 * on-screen arrows. Escape or a tap on the backdrop dismisses it.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  caption,
}: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  // A swipe also ends with a click event; this flag swallows that click so
  // a navigating swipe does not also close the viewer.
  const swipedRef = useRef(false)

  // Move focus into the viewer on open, trap Tab among its controls, and
  // restore focus to the thumbnail that opened it on close.
  useDialogFocus(dialogRef)

  const file = images[index]
  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const go = useCallback(
    (dir: -1 | 1) => {
      const next = index + dir
      if (next >= 0 && next < images.length) onIndexChange(next)
    },
    [index, images.length, onIndexChange],
  )

  // Escape closes the viewer — and only the viewer when it sits over
  // another dialog (a Sheet, or a token's character modal it was opened
  // from, where it is a descendant dialog). Shared capture-phase handler;
  // see `useDialogEscape`.
  useDialogEscape(dialogRef, onClose)

  // Arrow keys page through the images. Capture phase + `preventDefault()`
  // keeps the page (or a tabletop underneath) from also scrolling on the
  // same key. Rebinds only when navigation context (`go`) changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go])

  if (!file) return null

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      ref={dialogRef}
      onClick={() => {
        if (swipedRef.current) swipedRef.current = false
        else onClose()
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start == null) return
        const dx = (e.changedTouches[0]?.clientX ?? start) - start
        if (Math.abs(dx) >= SWIPE_THRESHOLD) {
          swipedRef.current = true
          go(dx < 0 ? 1 : -1)
        }
      }}
    >
      <button
        type="button"
        className="lightbox-close icon-btn"
        aria-label={t('lightbox.close')}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <CloseIcon />
      </button>

      {images.length > 1 && (
        <span className="lightbox-count">
          {index + 1} / {images.length}
        </span>
      )}

      {hasPrev && (
        <button
          type="button"
          className="lightbox-nav prev"
          aria-label={t('lightbox.prev')}
          onClick={(e) => {
            e.stopPropagation()
            go(-1)
          }}
        >
          ‹
        </button>
      )}

      <div className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <img className="lightbox-img" src={file.dataUrl} alt={file.name} />
        {caption && <p className="lightbox-caption">{caption}</p>}
      </div>

      {hasNext && (
        <button
          type="button"
          className="lightbox-nav next"
          aria-label={t('lightbox.next')}
          onClick={(e) => {
            e.stopPropagation()
            go(1)
          }}
        >
          ›
        </button>
      )}
    </div>
  )
}
