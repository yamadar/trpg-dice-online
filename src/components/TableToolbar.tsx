import { useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  type Grid,
  type GridKind,
  type MapBackground,
  type NpcDef,
} from '../tabletop/types'
import type { MapImageError } from '../tabletop/imageBackground'
import type { Character } from '../characters/types'
import { TrashIcon } from './icons'
import { CharacterImageCropDialog } from './CharacterImageCropDialog'

interface Props {
  grid: Grid
  onChange: (grid: Grid) => void
  map: MapBackground | undefined
  onSetMap: (file: File) => Promise<'ok' | MapImageError>
  onClearMap: () => void
  /** Local player's own characters (from `useCharacters`). The toolbar
   *  surfaces these as "place token" buttons so a player can add
   *  themselves to the map — multiple times if they want. */
  characters: ReadonlyArray<Character>
  /** Place a fresh PC token for the local player's named character.
   *  Multi-placement is allowed: each call mints a new token id. */
  onPlaceMyCharacter: (characterId: string) => void
  /** GM-only: the NPC library. Empty list hides the library section. */
  npcLibrary: ReadonlyArray<NpcDef>
  /** GM-only: add a fresh NPC to the library. Caller is responsible
   *  for cropping; image arrives as a data URL ready for the
   *  300-px / 200-KB downscale pipeline. */
  onAddNpcDef: (input: File | string, name: string) => Promise<'ok' | 'unreadable'>
  onRemoveNpcDef: (defId: string) => void
  onPlaceNpcFromLibrary: (defId: string) => void
  /** When true, render the GM-only NPC library section. */
  isHost: boolean
  /** Surface a flash message. Optional. */
  onNotice?: (text: string, kind: 'success' | 'error') => void
}

/**
 * Tabletop control panel. Two collapsible categories:
 *
 *   - "Map & grid": background image, grid config, map upload / clear.
 *   - "Tokens": PC characters owned by the local player (multi-placeable);
 *     for hosts also the NPC library (add / list / place / remove).
 *
 * The panel caps at the viewport height and self-scrolls; the host's
 * floating popover (`TokenPopover`) handles per-token editing on the
 * canvas, so this toolbar is for additions and library management
 * rather than per-instance tweaking.
 */
