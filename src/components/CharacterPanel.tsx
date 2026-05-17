import { useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { UseCharacters } from '../characters/useCharacters'
import { exportCharacterJSON } from '../characters/io'

interface Props {
  characters: UseCharacters
}

/**
 * Character management: pick the active character, edit its name /
 * background / private memo, and export or import characters.
 */
export function CharacterPanel({ characters }: Props) {
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

  const [showDetails, setShowDetails] = useState(false)
  const [importError, setImportError] = useState(false)
  const [exportMemo, setExportMemo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    createCharacter('', lang)
    setShowDetails(true)
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
    const blob = new Blob([exportCharacterJSON(activeCharacter, exportMemo)], {
      type: 'application/json',
    })
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
      .then((text) => {
        if (!importCharacter(text)) setImportError(true)
        else setShowDetails(true)
      })
      .catch(() => setImportError(true))
  }

  return (
    <section className="panel">
      <h2>{t('character.section')}</h2>

      <div className="char-switch">
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
        <button type="button" onClick={handleCreate}>
          {t('character.create')}
        </button>
      </div>

      {list.length === 0 && <p className="hint">{t('character.empty')}</p>}

      {activeCharacter && (
        <>
          <label className="field">
            <span>{t('character.name')}</span>
            <input
              type="text"
              value={activeCharacter.name}
              maxLength={40}
              placeholder={t('character.namePlaceholder')}
              onChange={(e) => updateCharacter(activeCharacter.id, { name: e.target.value })}
            />
          </label>

          <button
            type="button"
            className="link disclosure"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? '▾' : '▸'} {t('character.details')}
          </button>

          {showDetails && (
            <div className="char-details">
              <label className="field">
                <span>{t('character.background')}</span>
                <textarea
                  rows={3}
                  value={activeCharacter.background}
                  maxLength={1000}
                  placeholder={t('character.backgroundPlaceholder')}
                  onChange={(e) =>
                    updateCharacter(activeCharacter.id, { background: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>{t('character.memo')}</span>
                <textarea
                  rows={3}
                  value={activeCharacter.memo}
                  maxLength={2000}
                  placeholder={t('character.memoPlaceholder')}
                  onChange={(e) => updateCharacter(activeCharacter.id, { memo: e.target.value })}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={exportMemo}
                  onChange={(e) => setExportMemo(e.target.checked)}
                />
                <span>{t('character.exportMemo')}</span>
              </label>
              <div className="char-actions">
                <button type="button" onClick={handleExport}>
                  {t('character.export')}
                </button>
                <button type="button" className="link danger" onClick={handleDelete}>
                  {t('character.delete')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="char-io">
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          {t('character.import')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportFile}
        />
      </div>
      {importError && (
        <p className="banner error" role="alert">
          {t('character.importError')}
        </p>
      )}
    </section>
  )
}
