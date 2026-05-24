import { useI18n } from '../i18n/useI18n'
import {
  EraserIcon,
  FogClearIcon,
  FogIcon,
  PenIcon,
  PointerIcon,
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
}

interface ToolButtonProps {
  name: TableTool
  label: string
  icon: React.ReactNode
  active: boolean
  onSelect: (tool: TableTool) => void
}

/** One pill in the tool palette. Hoisted out of `TableTools` so React
 *  does not recreate the component identity on every render — the
 *  react-hooks/static-components rule trips on inline components. */
function ToolButton({ name, label, icon, active, onSelect }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`tabletop-tools-btn${active ? ' active' : ''}`}
      aria-pressed={active}
      title={label}
      onClick={() => onSelect(name)}
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
}: Props) {
  const { t } = useI18n()

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
            onSelect={onToolChange}
          />
          <ToolButton
            name="fog-conceal"
            label={t('tabletop.tools.fogConceal')}
            icon={<FogIcon size={18} />}
            active={tool === 'fog-conceal'}
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
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            aria-label={t('tabletop.tools.color')}
          />
        </label>
      )}
      {tool === 'pen' && (
        <label className="tabletop-tools-row">
          <span>{t('tabletop.tools.width')}</span>
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
      )}
      {tool === 'text' && (
        <label className="tabletop-tools-row">
          <span>{t('tabletop.tools.fontSize')}</span>
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
      )}
    </aside>
  )
}