export function TableToolbar({
  grid,
  onChange,
  map,
  onSetMap,
  onClearMap,
  characters,
  onPlaceMyCharacter,
  npcLibrary,
  onAddNpcDef,
  onRemoveNpcDef,
  onPlaceNpcFromLibrary,
  isHost,
  onNotice,
}: Props) {
  const { t } = useI18n()
  const mapInputRef = useRef<HTMLInputElement | null>(null)
  const npcInputRef = useRef<HTMLInputElement | null>(null)
  // NPC add flow state. The name is collected from a text field; the
  // image is read into `cropSrc` so the CharacterImageCropDialog can
  // crop it square / circular before save.
  const [npcName, setNpcName] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const set = <K extends keyof Grid>(key: K, value: Grid[K]) =>
    onChange({ ...grid, [key]: value })

  const handleMapFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = await onSetMap(file)
    if (result === 'ok') {
      onNotice?.(t('tabletop.map.set'), 'success')
    } else if (result === 'tooLarge') {
      onNotice?.(t('tabletop.map.tooLarge'), 'error')
    } else {
      onNotice?.(t('tabletop.map.unreadable'), 'error')
    }
  }

  const handleNpcFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!npcName.trim()) {
      onNotice?.(t('tabletop.npcLibrary.needName'), 'error')
      return
    }
    // Read the file as a data URL so the crop dialog can decode it
    // without further await chain. The dialog crops and hands the
    // result back via `onConfirm` — at that point we hit `addNpcDef`.
    const reader = new FileReader()
    reader.onload = () => setCropSrc(String(reader.result))
    reader.onerror = () =>
      onNotice?.(t('tabletop.npcLibrary.unreadable'), 'error')
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async (croppedDataUrl: string) => {
    setCropSrc(null)
    const result = await onAddNpcDef(croppedDataUrl, npcName)
    if (result === 'ok') {
      onNotice?.(t('tabletop.npcLibrary.added'), 'success')
      setNpcName('')
    } else {
      onNotice?.(t('tabletop.npcLibrary.unreadable'), 'error')
    }
  }

  return (
    <aside className="tabletop-toolbar" aria-label={t('tabletop.panel.title')}>
      {/* The "Map & grid" section is GM-only — it edits the table's
          authoritative state. Players see only the Tokens section
          (their own characters' "place" buttons). */}
      {isHost && (
      <details className="tabletop-toolbar-section" open>
        <summary className="tabletop-toolbar-summary">
          {t('tabletop.panel.mapGrid')}
        </summary>
        <div className="tabletop-toolbar-section-body">
          <h3 className="tabletop-toolbar-title">{t('tabletop.grid.title')}</h3>
          <label className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.kind')}</span>
            <select
              value={grid.kind}
              onChange={(e) => set('kind', e.target.value as GridKind)}
            >
              <option value="none">{t('tabletop.grid.kindNone')}</option>
              <option value="square">{t('tabletop.grid.kindSquare')}</option>
            </select>
          </label>
          <label className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.cellSize')}</span>
            <input
              type="number"
              min={MIN_CELL_SIZE}
              max={MAX_CELL_SIZE}
              step={1}
              value={grid.cellSize}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) {
                  const clamped = Math.max(
                    MIN_CELL_SIZE,
                    Math.min(MAX_CELL_SIZE, n),
                  )
                  set('cellSize', clamped)
                }
              }}
            />
          </label>
          <label className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.originX')}</span>
            <input
              type="number"
              step={1}
              value={grid.originX}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) set('originX', n)
              }}
            />
          </label>
          <label className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.originY')}</span>
            <input
              type="number"
              step={1}
              value={grid.originY}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) set('originY', n)
              }}
            />
          </label>
          <label className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.strokeColor')}</span>
            <input
              type="color"
              value={grid.strokeColor}
              onChange={(e) => set('strokeColor', e.target.value)}
            />
          </label>
          <label className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.strokeOpacity')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={grid.strokeOpacity}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) {
                  set('strokeOpacity', Math.max(0, Math.min(1, n)))
                }
              }}
            />
          </label>
          <label className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.snap')}</span>
            <input
              type="checkbox"
              checked={grid.snap}
              onChange={(e) => set('snap', e.target.checked)}
            />
          </label>

          <hr className="tabletop-toolbar-divider" />
          <h3 className="tabletop-toolbar-title">{t('tabletop.map.title')}</h3>
          <input
            ref={mapInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleMapFile}
          />
          <button
            type="button"
            className="tabletop-toolbar-button"
            onClick={() => mapInputRef.current?.click()}
          >
            {map ? t('tabletop.map.replace') : t('tabletop.map.choose')}
          </button>
          {map && (
            <>
              <p className="tabletop-toolbar-meta" title={map.name}>
                {map.name} ({map.width}×{map.height})
              </p>
              <button
                type="button"
                className="tabletop-toolbar-button outline"
                onClick={onClearMap}
              >
                {t('tabletop.map.clear')}
              </button>
            </>
          )}
        </div>
      </details>
      )}

      <details className="tabletop-toolbar-section" open>
        <summary className="tabletop-toolbar-summary">
          {t('tabletop.panel.tokens')}
        </summary>
        <div className="tabletop-toolbar-section-body">
          <h3 className="tabletop-toolbar-title">
            {t('tabletop.playerToken.title')}
          </h3>
          {characters.length === 0 ? (
            <p className="tabletop-toolbar-meta">
              {t('tabletop.playerToken.noCharacters')}
            </p>
          ) : (
            <ul className="tabletop-toolbar-list">
              {characters.map((char) => (
                <li key={char.id} className="tabletop-toolbar-list-item">
                  {char.image ? (
                    <img
                      src={char.image}
                      alt=""
                      className="tabletop-toolbar-thumb"
                    />
                  ) : (
                    <span className="tabletop-toolbar-thumb placeholder" />
                  )}
                  <span
                    className="tabletop-toolbar-list-label"
                    title={char.name}
                  >
                    {char.name}
                  </span>
                  <button
                    type="button"
                    className="tabletop-toolbar-list-action"
                    onClick={() => onPlaceMyCharacter(char.id)}
                  >
                    {t('tabletop.playerToken.place')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isHost && (
            <>
              <hr className="tabletop-toolbar-divider" />
              <h3 className="tabletop-toolbar-title">
                {t('tabletop.npcLibrary.title')}
              </h3>
              <input
                ref={npcInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleNpcFile}
              />
              <input
                type="text"
                className="tabletop-toolbar-input"
                placeholder={t('tabletop.npcLibrary.namePlaceholder')}
                value={npcName}
                onChange={(e) => setNpcName(e.target.value)}
                maxLength={32}
              />
              <button
                type="button"
                className="tabletop-toolbar-button"
                onClick={() => {
                  if (!npcName.trim()) {
                    onNotice?.(t('tabletop.npcLibrary.needName'), 'error')
                    return
                  }
                  npcInputRef.current?.click()
                }}
              >
                {t('tabletop.npcLibrary.add')}
              </button>
              {npcLibrary.length > 0 && (
                <ul className="tabletop-toolbar-list">
                  {npcLibrary.map((def) => (
                    <li key={def.id} className="tabletop-toolbar-list-item">
                      {def.image ? (
                        <img
                          src={def.image}
                          alt=""
                          className="tabletop-toolbar-thumb"
                        />
                      ) : (
                        <span className="tabletop-toolbar-thumb placeholder" />
                      )}
                      <span
                        className="tabletop-toolbar-list-label"
                        title={def.name}
                      >
                        {def.name}
                      </span>
                      <button
                        type="button"
                        className="tabletop-toolbar-list-action"
                        onClick={() => onPlaceNpcFromLibrary(def.id)}
                      >
                        {t('tabletop.npcLibrary.place')}
                      </button>
                      <button
                        type="button"
                        className="icon-btn tabletop-toolbar-list-remove"
                        aria-label={t('tabletop.npcLibrary.remove')}
                        title={t('tabletop.npcLibrary.remove')}
                        onClick={() => onRemoveNpcDef(def.id)}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </details>

      {cropSrc && (
        <CharacterImageCropDialog
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onConfirm={(cropped) => void handleCropConfirm(cropped)}
        />
      )}
    </aside>
  )
}
