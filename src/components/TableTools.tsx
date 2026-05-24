import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  EraserIcon,
  FogClearIcon,
  FogIcon,
  FontSizeIcon,
  PenIcon,
  PointerIcon,
  RulerIcon,
  TextIcon,
} from './icons'

/**
 * The set of "tools" available on the tabletop canvas. The default
 * tool is `select` (drag tokens, pan with right-click / Space). Other
 * tools take over the left mouse / single touch:
 *
 *   - `pen`: drag draws a free-hand stroke; commit on pointer up.
 *   - `eraser`: tapping a stroke removes it (owner / host only).
 *   - `text`: clicking the stage drops a floating text input.
 *   - `fog-reveal` / `fog-conceal`: drag paints grid cells (GM only).
 *
 * `eraser` is shared between strokes and text labels — the underlying
 * shape decides which sync call fires.
 */
export type TableTool =
  | 'select'
  | 'pen'
  | 'eraser'
  | 'text'
  | 'fog-reveal'
  | 'fog-conceal'

interface Props {
  tool: TableTool
  onToolChange: (tool: TableTool) => void
  /** Pen / text color (hex). */
  color: string
  onColorChange: (color: string) => void
  /** Pen stroke width (world px). */
  penWidth: number
  onPenWidthChange: (width: number) => void
  /** Text font size (world px). */
  textSize: number
  onTextSizeChange: (size: number) => void
  /** True when the local actor is GM (or in offline sandbox). Gates the
   *  fog tools. */
  canEditFog: boolean
  /** True when fog of war can actually be painted — currently means
   *  `fog.enabled === true`. The reveal / conceal brush buttons are
   *  rendered but disabled when false, with a tooltip suggesting the
   *  GM enable fog from the toolbar first. */
  fogPaintReady: boolean
}

interface ToolButtonProps {
  name: TableTool
  label: string
  icon: React.ReactNode
  active: boolean
  /** When true the button is rendered but disabled (greyed out). The
   *  click handler is suppressed so a stuck-on tool cannot leak into
   *  the canvas. */
  disabled?: boolean
  /** Tooltip override; defaults to `label`. */
  title?: string
  onSelect: (tool: TableTool) => void
}

/** One pill in the tool palette. Hoisted out of `TableTools` so React
 *  does not recreate the component identity on every render — the
 *  react-hooks/static-components rule trips on inline components. */
function ToolButton({
  name,
  label,
  icon,
  active,
  disabled,
  title,
  onSelect,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`tabletop-tools-btn${active ? ' active' : ''}`}
      aria-pressed={active}
      title={title ?? label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onSelect(name)
      }}
    >
      {icon}
      <span className="tabletop-tools-label">{label}</span>
    </button>
  )
}

/**
 * Floating tool palette anchored to the left edge of the tabletop
 * canvas. Choosing a tool flips the gesture mode for left-mouse /
 * single-touch input on the Stage. Two additional inputs below the
 * tool grid let the user pick a color, a pen width and a text size —
 * all rendered in world units so they scale with zoom.
 */
