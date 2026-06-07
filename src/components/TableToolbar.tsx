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
import { sceneCount } from '../tabletop/scenes'
import type { MapImageError } from '../tabletop/imageBackground'
import { loadPresetMapManifest } from '../tabletop/presetMaps'
import type { Character } from '../characters/types'
import { prepareNpcTokenImage } from '../characters/image'
import { avatarInitial } from '../players/identity'
import {
  AlbumIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  EditIcon,
  ImageSearchIcon,
  ImageUpIcon,
  Link2Icon,
  PlusIcon,
  TrashIcon,
} from './icons'
import {
  CharacterIcon,
  FogIcon,
  HelpIcon,
  LibraryIcon,
  ScenesIcon,
  TabletopIcon,
  type IconProps,
} from './icons'
import { ColorInput } from './ColorInput'
import { StepperInput } from './StepperInput'
import { ToggleSwitch } from './ToggleSwitch'
import type { ComponentType } from 'react'

/** Right-side toolbar categories. Each maps to an icon button in the
 *  vertical strip plus the body rendered in the side-expanding panel.
 *  Order = display order in the strip. */
type CategoryId = 'mapGrid' | 'fog' | 'tokens' | 'scenes' | 'library'

/** Background-map source tabs. Defined at module level so the array
 *  identity is stable across renders and the icon components are
 *  resolved once. `descKey` points at the explanatory copy shown
 *  below the icon row in the panel header. */
type MapSourceId = 'upload' | 'gallery' | 'url' | 'preset'
interface MapSourceTabDef {
  id: MapSourceId
  Icon: ComponentType<IconProps>
  labelKey: string
  descKey: string
}
const MAP_SOURCE_TABS: ReadonlyArray<MapSourceTabDef> = [
  {
    id: 'upload',
    Icon: ImageUpIcon,
    labelKey: 'tabletop.mapSource.upload',
    descKey: 'tabletop.mapSource.uploadDesc',
  },
  {
    id: 'gallery',
    Icon: ImageSearchIcon,
    labelKey: 'tabletop.mapSource.gallery',
    descKey: 'tabletop.mapSource.galleryDesc',
  },
  {
    id: 'url',
    Icon: Link2Icon,
    labelKey: 'tabletop.mapSource.url',
    descKey: 'tabletop.mapSource.urlDesc',
  },
  {
    id: 'preset',
    Icon: AlbumIcon,
    labelKey: 'tabletop.mapSource.preset',
    descKey: 'tabletop.mapSource.presetDesc',
  },
]
import { CharacterImageCropDialog } from './CharacterImageCropDialog'
import { ImagePickerDialog } from './ImagePickerDialog'
import { MapGalleryDialog } from './MapGalleryDialog'

