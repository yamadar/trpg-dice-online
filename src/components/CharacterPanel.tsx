import { useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { UseCharacters } from '../characters/useCharacters'
import { exportCharacterJSON } from '../characters/io'
import { useConfirm } from '../hooks/useConfirm'
import { CharacterEditor } from './CharacterEditor'

interface Props {
  characters: UseCharacters
  onNotice: (message: string) => void
}

/**
 * Character management. The card + edit fields live in the shared
 * `CharacterEditor` (also reused by the tabletop's character-info
 * modal); this panel adds the surrounding zones that only make sense in
 * the full management view:
 *
 * 1. Switcher (select an active character)
 * 2. Add a character (new / import)
 * — CharacterEditor: card + edit fields (name, image, background, memo)
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    createCharacter('', lang)
  }

  const confirm = useConfirm()
  const handleDelete = async () => {
    if (!activeCharacter) return
    const name = activeCharacter.name || t('character.unnamed')
    const ok = await confirm({
      message: t('character.deleteConfirm', { name }),
      destructive: true,
    })
    if (!ok) return
    deleteCharacter(activeCharacter.id)
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

  return (
    <section className="panel">
      {/* The panel title + icon lives in the parent `Sheet` header so the
          heading stays pinned above the scrollable body. */}

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
          {/* === Zones 3-4: card + edit fields (shared editor) === */}
          <CharacterEditor
            character={activeCharacter}
            onUpdate={(patch) => updateCharacter(activeCharacter.id, patch)}
            onNotice={onNotice}
          />

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
    </section>
  )
}
