import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/useI18n'
import { CloseIcon } from './icons'
import type { ChatFile } from '../net/protocol'

interface Props {
  /** All image attachments currently in the feed, in order. */
  images: ChatFile[]
  /** Index of the image being shown. */
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

/** Minimum horizontal travel (px) for a touch to count as a swipe. */
const SWIPE_THRESHOLD = 40

/**
 * Fullscreen image viewer. The image is shown fit-to-screen; the previous
 * / next image is reached with the arrow keys, a horizontal swipe, or the
 * on-screen arrows. Escape or a tap on the backdrop dismisses it.
 */
export function Lightbox({ images, index, onIndexChange, onClose }: Props) {
  const { t } = useI18n()
  const touchStartX = useRef<number | null>(null)
  // A swipe also ends with a click event; this flag swallows that click so
  // a navigating swipe does not also close the viewer.
  const swipedRef = useRef(false)

  const file = images[index]
  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const go = (dir: -1 | 1) => {
    const next = index + dir
    if (next >= 0 && next < images.length) onIndexChange(next)
  }

  // No dependency array: rebinds each render so the handler always sees
  // the current index.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!file) return null

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
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
        className="lightbox-close icon-x"
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

      <img className="lightbox-img" src={file.dataUrl} alt={file.name} />

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
