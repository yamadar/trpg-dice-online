import { useRef } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  type Grid,
  type GridKind,
  type MapBackground,
} from '../tabletop/types'
import type { MapImageError } from '../tabletop/imageBackground'

interface Props {
  grid: Grid
  onChange: (grid: Grid) => void
  map: MapBackground | undefined
  onSetMap: (file: File) => Promise<'ok' | MapImageError>
  onClearMap: () => void
  /** Surface a flash message (e.g. "image too large"). Optional — the
   *  Toolbar still works without it, just without notice feedback. */
  onNotice?: (text: string, kind: 'success' | 'error') => void
}

/**
 * GM-only floating toolbar: grid configuration on top, map controls
 * below. Lives in a corner of the tabletop so the Stage stays the
 * focus. Every field commits on change — there is no separate "apply"
 * step — so the preview always matches what the GM sees.
 */
export function TableToolbar({
  grid,
  onChange,
  map,
  onSetMap,
  onClearMap,
  onNotice,
}: Props) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const set = <K extends keyof Grid>(key: K, value: Grid[K]) =>
    onChange({ ...grid, [key]: value })

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input so picking the same file twice (after a failure)
    // still fires `change` the second time.
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

  return (
    <aside className="tabletop-toolbar" aria-label={t('tabletop.grid.title')}>
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
              const clamped = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, n))
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
      {/* The file input is hidden — a real `button` triggers it so the
          chrome matches the rest of the toolbar instead of the OS's
          native file-picker styling. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <button
        type="button"
        className="tabletop-toolbar-button"
        onClick={() => fileInputRef.current?.click()}
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
    </aside>
  )
}
