import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useFieldNotice } from '../hooks/useFieldNotice'
import type { UseCharacters } from '../characters/useCharacters'
import { exportCharacterJSON } from '../characters/io'
import { prepareCharacterImage } from '../characters/image'
import { Lightbox } from './Lightbox'

interface Props {
  characters: UseCharacters
  onNotice: (message: string) => void
}

/**
 * Character management. Laid out as six zones so each block has one
 * clear job and adjacent actions don't get confused with each other:
 *
 * 1. Switcher (select an active character)
 * 2. Add a character (new / import — both grow the collection)
 * 3. Character card (avatar + name + 1-line background — a summary)
 * 4. Edit fields (name, image, background, memo)
 * 5. Export (option + button)
 * 6. Danger zone (delete — isolated at the bottom)
 */
export function CharacterPanel({ characters, onNotice }: Props) {
  const { t, lang } = useI18n()
  const {
    characters: list,
    activeId,
    activeCharacter,
    setActiveId,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    importCharacter,
  } = characters

  const [importError, setImportError] = useState(false)
  // Portrait state: a spinner-style busy flag while an image is processed,
  // an error flag, and whether the full-size viewer is open.
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  // GitHub-style "Edit" popover next to the profile picture.
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageMenuRef = useRef<HTMLDivElement>(null)

  // Close the image-edit popover on outside click or Escape so it
  // behaves like other lightweight menus across the app. `e.target` on
  // a `MouseEvent` is typed as `EventTarget | null` and is not
  // guaranteed to be a DOM Node (eg. when synthesised in tests), so
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

  // Close the popover if the active character changes (or is cleared)
  // while it is open — otherwise the menu would stay "open" in state
  // and pop back up the next time a character is selected. Done with
  // the "set state during render" pattern React recommends over an
  // effect, to avoid cascading renders.
  const [popoverCharId, setPopoverCharId] = useState<string | null>(
    activeCharacter?.id ?? null,
  )
  if (popoverCharId !== (activeCharacter?.id ?? null)) {
    setPopoverCharId(activeCharacter?.id ?? null)
    setImageMenuOpen(false)
  }

  // One toast after a burst of name edits settles, not per keystroke.
  // Toast once the name edit settles (on blur or when the sheet closes).
  const nameNotice = useFieldNotice(() => onNotice(t('toast.characterName')))
  // The same settle-then-toast for the background / memo detail fields.
  const detailNotice = useFieldNotice(() => onNotice(t('toast.characterDetail')))

  const handleCreate = () => {
    createCharacter('', lang)
  }

  const handleDelete = () => {
    if (!activeCharacter) return
    const name = activeCharacter.name || t('character.unnamed')
    if (window.confirm(t('character.deleteConfirm', { name }))) {
      deleteCharacter(activeCharacter.id)
    }
  }

  const handleExport = () => {
    if (!activeCharacter) return
    const blob = new Blob(
      [exportCharacterJSON(activeCharacter, activeCharacter.exportMemo ?? false)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `character-${activeCharacter.name || 'unnamed'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    setImportError(false)
    file
      .text()
      .then((text) => importCharacter(text))
      .then((ok) => {
        if (!ok) setImportError(true)
      })
      .catch(() => setImportError(true))
  }

  // Attach / replace the portrait: the picked file is downscaled and
  // compressed (see characters/image.ts) before it is stored.
  const handlePickImage = () => {
    setImageMenuOpen(false)
    imageInputRef.current?.click()
  }

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file || !activeCharacter) return
    const characterId = activeCharacter.id
    setImageError(false)
    setImageBusy(true)
    prepareCharacterImage(file)
      .then((image) => {
        if (image) updateCharacter(characterId, { image })
        else setImageError(true)
      })
      .catch(() => setImageError(true))
      .finally(() => setImageBusy(false))
  }

  const handleRemoveImage = () => {
    setImageMenuOpen(false)
    if (activeCharacter) updateCharacter(activeCharacter.id, { image: undefined })
  }

  return (
    <section className="panel">
      <h2>
        <span className="panel-icon" aria-hidden="true">
          🎭
        </span>
        {t('character.section')}
      </h2>

      {/* === Zone 1: switcher === */}
      <label className="field">
        <span>{t('character.activeLabel')}</span>
        <select value={activeId ?? ''} onChange={(e) => setActiveId(e.target.value || null)}>
          <option value="">{t('character.asPlayer')}</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || t('character.unnamed')}
            </option>
          ))}
        </select>
      </label>

      {/* === Zone 2: add a character (creation + import grouped) === */}
      <div className="char-add">
        <h3>{t('character.addSection')}</h3>
        <div className="char-add-buttons">
          <button type="button" onClick={handleCreate}>
            <span aria-hidden="true">+ </span>
            {t('character.create')}
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <span aria-hidden="true">+ </span>
            {t('character.import')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportFile}
        />
        {importError && (
          <p className="banner error" role="alert">
            {t('character.importError')}
          </p>
        )}
      </div>

      {list.length === 0 && <p className="hint">{t('character.empty')}</p>}

      {activeCharacter && (
        <>
          {/* === Zone 3: character card (visual summary) === */}
          <div className="char-card">
            <button
              type="button"
              className="char-card-avatar"
              disabled={!activeCharacter.image}
              aria-label={t('character.imageView')}
              onClick={() => activeCharacter.image && setLightboxOpen(true)}
            >
              {activeCharacter.image ? (
                <img src={activeCharacter.image} alt="" />
              ) : (
                <span aria-hidden="true">🎭</span>
              )}
            </button>
            <div className="char-card-body">
              <p className="char-card-name">
                {activeCharacter.name || t('character.unnamed')}
              </p>
              {activeCharacter.background && (
                <p className="char-card-background">{activeCharacter.background}</p>
              )}
            </div>
          </div>

          {/* === Zone 4: edit fields === */}
          <div className="char-details">
            <label className="field">
              <span>{t('character.name')}</span>
              <input
                type="text"
                value={activeCharacter.name}
                maxLength={40}
                placeholder={t('character.namePlaceholder')}
                onChange={(e) => {
                  updateCharacter(activeCharacter.id, { name: e.target.value })
                  nameNotice.markChanged()
                }}
                onBlur={nameNotice.flush}
              />
            </label>

            <div className="field char-avatar-field">
              <span>{t('character.image')}</span>
              {/* GitHub-style portrait: a large circular avatar with an
                  "Edit" pill button overlaid bottom-left that opens a
                  small popover offering upload (and remove, if present). */}
              <div className="char-avatar-area">
                {activeCharacter.image ? (
                  <button
                    type="button"
                    className="char-avatar-large"
                    aria-label={t('character.imageView')}
                    onClick={() => setLightboxOpen(true)}
                    disabled={imageBusy}
                  >
                    <img src={activeCharacter.image} alt="" />
                  </button>
                ) : (
                  <div className="char-avatar-large" aria-hidden="true">
                    <span className="char-avatar-placeholder">🎭</span>
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
                    <span aria-hidden="true">✏️</span>
                    {t('character.imageEdit')}
                  </button>
                  {imageMenuOpen && (
                    // No `role="menu"` here — the contents are a simple
                    // list of buttons. A real ARIA menu would require
                    // full keyboard (arrow / Home / End) navigation,
                    // which this lightweight popover does not implement.
                    <div className="char-avatar-edit-menu">
                      <button type="button" onClick={handlePickImage}>
                        {activeCharacter.image
                          ? t('character.imageChange')
                          : t('character.imageAdd')}
                      </button>
                      {activeCharacter.image && (
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
                value={activeCharacter.background}
                maxLength={1000}
                placeholder={t('character.backgroundPlaceholder')}
                onChange={(e) => {
                  updateCharacter(activeCharacter.id, { background: e.target.value })
                  detailNotice.markChanged()
                }}
                onBlur={detailNotice.flush}
              />
            </label>

            <label className="field">
              <span>{t('character.memo')}</span>
              <textarea
                rows={5}
                value={activeCharacter.memo}
                maxLength={2000}
                placeholder={t('character.memoPlaceholder')}
                onChange={(e) => {
                  updateCharacter(activeCharacter.id, { memo: e.target.value })
                  detailNotice.markChanged()
                }}
                onBlur={detailNotice.flush}
              />
            </label>
          </div>

          {/* === Zone 5: export (option + button kept together) === */}
          <div className="char-export">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={activeCharacter.exportMemo ?? false}
                onChange={(e) =>
                  updateCharacter(activeCharacter.id, { exportMemo: e.target.checked })
                }
              />
              <span>{t('character.exportMemo')}</span>
            </label>
            <button type="button" onClick={handleExport}>
              {t('character.export')}
            </button>
          </div>

          {/* === Zone 6: danger zone (delete) === */}
          <div className="char-danger">
            <button type="button" className="link danger" onClick={handleDelete}>
              {t('character.delete')}
            </button>
          </div>
        </>
      )}

      {lightboxOpen && activeCharacter?.image && (
        <Lightbox
          images={[
            {
              name: activeCharacter.name || t('character.unnamed'),
              dataUrl: activeCharacter.image,
            },
          ]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </section>
  )
}