interface Props {
  grid: Grid
  onChange: (grid: Grid) => void
  map: MapBackground | undefined
  onSetMap: (file: File) => Promise<'ok' | MapImageError>
  /** GM-only: load a remote URL as the background map. Returns the
   *  same structured-error union as `onSetMap`, extended with
   *  `'invalidUrl' | 'fetchFailed' | 'notImage'` for the URL-specific
   *  failure modes. */
  onSetMapFromUrl: (input: string) => Promise<'ok' | MapImageError>
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
  onAddNpcDef: (
    name: string,
    input?: File | string,
  ) => Promise<string | 'unreadable'>
  /** Edit an existing NPC's name / image / note. */
  onUpdateNpcDef: (
    defId: string,
    updates: { name?: string; image?: string; note?: string },
  ) => void
  onRemoveNpcDef: (defId: string) => void
  /** GM-only: reorder a library entry / placed token up (-1) or down
   *  (+1) within its list. */
  onReorderNpcDef: (defId: string, dir: -1 | 1) => void
  onReorderToken: (tokenId: string, dir: -1 | 1) => void
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
  /** Tap a row in the placed-tokens list → select it and centre the
   *  viewport on it. Lets a player quickly find / start moving their
   *  PC without scrolling the canvas first. */
  onFocusToken: (tokenId: string) => void
  /** When true, render the GM-only NPC library section. */
  isHost: boolean
  /** The current viewer's player id, used to highlight their own
   *  tokens in the "マップ上のトークン" list. */
  myPlayerId: string
  /** GM-only: named templates and saves persisted globally in
   *  IndexedDB. Empty when nothing has been saved or storage is
   *  unavailable. */
  tabletopLibrary: ReadonlyArray<SavedTabletop>
  /** GM-only: snapshot the current tabletop under the given name.
   *  `scope` chooses this scene vs the whole table; templates strip PC
   *  tokens + strokes and stash a viewport centre as the PC spawn point;
   *  saves keep everything. */
  onSaveTabletopAs: (
    name: string,
    kind: TabletopLibraryKind,
    scope: 'scene' | 'table',
  ) => Promise<'ok' | 'invalid'>
  /** GM-only: replace the WHOLE table (all scenes) with a saved one. */
  onLoadTabletopFromLibrary: (id: string) => Promise<'ok' | 'missing'>
  /** GM-only: splice a saved entry's scene(s) into the current session
   *  as new scenes (keeps existing scenes). */
  onAddLibraryAsScenes: (id: string) => Promise<'ok' | 'missing'>
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
  /** Open the tabletop tutorial overlay (re-show from the "?" button at
   *  the bottom of the icon strip). */
  onOpenTutorial: () => void
  // --- Scenes (multiple maps per session; GM-only) ---
  /** All scenes (current + inactive), current first. */
  scenes: ReadonlyArray<{
    id: string
    name: string
    ord: number
    current: boolean
  }>
  onAddScene: () => void
  onSwitchScene: (id: string) => void
  onRenameScene: (id: string, name: string) => void
  onDeleteScene: (id: string) => void
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
  onSetMapFromUrl,
  onClearMap,
  characters,
  onPlaceMyCharacter,
  placedCharacterIds,
  npcLibrary,
  onAddNpcDef,
  onUpdateNpcDef,
  onRemoveNpcDef,
  onReorderNpcDef,
  onReorderToken,
  onPlaceNpcFromLibrary,
  placedTokens,
  onRemoveToken,
  onFocusToken,
  isHost,
  myPlayerId,
  tabletopLibrary,
  onSaveTabletopAs,
  onLoadTabletopFromLibrary,
  onAddLibraryAsScenes,
  onDeleteTabletopFromLibrary,
  onLoadPresetMap,
  fog,
  onFogEnabledChange,
  onFogReplace,
  onNotice,
  onOpenTutorial,
  scenes,
  onAddScene,
  onSwitchScene,
  onRenameScene,
  onDeleteScene,
}: Props) {
  const { t } = useI18n()
  const confirm = useConfirm()
  const mapInputRef = useRef<HTMLInputElement | null>(null)
  // Inline scene rename: which scene id is being edited, and its draft.
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneNameDraft, setSceneNameDraft] = useState('')
  // Set by Escape so the blur it triggers cancels instead of committing.
  const sceneRenameCancelRef = useRef(false)
  // NPC add flow state: just the name. The portrait is attached after
  // the NPC has been added through the per-row "edit" button so a GM
  // can register a stack of NPCs first and worry about art later.
  //   `editingNpcId`   - which library entry's inline editor card is
  //                      currently open (name / image / delete).
  //   `imageTargetNpcId` - which entry the active file-picker /
  //                      crop-dialog flow is acting on; usually
  //                      matches `editingNpcId` but is tracked
  //                      separately so the editor can close without
  //                      cancelling an in-flight crop.
  //   `cropSrc`        - the picked image while the crop dialog is up.
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null)
  // "追加・準備" section collapse state — starts expanded on first open.
  const [setupOpen, setSetupOpen] = useState(true)
  // An NPC created via the "+" button starts nameless; its id is parked
  // here until a non-blank name is committed (see the editor's
  // `onChangeName`). If the editor closes while the id is still parked,
  // the add was abandoned before naming and the entry is dropped —
  // otherwise it would linger as a nameless ghost in the library and be
  // broadcast to every client.
  const provisionalNpcIdRef = useRef<string | null>(null)
  // The entry the editor is showing as a brand-new add (via "+"), so its
  // title reads "New NPC". Unlike the provisional ref above this persists
  // until the editor closes, so the title stays put after the first name
  // commit (the ref clears on commit, this does not).
  const [newNpcId, setNewNpcId] = useState<string | null>(null)
  const [imageTargetNpcId, setImageTargetNpcId] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  // The "image picker" dialog is the new top-level entrypoint for
  // changing an NPC portrait: tabs offer Upload / Character /
  // Monster sources. The picker stays mounted (so the manifest
  // cache survives close → reopen); `imagePickerNpcId` gates the
  // `open` flag and remembers which NPC the result should attach
  // to. When the user picks an UPLOADED file the legacy crop
  // dialog still gets driven via `setCropSrc`; library picks are
  // already cropped, so they bypass it.
  const [imagePickerNpcId, setImagePickerNpcId] = useState<string | null>(null)
  // Library save flow state: a single name input feeds both save
  // flavours; the buttons differ only in `kind`.
  const [libraryName, setLibraryName] = useState('')
  /** Save scope: only the current scene, or every scene on the table. */
  const [saveScope, setSaveScope] = useState<'scene' | 'table'>('scene')
  const [presets, setPresets] = useState<ReadonlyArray<PresetMap>>([])
  const [selectedPreset, setSelectedPreset] = useState('')
  const [loadingPreset, setLoadingPreset] = useState(false)
  // URL-load flow: input draft + an in-flight flag so the button can
  // disable itself during the fetch. Cleared on success so the next
  // load starts from an empty field.
  const [mapUrlDraft, setMapUrlDraft] = useState('')
  const [loadingMapUrl, setLoadingMapUrl] = useState(false)
  // The gallery dialog stays mounted (so its manifest cache survives
  // close→open cycles) and gates its render on this flag.
  const [galleryOpen, setGalleryOpen] = useState(false)
  // Background-map source selector. Four mutually-exclusive panels
  // share a single tab row instead of stacking all the controls
  // (one Section per source) on top of each other — playtesters
  // found the stacked layout overwhelming once URL + gallery were
  // added on top of upload + preset.
  const [mapSourceTab, setMapSourceTab] = useState<MapSourceId>('upload')
  const templates = tabletopLibrary.filter((e) => e.kind === 'template')
  const saves = tabletopLibrary.filter((e) => e.kind === 'save')

  // The right-side toolbar is now an icon strip + a side-expanding
  // detail panel; this state names which category (if any) is the
  // currently-open panel. Only one category can be open at once —
  // clicking another icon swaps the panel rather than stacking
  // them. `null` means the icon strip is the only thing rendered,
  // which is the default so the canvas is uncluttered on open.
  const [expandedCategory, setExpandedCategory] = useState<CategoryId | null>(
    null,
  )
  /** Outermost element of the toolbar — both the icon strip AND the
   *  expanded side panel live inside this aside. Used by the outside-
   *  click handler to detect "did the press land inside the toolbar?". */
  const wrapperRef = useRef<HTMLElement | null>(null)
  // Close the expanded category on any pointerdown that lands OUTSIDE
  // the toolbar (canvas, other overlays, the bottom dock, ...). Listening
  // at the document level — rather than wiring a click handler on every
  // sibling — keeps the rule in one place and matches how mobile sheets
  // typically dismiss. `pointerdown` (not `click`) fires earlier in the
  // gesture so a Konva drag-start outside the panel still collapses it
  // before the drag visibly engages.
  useEffect(() => {
    if (!expandedCategory) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (target instanceof Node && wrapperRef.current?.contains(target)) {
        return
      }
      setExpandedCategory(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [expandedCategory])

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
    const result = await onSaveTabletopAs(libraryName, kind, saveScope)
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

  const handleAddAsScenes = async (id: string) => {
    const result = await onAddLibraryAsScenes(id)
    if (result === 'ok') {
      onNotice?.(t('tabletop.library.addedAsScenes'), 'success')
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

  const handleLoadMapUrl = async () => {
    const url = mapUrlDraft.trim()
    if (!url) {
      onNotice?.(t('tabletop.mapUrl.invalidUrl'), 'error')
      return
    }
    setLoadingMapUrl(true)
    try {
      const result = await onSetMapFromUrl(url)
      // Distinct messages for the URL-specific failures so the GM knows
      // whether to fix the URL (`invalidUrl`), retry / check CORS
      // (`fetchFailed`), pick a different link (`notImage`), or shrink
      // the image (`tooLarge`).
      switch (result) {
        case 'ok':
          onNotice?.(t('tabletop.map.set'), 'success')
          setMapUrlDraft('')
          break
        case 'invalidUrl':
          onNotice?.(t('tabletop.mapUrl.invalidUrl'), 'error')
          break
        case 'fetchFailed':
          onNotice?.(t('tabletop.mapUrl.fetchFailed'), 'error')
          break
        case 'notImage':
          onNotice?.(t('tabletop.mapUrl.notImage'), 'error')
          break
        case 'tooLarge':
          onNotice?.(t('tabletop.map.tooLarge'), 'error')
          break
        default:
          onNotice?.(t('tabletop.map.unreadable'), 'error')
      }
    } finally {
      setLoadingMapUrl(false)
    }
  }

  const handleAddNpc = async () => {
    // Create a blank library entry and open its editor focused on the
    // name field. The inline name input is gone — the add button is an
    // icon and naming happens in the Edit NPC dialog.
    const result = await onAddNpcDef('')
    if (result === 'unreadable') {
      onNotice?.(t('tabletop.npcLibrary.unreadable'), 'error')
      return
    }
    setEditingNpcId(result)
    // Park the id: this entry stays provisional until a name is committed.
    provisionalNpcIdRef.current = result
    setNewNpcId(result)
  }

  // Close the NPC editor, discarding a still-nameless entry created via
  // "+". `provisionalNpcIdRef` is cleared the instant a name is committed
  // (see `onChangeName` below), so a non-null value here means the add
  // was abandoned before naming.
  const closeNpcEditor = () => {
    const provisional = provisionalNpcIdRef.current
    if (provisional) onRemoveNpcDef(provisional)
    provisionalNpcIdRef.current = null
    setNewNpcId(null)
    setEditingNpcId(null)
  }

  /** Result handler for the unified `ImagePickerDialog`. Uploaded
   *  files still go through the crop dialog (so the GM frames the
   *  portrait), while library picks skip the crop because the
   *  chara-image-organizer images are already centred at the
   *  intended subject. */
  const handleNpcImagePicked = async (
    file: File,
    opts: { fromLibrary: boolean },
  ) => {
    const defId = imagePickerNpcId
    if (!defId) return
    setImagePickerNpcId(null)
    if (opts.fromLibrary) {
      const processed = await prepareNpcTokenImage(file)
      if (!processed) {
        onNotice?.(t('tabletop.npcLibrary.unreadable'), 'error')
        return
      }
      onUpdateNpcDef(defId, { image: processed })
      onNotice?.(t('tabletop.npcLibrary.imageUpdated'), 'success')
      return
    }
    // Uploaded file — drive the crop dialog as before.
    setImageTargetNpcId(defId)
    const reader = new FileReader()
    reader.onload = () => setCropSrc(String(reader.result))
    reader.onerror = () => {
      setImageTargetNpcId(null)
      onNotice?.(t('tabletop.npcLibrary.unreadable'), 'error')
    }
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async (croppedDataUrl: string) => {
    const defId = imageTargetNpcId
    setCropSrc(null)
    setImageTargetNpcId(null)
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
    setImageTargetNpcId(null)
  }

  const handleSetNpcImage = (defId: string) => {
    setImagePickerNpcId(defId)
  }

  const handleNpcDelete = async (def: NpcDef) => {
    const ok = await confirm({
      message: t('tabletop.npcLibrary.confirmDelete', { name: def.name }),
      destructive: true,
    })
    if (!ok) return
    onRemoveNpcDef(def.id)
    if (provisionalNpcIdRef.current === def.id) {
      provisionalNpcIdRef.current = null
    }
    if (editingNpcId === def.id) setEditingNpcId(null)
  }

  // Available categories: GM gets everything; non-GM only sees
  // tokens (their own PC list). Re-derived each render so a mid-
  // session role change immediately re-shows / hides icons.
  type CategoryDef = {
    id: CategoryId
    Icon: ComponentType<IconProps>
    labelKey: string
  }
  const categories: CategoryDef[] = []
  if (isHost) {
    categories.push({ id: 'mapGrid', Icon: TabletopIcon, labelKey: 'tabletop.panel.mapGrid' })
    categories.push({ id: 'fog', Icon: FogIcon, labelKey: 'tabletop.fog.title' })
  }
  categories.push({ id: 'tokens', Icon: CharacterIcon, labelKey: 'tabletop.panel.tokens' })
  if (isHost) {
    categories.push({ id: 'scenes', Icon: ScenesIcon, labelKey: 'tabletop.scenes.title' })
    categories.push({ id: 'library', Icon: LibraryIcon, labelKey: 'tabletop.library.title' })
  }
  // If the user just lost the GM bit while a host-only category was
  // open, auto-collapse so the panel never references a category that
  // is no longer in the icon strip. "Adjust state during render" is
  // the React-recommended escape hatch for this kind of derived
  // state.
  if (expandedCategory && !categories.some((c) => c.id === expandedCategory)) {
    setExpandedCategory(null)
  }
  const expandedLabelKey = categories.find((c) => c.id === expandedCategory)?.labelKey

  return (
    <aside
      ref={wrapperRef}
      className="tabletop-toolbar-wrapper"
      aria-label={t('tabletop.panel.title')}
    >
      {expandedCategory && expandedLabelKey && (
        <div
          className="tabletop-toolbar-panel"
          role="region"
          aria-labelledby="tabletop-panel-title"
        >
          <header className="tabletop-toolbar-panel-header">
            <h2
              id="tabletop-panel-title"
              className="tabletop-toolbar-panel-title"
            >
              {t(expandedLabelKey)}
            </h2>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('tabletop.panel.close')}
              onClick={() => setExpandedCategory(null)}
            >
              <CloseIcon size={16} />
            </button>
          </header>
          <div className="tabletop-toolbar-panel-body">
      {expandedCategory === 'mapGrid' && isHost && (
        <>
          <h3 className="tabletop-toolbar-title">{t('tabletop.grid.title')}</h3>
          <label className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.kind')}</span>
            <select
              value={grid.kind}
              onChange={(e) => set('kind', e.target.value as GridKind)}
            >
              <option value="none">{t('tabletop.grid.kindNone')}</option>
              <option value="square">{t('tabletop.grid.kindSquare')}</option>
              <option value="hex">{t('tabletop.grid.kindHex')}</option>
            </select>
          </label>
          <div className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.cellSize')}</span>
            <StepperInput
              value={grid.cellSize}
              onChange={(n) => set('cellSize', n)}
              min={MIN_CELL_SIZE}
              max={MAX_CELL_SIZE}
              label={t('tabletop.grid.cellSize')}
            />
          </div>
          <div className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.originX')}</span>
            <StepperInput
              value={grid.originX}
              onChange={(n) => set('originX', n)}
              label={t('tabletop.grid.originX')}
            />
          </div>
          <div className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.originY')}</span>
            <StepperInput
              value={grid.originY}
              onChange={(n) => set('originY', n)}
              label={t('tabletop.grid.originY')}
            />
          </div>
          <div className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.strokeColor')}</span>
            <ColorInput
              value={grid.strokeColor}
              onChange={(v) => set('strokeColor', v)}
              label={t('tabletop.grid.strokeColor')}
            />
          </div>
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
          <div className="tabletop-toolbar-row">
            <span>{t('tabletop.grid.snap')}</span>
            <ToggleSwitch
              checked={grid.snap}
              onChange={(v) => set('snap', v)}
              label={t('tabletop.grid.snap')}
            />
          </div>

          <hr className="tabletop-toolbar-divider" />
          <h3 className="tabletop-toolbar-title">{t('tabletop.map.title')}</h3>
          {/* The file input lives at the top level (not inside the
              upload tab panel) so its `mapInputRef` is mounted
              whenever the section is visible — the "replace" button
              shown next to the current map's info needs to trigger
              it regardless of which source tab is active. */}
          <input
            ref={mapInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleMapFile}
          />
          {map && (
            // Current map: name + a compact icon-only "clear" button.
            // Replacing the image is done from the Upload tab below, so
            // there is no separate "replace" button here (it duplicated
            // the upload action and pushed the clear button too wide).
            <div className="tabletop-map-current-actions">
              <p className="tabletop-toolbar-meta" title={map.name}>
                {map.name} ({map.width}×{map.height})
              </p>
              <button
                type="button"
                className="icon-btn tabletop-map-clear-btn"
                onClick={onClearMap}
                aria-label={t('tabletop.map.clear')}
                title={t('tabletop.map.clear')}
              >
                <TrashIcon />
              </button>
            </div>
          )}
          {/* Tab row: four mutually-exclusive sources for the
              background map. Icons-only so the four-tab strip
              comfortably fits a narrow phone-width panel; the
              selected tab's name + description renders just below
              so the affordance is still discoverable. Switching
              tabs swaps the panel without touching in-flight
              drafts / preset selection, so a GM can shop between
              sources without losing intermediate input. */}
          <div
            className="tabletop-map-source-tabs"
            role="tablist"
            aria-label={t('tabletop.mapSource.label')}
          >
            {MAP_SOURCE_TABS.map(({ id, Icon, labelKey }) => {
              const active = mapSourceTab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={t(labelKey)}
                  title={t(labelKey)}
                  className={`tabletop-map-source-tab${active ? ' active' : ''}`}
                  onClick={() => setMapSourceTab(id)}
                >
                  <Icon size={18} />
                </button>
              )
            })}
          </div>
          <div className="tabletop-map-source-header">
            <h4 className="tabletop-map-source-name">
              {t(
                MAP_SOURCE_TABS.find((tab) => tab.id === mapSourceTab)!
                  .labelKey,
              )}
            </h4>
            <p className="tabletop-map-source-desc">
              {t(
                MAP_SOURCE_TABS.find((tab) => tab.id === mapSourceTab)!
                  .descKey,
              )}
            </p>
          </div>
          {mapSourceTab === 'upload' && (
            <div className="tabletop-map-source-panel">
              <button
                type="button"
                className="tabletop-toolbar-button"
                onClick={() => mapInputRef.current?.click()}
              >
                {map ? t('tabletop.map.replace') : t('tabletop.map.choose')}
              </button>
            </div>
          )}
          {mapSourceTab === 'gallery' && (
            <div className="tabletop-map-source-panel">
              <button
                type="button"
                className="tabletop-toolbar-button"
                onClick={() => setGalleryOpen(true)}
              >
                {t('tabletop.gallery.open')}
              </button>
            </div>
          )}
          {mapSourceTab === 'url' && (
            <div className="tabletop-map-source-panel">
              <input
                type="url"
                className="tabletop-toolbar-input"
                placeholder={t('tabletop.mapUrl.placeholder')}
                value={mapUrlDraft}
                onChange={(e) => setMapUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter inside a single-line input would otherwise
                  // submit the enclosing form (there isn't one, but
                  // the gesture is still a natural "go" — mirror it
                  // explicitly).
                  if (e.key === 'Enter' && !loadingMapUrl) {
                    e.preventDefault()
                    void handleLoadMapUrl()
                  }
                }}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="tabletop-toolbar-button"
                onClick={() => void handleLoadMapUrl()}
                disabled={loadingMapUrl || !mapUrlDraft.trim()}
              >
                {t('tabletop.mapUrl.load')}
              </button>
            </div>
          )}
          {mapSourceTab === 'preset' && (
            <div className="tabletop-map-source-panel">
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
          )}
        </>
      )}
      {expandedCategory === 'fog' && isHost && (
        <>
            {grid.kind === 'none' ? (
              // Fog of war is cell-based, so without a grid there is
              // nothing meaningful to toggle. Surface the requirement
              // up-front and hide every control so a stale state
              // (e.g. fog left enabled from before the grid was
              // switched off) cannot be mistaken for "still working".
              <p className="tabletop-toolbar-meta wrap">
                {t('tabletop.fog.needGrid')}
              </p>
            ) : (
              <>
                <div className="tabletop-toolbar-row">
                  <span>{t('tabletop.fog.title')}</span>
                  <ToggleSwitch
                    checked={fog.enabled}
                    onChange={onFogEnabledChange}
                    label={
                      fog.enabled
                        ? t('tabletop.fog.disable')
                        : t('tabletop.fog.enable')
                    }
                  />
                </div>
                {/* Pointer at the per-cell brushes that live in the
                 *  LEFT tool palette. Users discovering the fog panel
                 *  for the first time don't always realise the
                 *  "Reveal / Apply fog" tools over there are the way
                 *  to tweak individual cells — this hint closes that
                 *  gap. */}
                <p className="tabletop-toolbar-meta wrap">
                  {t('tabletop.fog.brushHint')}
                </p>
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
              </>
            )}
        </>
      )}
      {expandedCategory === 'tokens' && (
        <>
          {/* ── Section 1: マップ上のトークン ─────────────────── */}
          <h3 className="tabletop-toolbar-title">
            {t('tabletop.onMap.title')}
          </h3>
          {placedTokens.length === 0 ? (
            <p className="tabletop-toolbar-meta">
              {t('tabletop.placedTokens.empty')}
            </p>
          ) : (
            <ul className="tabletop-toolbar-list tabletop-toolbar-list-placed">
              {placedTokens.map(({ token, portrait, label }, index) => {
                const displayName = label?.trim() || t('tabletop.placedTokens.unnamed')
                const kindLabel =
                  token.kind === 'pc'
                    ? t('tabletop.placedTokens.kindPc')
                    : t('tabletop.placedTokens.kindGm')
                // Own token = PC owned by this viewer. Visually emphasised
                // so a player can instantly spot their character(s).
                const isOwn =
                  token.kind === 'pc' && token.ownerPlayerId === myPlayerId
                return (
                  <li
                    key={token.id}
                    className={`tabletop-toolbar-list-item${isOwn ? ' tabletop-toolbar-list-item--own' : ''}`}
                  >
                    {isHost && (
                      <ReorderControls
                        index={index}
                        count={placedTokens.length}
                        onMove={(dir) => onReorderToken(token.id, dir)}
                      />
                    )}
                    <button
                      type="button"
                      className="tabletop-toolbar-list-row"
                      title={`${displayName} · ${kindLabel}`}
                      onClick={() => {
                        setExpandedCategory(null)
                        onFocusToken(token.id)
                      }}
                    >
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
                      <span className="tabletop-toolbar-list-label">
                        {displayName}
                      </span>
                      <span className={`tabletop-toolbar-list-tag${isOwn ? ' own' : ''}`}>
                        {kindLabel}
                      </span>
                    </button>
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

          {/* ── Section 2: 追加・準備（折り畳み可）─────────────── */}
          <hr className="tabletop-toolbar-divider" />
          <button
            type="button"
            className="tabletop-toolbar-section-btn"
            aria-expanded={setupOpen}
            onClick={() => setSetupOpen((v) => !v)}
          >
            <span className={`tabletop-toolbar-section-chevron${setupOpen ? ' open' : ''}`}>
              <ChevronDownIcon size={14} />
            </span>
            {t('tabletop.setup.title')}
          </button>

          {setupOpen && (
            <>
              {/* PC placement */}
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
                            onPlaceMyCharacter(char.id, char.name, char.image || '')
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

              {/* NPC Library (GM only) */}
              {isHost && (
                <>
                  <hr className="tabletop-toolbar-divider" />
                  {/* Heading row: title on the left, an "Add" button on the
                      right whose right edge lines up with the "Place"
                      buttons of the entries below. */}
                  <div className="tabletop-toolbar-heading-row">
                    <h3 className="tabletop-toolbar-title">
                      {t('tabletop.npcLibrary.title')}
                    </h3>
                    <button
                      type="button"
                      className="tabletop-toolbar-list-action"
                      onClick={() => void handleAddNpc()}
                      aria-label={t('tabletop.npcLibrary.add')}
                      title={t('tabletop.npcLibrary.add')}
                    >
                      {t('tabletop.npcLibrary.addShort')}
                    </button>
                  </div>
                  {npcLibrary.length > 0 && (
                    <ul className="tabletop-toolbar-list">
                      {npcLibrary.map((def, index) => {
                        const isEditing = editingNpcId === def.id
                        return (
                          <li
                            key={def.id}
                            className="tabletop-toolbar-list-item"
                          >
                            <ReorderControls
                              index={index}
                              count={npcLibrary.length}
                              onMove={(dir) => onReorderNpcDef(def.id, dir)}
                            />
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
                              className={`icon-btn tabletop-toolbar-list-icon-btn${isEditing ? ' active' : ''}`}
                              aria-label={t('tabletop.npcLibrary.edit')}
                              aria-expanded={isEditing}
                              title={t('tabletop.npcLibrary.edit')}
                              onClick={() =>
                                setEditingNpcId((cur) =>
                                  cur === def.id ? null : def.id,
                                )
                              }
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
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {expandedCategory === 'scenes' && isHost && (
        <>
          <p className="tabletop-toolbar-hint">{t('tabletop.scenes.hint')}</p>
          <ul className="tabletop-scene-list">
            {scenes.map((sc) => {
              const display = sc.name.trim() || t('tabletop.scenes.defaultName', { n: sc.ord })
              const editing = editingSceneId === sc.id
              const commit = () => {
                // Escape sets the cancel flag before blurring, so the
                // blur this fires must not rename — "cancel", not "save".
                if (sceneRenameCancelRef.current) {
                  sceneRenameCancelRef.current = false
                  setEditingSceneId(null)
                  return
                }
                onRenameScene(sc.id, sceneNameDraft)
                setEditingSceneId(null)
              }
              return (
                <li
                  key={sc.id}
                  className={`tabletop-scene-row${sc.current ? ' current' : ''}`}
                >
                  {editing ? (
                    <input
                      type="text"
                      className="tabletop-scene-name-input"
                      value={sceneNameDraft}
                      maxLength={40}
                      autoFocus
                      aria-label={t('tabletop.scenes.rename')}
                      onChange={(e) => setSceneNameDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        else if (e.key === 'Escape') {
                          sceneRenameCancelRef.current = true
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="tabletop-scene-switch"
                      aria-current={sc.current}
                      disabled={sc.current}
                      title={t('tabletop.scenes.switch')}
                      onClick={() => onSwitchScene(sc.id)}
                    >
                      {sc.current ? `▶ ${display}` : display}
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('tabletop.scenes.rename')}
                    title={t('tabletop.scenes.rename')}
                    onClick={() => {
                      setSceneNameDraft(sc.name)
                      setEditingSceneId(sc.id)
                    }}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('tabletop.scenes.delete')}
                    title={t('tabletop.scenes.delete')}
                    disabled={scenes.length <= 1}
                    onClick={async () => {
                      const ok = await confirm({
                        message: t('tabletop.scenes.deleteConfirm', { name: display }),
                        destructive: true,
                      })
                      if (ok) onDeleteScene(sc.id)
                    }}
                  >
                    <TrashIcon />
                  </button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className="tabletop-toolbar-button"
            onClick={() => onAddScene()}
          >
            <PlusIcon />
            <span>{t('tabletop.scenes.add')}</span>
          </button>
        </>
      )}
      {expandedCategory === 'library' && isHost && (
        <>
            <p className="tabletop-toolbar-meta wrap tabletop-library-scope-note">
              {t('tabletop.library.scopeNote')}
            </p>
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
            {/* Scope: this scene vs every scene on the table. */}
            <div
              className="tabletop-toolbar-row"
              role="radiogroup"
              aria-label={t('tabletop.library.scope')}
            >
              <span>{t('tabletop.library.scope')}</span>
              <div className="tabletop-token-size-group">
                {(['scene', 'table'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={saveScope === s}
                    tabIndex={saveScope === s ? 0 : -1}
                    className={`tabletop-token-size-btn${saveScope === s ? ' active' : ''}`}
                    onClick={() => setSaveScope(s)}
                  >
                    {t(
                      s === 'scene'
                        ? 'tabletop.library.scopeScene'
                        : 'tabletop.library.scopeTable',
                    )}
                  </button>
                ))}
              </div>
            </div>
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
            <p className="tabletop-toolbar-meta">
              {t('tabletop.library.templateMeaning')}
            </p>
            <LibraryList
              entries={templates}
              emptyLabel={t('tabletop.library.emptyTemplates')}
              onReplace={(id) => void handleLoad(id)}
              onAddScenes={(id) => void handleAddAsScenes(id)}
              onDelete={(id, name) => void handleDelete(id, name)}
            />

            <hr className="tabletop-toolbar-divider" />
            <h3 className="tabletop-toolbar-title">
              {t('tabletop.library.saves')}
            </h3>
            <p className="tabletop-toolbar-meta">
              {t('tabletop.library.snapshotMeaning')}
            </p>
            <LibraryList
              entries={saves}
              emptyLabel={t('tabletop.library.emptySaves')}
              onReplace={(id) => void handleLoad(id)}
              onAddScenes={(id) => void handleAddAsScenes(id)}
              onDelete={(id, name) => void handleDelete(id, name)}
            />
        </>
      )}
          </div>
        </div>
      )}
      <nav
        className="tabletop-toolbar-icons"
        aria-label={t('tabletop.panel.nav')}
      >
        {categories.map(({ id, Icon, labelKey }) => {
          const active = expandedCategory === id
          return (
            <button
              key={id}
              type="button"
              className={`tabletop-toolbar-icon-btn${active ? ' active' : ''}`}
              // The button is a "disclosure" — it shows / hides the
              // side panel — so `aria-expanded` describes its state
              // correctly. `aria-pressed` would be redundant and
              // some screen readers announce both, doubling the
              // verbosity.
              aria-expanded={active}
              title={t(labelKey)}
              onClick={() =>
                setExpandedCategory((cur) => (cur === id ? null : id))
              }
            >
              <Icon size={20} />
              <span className="tabletop-toolbar-icon-label">{t(labelKey)}</span>
            </button>
          )
        })}
        {/* Help button sits beneath the category icons with a small
         *  visual gap (see `.tabletop-toolbar-help` in App.css) so it
         *  reads as "supplementary" rather than another category. */}
        <button
          type="button"
          className="tabletop-toolbar-icon-btn tabletop-toolbar-help"
          title={t('tabletop.help')}
          onClick={() => {
            // Collapse whichever category panel is open so the
            // tutorial overlay isn't fighting the side panel for
            // attention — the tutorial wants the whole canvas as
            // its backdrop.
            setExpandedCategory(null)
            onOpenTutorial()
          }}
        >
          <HelpIcon size={20} />
          <span className="tabletop-toolbar-icon-label">{t('tabletop.help')}</span>
        </button>
      </nav>
      {cropSrc && (
        <CharacterImageCropDialog
          src={cropSrc}
          onCancel={handleCropCancel}
          onConfirm={(cropped) => void handleCropConfirm(cropped)}
        />
      )}
      <MapGalleryDialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onPick={onSetMapFromUrl}
        onNotice={onNotice}
      />
      <ImagePickerDialog
        open={imagePickerNpcId !== null}
        onClose={() => setImagePickerNpcId(null)}
        // NPC library can hold either NPCs (characters) or monsters,
        // so let the GM browse both source libraries — the upload
        // tab covers anything that's not in either.
        mode="both"
        onPick={handleNpcImagePicked}
      />
      {/* NPC edit popup. Rendered outside the scrolling library list so
          it is not clipped by the list / panel overflow — shown as a
          centred popup over the table, mirroring the character-info
          modal opened from a PC token. */}
      {editingNpcId &&
        (() => {
          const def = npcLibrary.find((d) => d.id === editingNpcId)
          if (!def) return null
          return (
            <div className="npc-edit-layer" role="presentation">
              <div
                className="char-info-backdrop"
                onClick={closeNpcEditor}
                aria-hidden="true"
              />
              <div
                className="npc-edit-popup"
                onClick={(e) => e.stopPropagation()}
              >
                <NpcInlineEditor
                  key={def.id}
                  def={def}
                  isNew={newNpcId === def.id}
                  onChangeName={(name) => {
                    // A committed name promotes this entry out of the
                    // provisional state, so it survives the editor close.
                    if (provisionalNpcIdRef.current === def.id) {
                      provisionalNpcIdRef.current = null
                    }
                    onUpdateNpcDef(def.id, { name })
                  }}
                  onChangeNote={(note) => onUpdateNpcDef(def.id, { note })}
                  onChangeImage={() => handleSetNpcImage(def.id)}
                  onRemove={() => void handleNpcDelete(def)}
                  onClose={closeNpcEditor}
                />
              </div>
            </div>
          )
        })()}
    </aside>
  )
}

/**
 * Up / down reorder buttons for a list row (NPC library or placed
 * tokens). Disabled at the list's ends. Compact icon buttons so adding
 * them does not balloon the row height.
 */
function ReorderControls({
  index,
  count,
  onMove,
}: {
  index: number
  count: number
  onMove: (dir: -1 | 1) => void
}) {
  const { t } = useI18n()
  return (
    <span className="tabletop-reorder">
      <button
        type="button"
        className="icon-btn tabletop-reorder-btn"
        disabled={index === 0}
        aria-label={t('tabletop.reorder.up')}
        title={t('tabletop.reorder.up')}
        onClick={() => onMove(-1)}
      >
        <ChevronUpIcon size={14} />
      </button>
      <button
        type="button"
        className="icon-btn tabletop-reorder-btn"
        disabled={index === count - 1}
        aria-label={t('tabletop.reorder.down')}
        title={t('tabletop.reorder.down')}
        onClick={() => onMove(1)}
      >
        <ChevronDownIcon size={14} />
      </button>
    </span>
  )
}

interface NpcInlineEditorProps {
  def: NpcDef
  /** True when the entry was just created via "+", so the card titles
   *  itself "New NPC" instead of "Edit NPC". */
  isNew: boolean
  /** Commit a new name for the entry. Called on blur / Enter so a
   *  typing burst is a single network update. */
  onChangeName: (name: string) => void
  /** Commit a new note (free text). Called on blur. */
  onChangeNote: (note: string) => void
  /** Open the file picker for this NPC's portrait. The crop flow then
   *  runs through the parent's `handleCropConfirm`. */
  onChangeImage: () => void
  /** Remove the entry. The caller surfaces the confirm dialog. */
  onRemove: () => void
  /** Collapse the editor (e.g. on cancel). */
  onClose: () => void
}

/**
 * Inline editor card shown beneath an NPC library row when the user
 * clicks its edit icon. Mirrors the canvas-side `TokenPopover`
 * shape — name input, change-image button, remove — so the
 * NPC-library and on-canvas editing flows feel like the same UI. The
 * name is committed on blur / Enter (matching the popover) so a
 * typing burst stays one network update.
 */
function NpcInlineEditor({
  def,
  isNew,
  onChangeName,
  onChangeNote,
  onChangeImage,
  onRemove,
  onClose,
}: NpcInlineEditorProps) {
  const { t } = useI18n()
  const [nameDraft, setNameDraft] = useState(def.name)
  const [noteDraft, setNoteDraft] = useState(def.note ?? '')
  const nameRef = useRef<HTMLInputElement>(null)
  // Focus (and select) the name on open so a freshly added blank NPC —
  // and any edit — is immediately ready for typing.
  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])
  const commitName = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setNameDraft(def.name)
      return
    }
    if (trimmed !== def.name) onChangeName(trimmed)
  }
  const commitNote = () => {
    if (noteDraft === (def.note ?? '')) return
    onChangeNote(noteDraft)
  }
  return (
    <div className="tabletop-toolbar-editor">
      <header className="tabletop-toolbar-editor-header">
        <span className="tabletop-toolbar-editor-title">
          {t(
            isNew
              ? 'tabletop.npcLibrary.newTitle'
              : 'tabletop.npcLibrary.editTitle',
          )}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('tabletop.tokenEdit.close')}
          onClick={onClose}
        >
          <CloseIcon size={14} />
        </button>
      </header>
      <label className="tabletop-toolbar-editor-field">
        <span>{t('tabletop.npcLibrary.nameLabel')}</span>
        <input
          ref={nameRef}
          type="text"
          value={nameDraft}
          maxLength={32}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitName()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      </label>
      <label className="tabletop-toolbar-editor-field">
        <span>{t('tabletop.tokenEdit.note')}</span>
        <textarea
          className="tabletop-toolbar-editor-note"
          value={noteDraft}
          maxLength={500}
          rows={3}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={commitNote}
        />
      </label>
      <button
        type="button"
        className="tabletop-toolbar-button outline"
        onClick={onChangeImage}
      >
        {t('tabletop.npcLibrary.changeImage')}
      </button>
      <button
        type="button"
        className="tabletop-toolbar-button outline danger"
        onClick={onRemove}
      >
        <TrashIcon />
        <span>{t('tabletop.npcLibrary.remove')}</span>
      </button>
    </div>
  )
}

/**
 * One library section's entry list (shared by Templates and Snapshots).
 * Each row shows the name, a scene-count badge for multi-scene entries,
 * a delete button, and the two distinct load actions: "Replace table"
 * (swap the whole table) and "Add as scene" (splice into the current
 * session's scenes). Factored out so the two sections do not duplicate
 * the markup.
 */
function LibraryList({
  entries,
  emptyLabel,
  onReplace,
  onAddScenes,
  onDelete,
}: {
  entries: ReadonlyArray<SavedTabletop>
  emptyLabel: string
  onReplace: (id: string) => void
  onAddScenes: (id: string) => void
  onDelete: (id: string, name: string) => void
}) {
  const { t } = useI18n()
  if (entries.length === 0) {
    return <p className="tabletop-toolbar-meta">{emptyLabel}</p>
  }
  return (
    <ul className="tabletop-toolbar-list">
      {entries.map((entry) => {
        const n = sceneCount(entry.state)
        return (
          <li
            key={entry.id}
            className="tabletop-toolbar-list-item tabletop-library-entry"
          >
            <div className="tabletop-library-entry-head">
              <span className="tabletop-toolbar-list-label" title={entry.name}>
                {entry.name}
              </span>
              {n > 1 && (
                <span className="tabletop-library-scene-count">
                  {t('tabletop.library.sceneCountBadge', { n: String(n) })}
                </span>
              )}
              <button
                type="button"
                className="icon-btn tabletop-toolbar-list-remove"
                aria-label={t('tabletop.library.delete')}
                title={t('tabletop.library.delete')}
                onClick={() => onDelete(entry.id, entry.name)}
              >
                <TrashIcon />
              </button>
            </div>
            <div className="tabletop-library-entry-actions">
              <button
                type="button"
                className="tabletop-toolbar-list-action"
                onClick={() => onReplace(entry.id)}
              >
                {t('tabletop.library.loadReplace')}
              </button>
              <button
                type="button"
                className="tabletop-toolbar-list-action outline"
                onClick={() => onAddScenes(entry.id)}
              >
                {t('tabletop.library.loadAsScenes')}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