export function TableTools({
  tool,
  onToolChange,
  color,
  onColorChange,
  penWidth,
  onPenWidthChange,
  textSize,
  onTextSizeChange,
  canEditFog,
  fogPaintReady,
}: Props) {
  const { t } = useI18n()
  // Which numeric-setting popover (pen width / text size) is open.
  // Only one can be open at a time; switching tools also closes any
  // open popover via the auto-close in `ToolSettingPopover`.
  const [openSetting, setOpenSetting] = useState<OpenSetting>(null)

  return (
    <aside
      className="tabletop-tools"
      aria-label={t('tabletop.tools.title')}
    >
      <ToolButton
        name="select"
        label={t('tabletop.tools.select')}
        icon={<PointerIcon size={18} />}
        active={tool === 'select'}
        onSelect={onToolChange}
      />
      <ToolButton
        name="text"
        label={t('tabletop.tools.text')}
        icon={<TextIcon size={18} />}
        active={tool === 'text'}
        onSelect={onToolChange}
      />
      <ToolButton
        name="pen"
        label={t('tabletop.tools.pen')}
        icon={<PenIcon size={18} />}
        active={tool === 'pen'}
        onSelect={onToolChange}
      />
      <ToolButton
        name="eraser"
        label={t('tabletop.tools.eraser')}
        icon={<EraserIcon size={18} />}
        active={tool === 'eraser'}
        onSelect={onToolChange}
      />
      {canEditFog && (
        <>
          <hr className="tabletop-tools-divider" />
          <ToolButton
            name="fog-reveal"
            label={t('tabletop.tools.fogReveal')}
            icon={<FogClearIcon size={18} />}
            active={tool === 'fog-reveal'}
            disabled={!fogPaintReady}
            title={
              fogPaintReady
                ? t('tabletop.tools.fogReveal')
                : t('tabletop.tools.fogDisabled')
            }
            onSelect={onToolChange}
          />
          <ToolButton
            name="fog-conceal"
            label={t('tabletop.tools.fogConceal')}
            icon={<FogIcon size={18} />}
            active={tool === 'fog-conceal'}
            disabled={!fogPaintReady}
            title={
              fogPaintReady
                ? t('tabletop.tools.fogConceal')
                : t('tabletop.tools.fogDisabled')
            }
            onSelect={onToolChange}
          />
        </>
      )}
      {/* Per-tool settings: shown only when the tool actually uses the
          field, so a sticky color choice from "pen" mode does not
          clutter the "select" view. */}
      {(tool === 'pen' || tool === 'text') && (
        <label className="tabletop-tools-row">
          <span>{t('tabletop.tools.color')}</span>
          <input
            // The colour input doubles as a visible preview swatch and
            // the picker trigger. The custom styling (see App.css)
            // strips the browser chrome so the swatch fills the input
            // area — on Firefox / Safari the default rendering hides
            // the current colour behind an opaque button, which made
            // the selected pen / text colour invisible.
            type="color"
            className="tabletop-tools-color-input"
            value={color || '#000000'}
            onChange={(e) => onColorChange(e.target.value)}
            aria-label={t('tabletop.tools.color')}
          />
        </label>
      )}
      {tool === 'pen' && (
        <ToolSettingPopover
          openKey="penWidth"
          openSetting={openSetting}
          onChangeOpen={setOpenSetting}
          icon={<RulerIcon size={18} />}
          label={t('tabletop.tools.widthAdjust')}
          value={penWidth}
          closeLabel={t('tabletop.tools.closeSetting')}
        >
          <label className="tabletop-tools-setting-row">
            <span>
              {t('tabletop.tools.width')}: {penWidth}
            </span>
            <input
              type="range"
              min={1}
              max={32}
              step={1}
              value={penWidth}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) onPenWidthChange(n)
              }}
              aria-label={t('tabletop.tools.width')}
            />
          </label>
        </ToolSettingPopover>
      )}
      {tool === 'text' && (
        <ToolSettingPopover
          openKey="textSize"
          openSetting={openSetting}
          onChangeOpen={setOpenSetting}
          icon={<FontSizeIcon size={18} />}
          label={t('tabletop.tools.sizeAdjust')}
          value={textSize}
          closeLabel={t('tabletop.tools.closeSetting')}
        >
          <label className="tabletop-tools-setting-row">
            <span>
              {t('tabletop.tools.fontSize')}: {textSize}
            </span>
            <input
              type="range"
              min={8}
              max={120}
              step={1}
              value={textSize}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) onTextSizeChange(n)
              }}
              aria-label={t('tabletop.tools.fontSize')}
            />
          </label>
        </ToolSettingPopover>
      )}
    </aside>
  )
}

type OpenSetting = 'penWidth' | 'textSize' | null

interface ToolSettingPopoverProps {
  openKey: Exclude<OpenSetting, null>
  openSetting: OpenSetting
  onChangeOpen: (next: OpenSetting) => void
  icon: ReactNode
  /** Accessible label for the trigger button. */
  label: string
  /** Current value shown inside the trigger, so the user sees the
   *  setting without opening the popover. */
  value: number
  closeLabel: string
  children: ReactNode
}

/**
 * Trigger + floating popover for a tool's numeric setting (pen width
 * / text size). The slider lives inside the popover so it can render
 * at a comfortable touch width even on a narrow phone — the tool
 * palette itself is too thin to host an inline slider that's
 * actually draggable. The trigger shows the current value so the
 * user can read the setting at a glance without opening anything.
 */
function ToolSettingPopover({
  openKey,
  openSetting,
  onChangeOpen,
  icon,
  label,
  value,
  closeLabel,
  children,
}: ToolSettingPopoverProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const open = openSetting === openKey
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const el = wrapperRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      onChangeOpen(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, onChangeOpen])
  return (
    <div ref={wrapperRef} className="tabletop-tools-setting-wrapper">
      <button
        type="button"
        className={`tabletop-tools-setting-trigger${open ? ' active' : ''}`}
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => onChangeOpen(open ? null : openKey)}
      >
        {icon}
        <span className="tabletop-tools-setting-value">{value}</span>
      </button>
      {open && (
        <div
          className="tabletop-tools-setting-popover"
          role="dialog"
          aria-label={label}
        >
          {children}
          <button
            type="button"
            className="tabletop-toolbar-button outline"
            onClick={() => onChangeOpen(null)}
          >
            {closeLabel}
          </button>
        </div>
      )}
    </div>
  )
}
