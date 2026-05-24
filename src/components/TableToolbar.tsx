import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  type Grid,
  type GridKind,
  type MapBackground,
  type Token,
} from '../tabletop/types'
import type { MapImageError } from '../tabletop/imageBackground'
import type { Player } from '../net/protocol'
import { composeName } from '../players/identity'
import { TrashIcon } from './icons'

interface Props {
  grid: Grid
  onChange: (grid: Grid) => void
  map: MapBackground | undefined
  onSetMap: (file: File) => Promise<'ok' | MapImageError>
  onClearMap: () => void
  tokens: ReadonlyArray<Token>
  players: ReadonlyArray<Player>
  onAddGmToken: (file: File, label?: string) => Promise<'ok' | 'unreadable'>
  onAddPlayerToken: (target: { id: string; characterId: string }) => void
  onRemoveToken: (tokenId: string) => void
  /** Surface a flash message (e.g. "image too large"). Optional — the
   *  Toolbar still works without it, just without notice feedback. */
  onNotice?: (text: string, kind: 'success' | 'error') => void
}

/**
 * GM-only floating toolbar. Two collapsible categories — Map & Grid
 * above, Tokens below — each `<details>` so the open / closed state
 * lives in the DOM (no React state to sync, plus native keyboard +
 * AT support).
 *
 * The whole toolbar is capped at the viewport height and scrolls
 * internally when its content would overflow, so a long list of
 * GM tokens never extends past the bottom of the screen.
 */
export function TableToolbar({
  grid,
  onChange,
  map,
  onSetMap,
  onClearMap,
  tokens,
  players,
  onAddGmToken,
  onAddPlayerToken,
  onRemoveToken,
  onNotice,
}: Props) {
  const { t } = useI18n()
  const mapInputRef = useRef<HTMLInputElement | null>(null)
  const gmTokenInputRef = useRef<HTMLInputElement | null>(null)
  // Controlled state for the GM-token label input and the
  // player-token participant picker.
  const [gmTokenLabel, setGmTokenLabel] = useState('')
  const set = <K extends keyof Grid>(key: K, value: Grid[K]) =>
    onChange({ ...grid, [key]: value })
  const gmTokens = tokens.filter((tok) => tok.kind === 'gm')

  // Participants who do not yet have a PC token for their current
  // `(playerId, characterId)` — the only ones offering a useful
  // "Add" action. An empty list hides the picker entirely.
  const addablePlayers = useMemo(() => {
    return players.filter((p) => {
      return !tokens.some(
        (tok) =>
          tok.kind === 'pc' &&
          tok.ownerPlayerId === p.id &&
          tok.characterId === (p.characterId ?? ''),
      )
    })
  }, [players, tokens])

  const [playerPick, setPlayerPick] = useState<string>('')
  // Keep the picker pointing at a valid option as the roster / tokens
  // change. A stale value would silently mis-fire when the GM tapped
  // "Add" without re-selecting.
  const playerPickIsValid = addablePlayers.some(
    (p) => playerKey(p) === playerPick,
  )
  if (!playerPickIsValid && addablePlayers.length > 0 && playerPick !== '') {
    // Defer reset — this render shows the old value, the next render
    // (triggered by the setState below) shows the corrected one.
    setPlayerPick('')
  }

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

  const handleGmTokenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = await onAddGmToken(file, gmTokenLabel)
    if (result === 'ok') {
      onNotice?.(t('tabletop.gmToken.added'), 'success')
      setGmTokenLabel('')
    } else {
      onNotice?.(t('tabletop.gmToken.unreadable'), 'error')
    }
  }

  const handleAddPlayerToken = () => {
    const target = addablePlayers.find((p) => playerKey(p) === playerPick)
    if (!target) return
    onAddPlayerToken({ id: target.id, characterId: target.characterId ?? '' })
    onNotice?.(t('tabletop.playerToken.added'), 'success')
  }

  return (
    <aside className="tabletop-toolbar" aria-label={t('tabletop.panel.title')}>
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

      <details className="tabletop-toolbar-section" open>
        <summary className="tabletop-toolbar-summary">
          {t('tabletop.panel.tokens')}
        </summary>
        <div className="tabletop-toolbar-section-body">
          <h3 className="tabletop-toolbar-title">
            {t('tabletop.playerToken.title')}
          </h3>
          {addablePlayers.length === 0 ? (
            <p className="tabletop-toolbar-meta">
              {t('tabletop.playerToken.allPlaced')}
            </p>
          ) : (
            <>
              <select
                className="tabletop-toolbar-select"
                value={playerPick}
                onChange={(e) => setPlayerPick(e.target.value)}
              >
                <option value="">{t('tabletop.playerToken.choose')}</option>
                {addablePlayers.map((p) => (
                  <option key={playerKey(p)} value={playerKey(p)}>
                    {composeName(p.name, p.characterName)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="tabletop-toolbar-button"
                disabled={!playerPick}
                onClick={handleAddPlayerToken}
              >
                {t('tabletop.playerToken.add')}
              </button>
            </>
          )}

          <hr className="tabletop-toolbar-divider" />
          <h3 className="tabletop-toolbar-title">
            {t('tabletop.gmToken.title')}
          </h3>
          <input
            ref={gmTokenInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleGmTokenFile}
          />
          <input
            type="text"
            className="tabletop-toolbar-input"
            placeholder={t('tabletop.gmToken.labelPlaceholder')}
            value={gmTokenLabel}
            onChange={(e) => setGmTokenLabel(e.target.value)}
            maxLength={32}
          />
          <button
            type="button"
            className="tabletop-toolbar-button"
            onClick={() => gmTokenInputRef.current?.click()}
          >
            {t('tabletop.gmToken.add')}
          </button>
          {gmTokens.length > 0 && (
            <ul className="tabletop-toolbar-list">
              {gmTokens.map((token) => (
                <li key={token.id} className="tabletop-toolbar-list-item">
                  <span
                    className="tabletop-toolbar-list-label"
                    title={token.kind === 'gm' ? token.label : ''}
                  >
                    {token.kind === 'gm' && token.label
                      ? token.label
                      : t('tabletop.gmToken.unlabeled')}
                  </span>
                  <button
                    type="button"
                    className="icon-btn tabletop-toolbar-list-remove"
                    aria-label={t('tabletop.gmToken.remove')}
                    title={t('tabletop.gmToken.remove')}
                    onClick={() => onRemoveToken(token.id)}
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </aside>
  )
}

/**
 * Stable option value for a player in the picker: `${playerId}|${characterId}`
 * matches the same composite used elsewhere for per-character lookups.
 */
function playerKey(p: Player): string {
  return `${p.id}|${p.characterId ?? ''}`
}
