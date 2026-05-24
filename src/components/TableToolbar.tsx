import { useEffect, useRef, useState } from 'react'
import { useConfirm } from '../hooks/useConfirm'
import { useI18n } from '../i18n/useI18n'
import {
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  type FogState,
  type Grid,
  type GridKind,
  type MapBackground,
  type NpcDef,
  type PresetMap,
  type SavedTabletop,
  type TabletopLibraryKind,
  type Token,
} from '../tabletop/types'
import type { MapImageError } from '../tabletop/imageBackground'
import { loadPresetMapManifest } from '../tabletop/presetMaps'
import type { Character } from '../characters/types'
import { prepareNpcTokenImage } from '../characters/image'
import { avatarInitial } from '../players/identity'
import { EditIcon, TrashIcon } from './icons'
import { CharacterImageCropDialog } from './CharacterImageCropDialog'

interface Props {
  grid: Grid
  onChange: (grid: Grid) => void
  map: MapBackground | undefined
  onSetMap: (file: File) => Promise<'ok' | MapImageError>
  onClearMap: () => void
  /** Local player's own characters (from `useCharacters`). The toolbar
   *  surfaces these as "place token" buttons so a player can add their
   *  characters to the map. Each character can only have one token on
   *  the map at a time; `placedCharacterIds` flips the per-character
   *  button to a disabled "already placed" state. */
  characters: ReadonlyArray<Character>
  /**
   * IDs of the local player's characters that already have a token on
   * the map. Used to disable the "place" button so the GM (and the
   * player) cannot accidentally produce duplicates.
   */
  placedCharacterIds: ReadonlySet<string>
  /** Place a fresh PC token for the local player's named character.
   *  One token per `(playerId, characterId)` is enforced at the
   *  session level; this UI just hides the affordance when one is
   *  already on the map. `characterName` and `image` are stamped onto
   *  the token's `snapshot` so the renderer can show a portrait and
   *  label for characters that are not currently the player's active
   *  one. */
  onPlaceMyCharacter: (
    characterId: string,
    characterName: string,
    image: string,
  ) => void
  /** GM-only: the NPC library. Empty list hides the library section. */
  npcLibrary: ReadonlyArray<NpcDef>
  /** GM-only: add a fresh NPC to the library. Caller is responsible
   *  for cropping; image arrives as a data URL ready for the
   *  300-px / 200-KB downscale pipeline. */
  /** Add an NPC to the library. The image is optional at add time —
   *  the GM enters a name first and can attach / change the portrait
   *  later through the NPC list's "set image" button (which uses
   *  `onUpdateNpcDef`). */
  onAddNpcDef: (name: string, input?: File | string) => Promise<'ok' | 'unreadable'>
  /** Edit an existing NPC's name or image. */
  onUpdateNpcDef: (
    defId: string,
    updates: { name?: string; image?: string },
  ) => void
  onRemoveNpcDef: (defId: string) => void
  onPlaceNpcFromLibrary: (defId: string) => void
  /** Snapshot of every token currently on the map, enriched with the
   *  display data (portrait / label) the renderer already computes.
   *  Used to render the "placed tokens" inventory section. */
  placedTokens: ReadonlyArray<{
    token: Token
    portrait: string | undefined
    label: string | undefined
  }>
  /** GM-only: drop the named token from the map. Mirrors the popover
   *  remove action so the GM can manage placements from a list too. */
  onRemoveToken: (tokenId: string) => void
  /** When true, render the GM-only NPC library section. */
  isHost: boolean
  /** GM-only: named templates and saves persisted globally in
   *  IndexedDB. Empty when nothing has been saved or storage is
   *  unavailable. */
  tabletopLibrary: ReadonlyArray<SavedTabletop>
  /** GM-only: snapshot the current tabletop under the given name.
   *  Templates strip PC tokens and stash a viewport centre as the PC
   *  spawn point; saves keep everything. */
  onSaveTabletopAs: (
    name: string,
    kind: TabletopLibraryKind,
  ) => Promise<'ok' | 'invalid'>
  /** GM-only: replace the current tabletop with a saved one. */
  onLoadTabletopFromLibrary: (id: string) => Promise<'ok' | 'missing'>
  /** GM-only: drop one entry from the library. */
  onDeleteTabletopFromLibrary: (id: string) => Promise<void>
  /** GM-only: load a bundled preset map from `public/maps/`. */
  onLoadPresetMap: (preset: PresetMap) => Promise<'ok' | MapImageError>
  /** Current fog of war state (GM section only). */
  fog: FogState
  /** GM-only: turn the fog layer on or off. */
  onFogEnabledChange: (enabled: boolean) => void
  /** GM-only: replace the fog state (used by reveal-all / cover-all). */
  onFogReplace: (fog: FogState) => void
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
  placedCharacterIds,
  npcLibrary,
  onAddNpcDef,
  onUpdateNpcDef,
  onRemoveNpcDef,
  onPlaceNpcFromLibrary,
  placedTokens,
  onRemoveToken,
  isHost,
  tabletopLibrary,
  onSaveTabletopAs,
  onLoadTabletopFromLibrary,
  onDeleteTabletopFromLibrary,
  onLoadPresetMap,
  fog,
  onFogEnabledChange,
  onFogReplace,
  onNotice,
}: Props) {
  const { t } = useI18n()
  const confirm = useConfirm()
  const mapInputRef = useRef<HTMLInputElement | null>(null)
  const npcImageInputRef = useRef<HTMLInputElement | null>(null)
  // NPC add flow state: just the name. The portrait is attached after
  // the NPC has been added through the per-row "set image" button so
  // a GM can register a stack of NPCs first and worry about art
  // later. `cropSrc` holds the picked image while the user crops it;
  // `editingNpcDefId` remembers which NPC the crop result applies to.
  const [npcName, setNpcName] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [editingNpcDefId, setEditingNpcDefId] = useState<string | null>(null)
  // Library save flow state: a single name input feeds both save
  // flavours; the buttons differ only in `kind`.
  const [libraryName, setLibraryName] = useState('')
  const [presets, setPresets] = useState<ReadonlyArray<PresetMap>>([])
  const [selectedPreset, setSelectedPreset] = useState('')
  const [loadingPreset, setLoadingPreset] = useState(false)
  const templates = tabletopLibrary.filter((e) => e.kind === 'template')
  const saves = tabletopLibrary.filter((e) => e.kind === 'save')

  // Fetch the preset-map manifest once per mount. Errors degrade to an
  // empty list — the toolbar still shows the hand-pick path.
  useEffect(() => {
    let cancelled = false
    loadPresetMapManifest().then((list) => {
      if (cancelled) return
      setPresets(list)
      if (list.length > 0) setSelectedPreset(list[0].id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLoadPreset = async () => {
    const preset = presets.find((p) => p.id === selectedPreset)
    if (!preset) return
    setLoadingPreset(true)
    try {
      const result = await onLoadPresetMap(preset)
      if (result === 'ok') {
        onNotice?.(t('tabletop.preset.loaded'), 'success')
      } else if (result === 'tooLarge') {
        onNotice?.(t('tabletop.map.tooLarge'), 'error')
      } else {
        onNotice?.(t('tabletop.preset.unreadable'), 'error')
      }
    } finally {
      setLoadingPreset(false)
    }
  }

  const handleFogFillAll = async () => {
    const ok = await confirm({
      message: t('tabletop.fog.confirmFillAll'),
      destructive: true,
    })
    if (!ok) return
    // "Cover all" = revealed list empty + fog on.
    onFogReplace({ enabled: true, revealed: [] })
  }

  const handleFogClearAll = async () => {
    const ok = await confirm({
      message: t('tabletop.fog.confirmClearAll'),
      destructive: true,
    })
    if (!ok) return
    // "Reveal all" = drop every previously-painted cell AND disable
    // the layer. The earlier behaviour preserved `revealed` so a
    // re-enable would restore the old pattern, but that contradicted
    // the button name ("reveal all") and surprised testers. A fresh
    // start matches the prompt and lets the GM build a new layout.
    onFogReplace({ enabled: false, revealed: [] })
  }

  const handleSaveAs = async (kind: TabletopLibraryKind) => {
    if (!libraryName.trim()) {
      onNotice?.(t('tabletop.library.needName'), 'error')
      return
    }
    const result = await onSaveTabletopAs(libraryName, kind)
    if (result === 'ok') {
      onNotice?.(
        t(
          kind === 'template'
            ? 'tabletop.library.savedTemplate'
            : 'tabletop.library.savedSave',
        ),
        'success',
      )
      setLibraryName('')
    } else {
      onNotice?.(t('tabletop.library.saveFailed'), 'error')
    }
  }

  const handleLoad = async (id: string) => {
    const result = await onLoadTabletopFromLibrary(id)
    if (result === 'ok') {
      onNotice?.(t('tabletop.library.loaded'), 'success')
    } else {
      onNotice?.(t('tabletop.library.loadFailed'), 'error')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      message: t('tabletop.library.confirmDelete', { name }),
      destructive: true,
    })
    if (!ok) return
    await onDeleteTabletopFromLibrary(id)
    onNotice?.(t('tabletop.library.deleted'), 'success')
  }
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

  const handleAddNpc = async () => {
    if (!npcName.trim()) {
      onNotice?.(t('tabletop.npcLibrary.needName'), 'error')
      return
    }
    const result = await onAddNpcDef(npcName)
    if (result === 'ok') {
      onNotice?.(t('tabletop.npcLibrary.added'), 'success')
      setNpcName('')
    } else {
      onNotice?.(t('tabletop.npcLibrary.unreadable'), 'error')
    }
  }

  const handleNpcImageFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editingNpcDefId) return
    // Read the file as a data URL so the crop dialog can decode it
    // without further await chain. The dialog crops and hands the
    // result back via `onConfirm` — at that point we hit
    // `onUpdateNpcDef` to attach the cropped portrait to the NPC the
    // user picked.
    const reader = new FileReader()
    reader.onload = () => setCropSrc(String(reader.result))
    reader.onerror = () => {
      setEditingNpcDefId(null)
      onNotice?.(t('tabletop.npcLibrary.unreadable'), 'error')
    }
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async (croppedDataUrl: string) => {
    const defId = editingNpcDefId
    setCropSrc(null)
    setEditingNpcDefId(null)
    if (!defId) return
    // The crop dialog returns the user's framing of the original file
    // verbatim; run it through the NPC-portrait pipeline so the
    // downscaled bytes fit inside the inline `npcDefUpsert` broadcast.
    const processed = await prepareNpcTokenImage(croppedDataUrl)
    if (!processed) {
      onNotice?.(t('tabletop.npcLibrary.unreadable'), 'error')
      return
    }
    onUpdateNpcDef(defId, { image: processed })
    onNotice?.(t('tabletop.npcLibrary.imageUpdated'), 'success')
  }

  const handleCropCancel = () => {
    setCropSrc(null)
    setEditingNpcDefId(null)
  }

  const handleSetNpcImage = (defId: string) => {
    setEditingNpcDefId(defId)
    npcImageInputRef.current?.click()
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

          <hr className="tabletop-toolbar-divider" />
          <h3 className="tabletop-toolbar-title">
            {t('tabletop.preset.title')}
          </h3>
          {presets.length === 0 ? (
            <p className="tabletop-toolbar-meta">
              {t('tabletop.preset.empty')}
            </p>
          ) : (
            <>
              <select
                className="tabletop-toolbar-input"
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                aria-label={t('tabletop.preset.choose')}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {(() => {
                const desc = presets.find((p) => p.id === selectedPreset)
                  ?.description
                return desc ? (
                  <p className="tabletop-toolbar-meta wrap">{desc}</p>
                ) : null
              })()}
              <button
                type="button"
                className="tabletop-toolbar-button"
                onClick={() => void handleLoadPreset()}
                disabled={loadingPreset || !selectedPreset}
              >
                {t('tabletop.preset.load')}
              </button>
            </>
          )}
        </div>
      </details>
      )}

      {isHost && (
        <details className="tabletop-toolbar-section">
          <summary className="tabletop-toolbar-summary">
            {t('tabletop.fog.title')}
          </summary>
          <div className="tabletop-toolbar-section-body">
            <label className="tabletop-toolbar-row">
              <span>{t('tabletop.fog.title')}</span>
              <input
                type="checkbox"
                checked={fog.enabled}
                onChange={(e) => onFogEnabledChange(e.target.checked)}
                aria-label={
                  fog.enabled
                    ? t('tabletop.fog.disable')
                    : t('tabletop.fog.enable')
                }
              />
            </label>
            <button
              type="button"
              className="tabletop-toolbar-button"
              onClick={handleFogFillAll}
            >
              {t('tabletop.fog.fillAll')}
            </button>
            <button
              type="button"
              className="tabletop-toolbar-button outline"
              onClick={handleFogClearAll}
            >
              {t('tabletop.fog.clearAll')}
            </button>
            {grid.kind !== 'square' && (
              <p className="tabletop-toolbar-meta wrap">
                {t('tabletop.fog.needGrid')}
              </p>
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
              {characters.map((char) => {
                const placed = placedCharacterIds.has(char.id)
                return (
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
                      disabled={placed}
                      title={
                        placed
                          ? t('tabletop.playerToken.alreadyPlaced')
                          : t('tabletop.playerToken.place')
                      }
                      onClick={() =>
                        onPlaceMyCharacter(
                          char.id,
                          char.name,
                          char.image || '',
                        )
                      }
                    >
                      {placed
                        ? t('tabletop.playerToken.placed')
                        : t('tabletop.playerToken.place')}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {isHost && (
            <>
              <hr className="tabletop-toolbar-divider" />
              <h3 className="tabletop-toolbar-title">
                {t('tabletop.npcLibrary.title')}
              </h3>
              <input
                ref={npcImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleNpcImageFile}
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
                onClick={() => void handleAddNpc()}
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
                        <span
                          className="tabletop-toolbar-thumb tabletop-toolbar-thumb-initial"
                          aria-hidden="true"
                        >
                          {avatarInitial(def.name)}
                        </span>
                      )}
                      <span
                        className="tabletop-toolbar-list-label"
                        title={def.name}
                      >
                        {def.name}
                      </span>
                      <button
                        type="button"
                        className="icon-btn tabletop-toolbar-list-icon-btn"
                        aria-label={
                          def.image
                            ? t('tabletop.npcLibrary.changeImage')
                            : t('tabletop.npcLibrary.setImage')
                        }
                        title={
                          def.image
                            ? t('tabletop.npcLibrary.changeImage')
                            : t('tabletop.npcLibrary.setImage')
                        }
                        onClick={() => handleSetNpcImage(def.id)}
                      >
                        <EditIcon />
                      </button>
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

          <hr className="tabletop-toolbar-divider" />
          <h3 className="tabletop-toolbar-title">
            {t('tabletop.placedTokens.title')}
          </h3>
          {placedTokens.length === 0 ? (
            <p className="tabletop-toolbar-meta">
              {t('tabletop.placedTokens.empty')}
            </p>
          ) : (
            <ul className="tabletop-toolbar-list">
              {placedTokens.map(({ token, portrait, label }) => {
                const displayName = label?.trim() || t('tabletop.placedTokens.unnamed')
                const kindLabel =
                  token.kind === 'pc'
                    ? t('tabletop.placedTokens.kindPc')
                    : t('tabletop.placedTokens.kindGm')
                return (
                  <li key={token.id} className="tabletop-toolbar-list-item">
                    {portrait ? (
                      <img
                        src={portrait}
                        alt=""
                        className="tabletop-toolbar-thumb"
                      />
                    ) : (
                      <span
                        className="tabletop-toolbar-thumb tabletop-toolbar-thumb-initial"
                        aria-hidden="true"
                      >
                        {avatarInitial(displayName)}
                      </span>
                    )}
                    <span
                      className="tabletop-toolbar-list-label"
                      title={`${displayName} · ${kindLabel}`}
                    >
                      {displayName}
                    </span>
                    <span className="tabletop-toolbar-list-tag">{kindLabel}</span>
                    {isHost && (
                      <button
                        type="button"
                        className="icon-btn tabletop-toolbar-list-remove"
                        aria-label={t('tabletop.placedTokens.remove')}
                        title={t('tabletop.placedTokens.remove')}
                        onClick={() => onRemoveToken(token.id)}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </details>

      {/* GM-only テーブルマップ ライブラリ. Lets a GM save the current
          table as a named "template" (initial layout, PC tokens
          stripped, viewport centre stashed as the PC spawn point) or
          "save" (full snapshot), and load / delete saved entries. */}
      {isHost && (
        <details className="tabletop-toolbar-section">
          <summary className="tabletop-toolbar-summary">
            {t('tabletop.library.title')}
          </summary>
          <div className="tabletop-toolbar-section-body">
            <h3 className="tabletop-toolbar-title">
              {t('tabletop.library.saveCurrent')}
            </h3>
            <input
              type="text"
              className="tabletop-toolbar-input"
              placeholder={t('tabletop.library.namePlaceholder')}
              value={libraryName}
              onChange={(e) => setLibraryName(e.target.value)}
              maxLength={48}
            />
            <button
              type="button"
              className="tabletop-toolbar-button"
              onClick={() => void handleSaveAs('template')}
            >
              {t('tabletop.library.saveAsTemplate')}
            </button>
            <button
              type="button"
              className="tabletop-toolbar-button outline"
              onClick={() => void handleSaveAs('save')}
            >
              {t('tabletop.library.saveAsSave')}
            </button>
            <p className="tabletop-toolbar-meta wrap">
              {t('tabletop.library.saveHint')}
            </p>

            <hr className="tabletop-toolbar-divider" />
            <h3 className="tabletop-toolbar-title">
              {t('tabletop.library.templates')}
            </h3>
            {templates.length === 0 ? (
              <p className="tabletop-toolbar-meta">
                {t('tabletop.library.emptyTemplates')}
              </p>
            ) : (
              <ul className="tabletop-toolbar-list">
                {templates.map((entry) => (
                  <li key={entry.id} className="tabletop-toolbar-list-item">
                    <span
                      className="tabletop-toolbar-list-label"
                      title={entry.name}
                    >
                      {entry.name}
                    </span>
                    <button
                      type="button"
                      className="tabletop-toolbar-list-action"
                      onClick={() => void handleLoad(entry.id)}
                    >
                      {t('tabletop.library.load')}
                    </button>
                    <button
                      type="button"
                      className="icon-btn tabletop-toolbar-list-remove"
                      aria-label={t('tabletop.library.delete')}
                      title={t('tabletop.library.delete')}
                      onClick={() => void handleDelete(entry.id, entry.name)}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <hr className="tabletop-toolbar-divider" />
            <h3 className="tabletop-toolbar-title">
              {t('tabletop.library.saves')}
            </h3>
            {saves.length === 0 ? (
              <p className="tabletop-toolbar-meta">
                {t('tabletop.library.emptySaves')}
              </p>
            ) : (
              <ul className="tabletop-toolbar-list">
                {saves.map((entry) => (
                  <li key={entry.id} className="tabletop-toolbar-list-item">
                    <span
                      className="tabletop-toolbar-list-label"
                      title={entry.name}
                    >
                      {entry.name}
                    </span>
                    <button
                      type="button"
                      className="tabletop-toolbar-list-action"
                      onClick={() => void handleLoad(entry.id)}
                    >
                      {t('tabletop.library.load')}
                    </button>
                    <button
                      type="button"
                      className="icon-btn tabletop-toolbar-list-remove"
                      aria-label={t('tabletop.library.delete')}
                      title={t('tabletop.library.delete')}
                      onClick={() => void handleDelete(entry.id, entry.name)}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

      {cropSrc && (
        <CharacterImageCropDialog
          src={cropSrc}
          onCancel={handleCropCancel}
          onConfirm={(cropped) => void handleCropConfirm(cropped)}
        />
      )}
    </aside>
  )
}
