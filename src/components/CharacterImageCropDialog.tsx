import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useI18n } from '../i18n/useI18n'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { cropImageToDataUrl } from '../characters/cropImage'
import { CloseIcon } from './icons'

interface Props {
  /** Source image as a data URL (or any `<img>`-loadable src). */
  src: string
  onCancel: () => void
  onConfirm: (croppedDataUrl: string) => void
}

/**
 * Modal dialog for cropping a freshly-picked character portrait into a
 * 1:1 (square) avatar. The crop area is rendered as a **circle** to
 * preview how the result will look in the feed avatar and roster
 * roundels; the saved image itself is square (the round mask is purely
 * a CSS effect at display time). A zoom slider lets the user dial the
 * image in past the default centre fit.
 */
export function CharacterImageCropDialog({ src, onCancel, onConfirm }: Props) {
  const { t } = useI18n()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Per-instance id so the title link is robust if this ever co-mounts
  // with another dialog rather than colliding on a shared static id.
  const titleId = useId()

  // Move focus into the dialog on open, trap Tab while open, and restore
  // focus to the trigger on close.
  useDialogFocus(dialogRef)

  // Close on Escape. The listener runs in the *capture* phase and calls
  // `stopImmediatePropagation()` so the key does not also reach the
  // window-level Escape handler on the Sheet underneath — this dialog is
  // rendered as a DOM *descendant* of the character Sheet (the editor
  // opens it inline), so a plain bubbling Escape would close both. Same
  // pattern as ConfirmDialog / CharacterInfoModal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const onCropComplete = useCallback((_cropped: Area, areaPixels: Area) => {
    setPixelCrop(areaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!pixelCrop || busy) return
    setBusy(true)
    const dataUrl = await cropImageToDataUrl(src, pixelCrop)
    setBusy(false)
    if (dataUrl) onConfirm(dataUrl)
  }

  return (
    <div
      className="sheet-layer crop-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={dialogRef}
    >
      <div className="sheet-backdrop" onClick={onCancel} />
      <div className="sheet crop-sheet">
        <div className="sheet-header">
          <h2 className="sheet-title" id={titleId}>{t('character.crop.title')}</h2>
          <button
            type="button"
            className="sheet-close icon-btn"
            aria-label={t('settings.close')}
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body crop-body">
          <div className="crop-stage" aria-label={t('character.crop.title')}>
            {/* `cropShape="round"` paints the overlay as a circle so the
                preview matches the round avatar used in the feed and
                roster. The actual cropped bytes we save are still
                square (1:1 aspect) — display-time CSS turns the square
                into a roundel. */}
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <p className="hint crop-hint">{t('character.crop.hint')}</p>
          <label className="crop-zoom">
            <span>{t('character.crop.zoom')}</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <div className="crop-actions">
            <button type="button" onClick={onCancel} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleConfirm}
              disabled={busy || !pixelCrop}
            >
              {t('common.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
