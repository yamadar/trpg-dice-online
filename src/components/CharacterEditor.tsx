import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useFieldNotice } from '../hooks/useFieldNotice'
import type { Character, CharacterEdits } from '../characters/types'
import { prepareCharacterImage } from '../characters/image'
import { CharacterIcon, EditIcon } from './icons'
import { Lightbox } from './Lightbox'
import { CharacterImageCropDialog } from './CharacterImageCropDialog'

interface Props {
  /** The character being edited — not necessarily the active one. */
  character: Character
  /** Apply a partial edit to this character. */
  onUpdate: (patch: Partial<CharacterEdits>) => void
  onNotice: (message: string) => void
  /** Bump this to focus the name field — used when a brand-new
   *  character is created so the user can type its name right away. */
  autoFocusSignal?: number
}

/**
 * Character card (avatar + name + background summary) and the edit
 * fields (name, portrait, background, memo). Extracted from
 * `CharacterPanel` so the same editor can be reused inside the
 * tabletop's per-token "character info" modal — which edits the token's
 * bound character regardless of which one is currently active. All image
 * handling (upload → crop → downscale, the GitHub-style edit popover,
 * and the full-size lightbox) lives here.
 */
export function CharacterEditor({
  character,
  onUpdate,
  onNotice,
  autoFocusSignal,
}: Props) {
  const { t } = useI18n()
  const nameRef = useRef<HTMLInputElement>(null)
  // Focus the name field whenever the parent bumps the signal (a fresh
  // "create character"). Falsy on mount (undefined / 0) so it does not
  // steal focus when the editor first appears or the character switches.
  useEffect(() => {
    if (autoFocusSignal) nameRef.current?.focus()
  }, [autoFocusSignal])
  // Crop dialog source (a freshly picked file as a data URL); the
  // confirm callback feeds the cropped result through the resize
  // pipeline. A spinner-style busy flag and an error flag cover the
  // async processing, and `lightboxOpen` toggles the full-size viewer.
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageMenuRef = useRef<HTMLDivElement>(null)

  // Close the image-edit popover on outside click or Escape. `e.target`
  // is `EventTarget | null` and not guaranteed to be a DOM Node, so
  // guard before calling `.contains`.
  useEffect(() => {
    if (!imageMenuOpen) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (imageMenuRef.current && !imageMenuRef.current.contains(target)) {
        setImageMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImageMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [imageMenuOpen])

  // Close the popover when the edited character changes, using the
  // "set state during render" pattern React recommends over an effect.
  const [shownId, setShownId] = useState(character.id)
  if (shownId !== character.id) {
    setShownId(character.id)
    setImageMenuOpen(false)
  }

  // One toast after a burst of edits settles (on blur), not per keystroke.
  const nameNotice = useFieldNotice(() => onNotice(t('toast.characterName')))
  const detailNotice = useFieldNotice(() => onNotice(t('toast.characterDetail')))

  const handlePickImage = () => {
    setImageMenuOpen(false)
    imageInputRef.current?.click()
  }

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setImageError(false)
    // Read the picked file into a data URL so the crop dialog has a
    // source. Confirm feeds the cropped URL through the portrait
    // pipeline; cancel clears it and saves nothing.
    const reader = new FileReader()
    reader.onload = () => setCropSource(String(reader.result))
    reader.onerror = () => setImageError(true)
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = (croppedDataUrl: string) => {
    setCropSource(null)
    setImageBusy(true)
    prepareCharacterImage(croppedDataUrl)
      .then((image) => {
        if (image) onUpdate({ image })
        else setImageError(true)
      })
      .catch(() => setImageError(true))
      .finally(() => setImageBusy(false))
  }

  const handleCropCancel = () => setCropSource(null)

  const handleRemoveImage = () => {
    setImageMenuOpen(false)
    onUpdate({ image: undefined })
  }

  return (
    <>
      {/* === Character card (visual summary) === */}
      <div className="char-card">
        <button
          type="button"
          className="char-card-avatar"
          disabled={!character.image}
          aria-label={t('character.imageView')}
          onClick={() => character.image && setLightboxOpen(true)}
        >
          {character.image ? (
            <img src={character.image} alt="" />
          ) : (
            <span aria-hidden="true">
              <CharacterIcon size={28} />
            </span>
          )}
        </button>
        <div className="char-card-body">
          <p className="char-card-name">
            {character.name || t('character.unnamed')}
          </p>
          {character.background && (
            <p className="char-card-background">{character.background}</p>
          )}
        </div>
      </div>

      {/* === Edit fields === */}
      <div className="char-details">
        <label className="field">
          <span>{t('character.name')}</span>
          <input
            ref={nameRef}
            type="text"
            value={character.name}
            maxLength={40}
            placeholder={t('character.namePlaceholder')}
            onChange={(e) => {
              onUpdate({ name: e.target.value })
              nameNotice.markChanged()
            }}
            onBlur={nameNotice.flush}
          />
        </label>

        <div className="field char-avatar-field">
          <span>{t('character.image')}</span>
          {/* GitHub-style portrait: a large circular avatar with an
              "Edit" pill button overlaid that opens a small popover
              offering upload (and remove, if present). */}
          <div className="char-avatar-area">
            {character.image ? (
              <button
                type="button"
                className="char-avatar-large"
                aria-label={t('character.imageView')}
                onClick={() => setLightboxOpen(true)}
                disabled={imageBusy}
              >
                <img src={character.image} alt="" />
              </button>
            ) : (
              <div className="char-avatar-large" aria-hidden="true">
                <span className="char-avatar-placeholder">
                  <CharacterIcon size={56} />
                </span>
              </div>
            )}
            <div className="char-avatar-edit" ref={imageMenuRef}>
              <button
                type="button"
                className="char-avatar-edit-trigger"
                aria-haspopup="true"
                aria-expanded={imageMenuOpen}
                disabled={imageBusy}
                onClick={() => setImageMenuOpen((v) => !v)}
              >
                <span aria-hidden="true">
                  <EditIcon />
                </span>
                {t('character.imageEdit')}
              </button>
              {imageMenuOpen && (
                // No `role="menu"` — the contents are a simple list of
                // buttons. A real ARIA menu would require full keyboard
                // navigation this lightweight popover does not implement.
                <div className="char-avatar-edit-menu">
                  <button type="button" onClick={handlePickImage}>
                    {character.image
                      ? t('character.imageChange')
                      : t('character.imageAdd')}
                  </button>
                  {character.image && (
                    <button type="button" className="danger" onClick={handleRemoveImage}>
                      {t('character.imageRemove')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {imageBusy && <p className="hint">{t('character.imageProcessing')}</p>}
          {imageError && (
            <p className="banner error" role="alert">
              {t('character.imageError')}
            </p>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleImageFile}
          />
        </div>

        <label className="field">
          <span>{t('character.background')}</span>
          <textarea
            rows={5}
            value={character.background}
            maxLength={1000}
            placeholder={t('character.backgroundPlaceholder')}
            onChange={(e) => {
              onUpdate({ background: e.target.value })
              detailNotice.markChanged()
            }}
            onBlur={detailNotice.flush}
          />
        </label>

        <label className="field">
          <span>{t('character.memo')}</span>
          <textarea
            rows={5}
            value={character.memo}
            maxLength={2000}
            placeholder={t('character.memoPlaceholder')}
            onChange={(e) => {
              onUpdate({ memo: e.target.value })
              detailNotice.markChanged()
            }}
            onBlur={detailNotice.flush}
          />
        </label>
      </div>

      {lightboxOpen && character.image && (
        <Lightbox
          images={[
            {
              name: character.name || t('character.unnamed'),
              dataUrl: character.image,
            },
          ]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {cropSource && (
        <CharacterImageCropDialog
          src={cropSource}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  )
}
