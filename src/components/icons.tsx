import { useId } from 'react'
import {
  Drama,
  Hand,
  History,
  Languages,
  Layers,
  MessageCircleMore,
  Paperclip,
  Pencil,
  Settings,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react'

/**
 * Inline SVG icons used across the app.
 *
 * UI chrome glyphs come from [Lucide](https://lucide.dev) — a single-weight
 * outline set chosen for a consistent visual vocabulary. The dice
 * silhouette is from [game-icons.net](https://game-icons.net) by
 * Delapouite (CC BY 3.0); see [`docs/CREDITS.md`](../../docs/CREDITS.md)
 * for attribution.
 *
 * Every Lucide-based icon plus `DiceIcon` renders at the current text
 * color via SVG `currentColor` and carries the `icon-svg` class so the
 * app's centring rules apply. Each accepts an optional `size` (number
 * of px or CSS length) so a call site can scale it for chrome (Dock
 * 22 px, filter chips 18 px, tutorial 44 px) without per-context CSS.
 *
 * `BrandIcon` is the deliberate exception: it bakes in its own gradient
 * and white text, intentionally does NOT inherit `currentColor` (so the
 * logo keeps its brand colours even inside a `background-clip: text`
 * heading), and does not use `.icon-svg` because its callers size it
 * via the `size` / `className` props.
 *
 * The repeated wrapper bodies (className / strokeWidth / aria-hidden)
 * are intentionally inlined per component rather than factored into a
 * helper: a function call on the RHS of `export const X = factory(...)`
 * trips `react-refresh/only-export-components` because the linter
 * cannot statically tell that the returned value is a React component.
 */

// A slightly lighter weight than Lucide's default of 2 — matches the
// thinness of the previous hand-rolled icons so the look stays
// understated rather than chunky.
const STROKE = 1.75

export interface IconProps {
  size?: number | string
}

/* ---- UI chrome ---- */

/** A close / dismiss "X". */
export function CloseIcon({ size = 18 }: IconProps) {
  return (
    <X
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Trash / waste-basket. Used for the quiet "clear view" action. */
export function TrashIcon({ size = 16 }: IconProps) {
  return (
    <Trash2
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Settings cog. */
export function SettingsIcon({ size = 18 }: IconProps) {
  return (
    <Settings
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Pencil — used as the "edit" affordance (e.g. portrait edit popover). */
export function EditIcon({ size = 14 }: IconProps) {
  return (
    <Pencil
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/* ---- Feed filter chips ---- */

/** Filter chip "all" — stacked layers reading as "everything together". */
export function AllIcon({ size = 18 }: IconProps) {
  return (
    <Layers
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Filter chip "chat" — speech bubble with extra ticks for an active
 *  conversation. Also reused in the tutorial for the chat step. */
export function ChatIcon({ size = 18 }: IconProps) {
  return (
    <MessageCircleMore
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/* ---- Conceptual app objects ---- */

/** People in the room. Dock "Room" and tutorial "Room" step. */
export function RoomIcon({ size = 22 }: IconProps) {
  return (
    <Users
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Theater masks for the character / persona concept. Dock "Character"
 *  and tutorial "Character" step. */
export function CharacterIcon({ size = 22 }: IconProps) {
  return (
    <Drama
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Star for saved roll patterns. Dock "Patterns" and tutorial "Patterns"
 *  step. */
export function PatternsIcon({ size = 22 }: IconProps) {
  return (
    <Star
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** A paperclip — used both as the feed "Files" filter and the chat
 *  composer's attach button. */
export function AttachIcon({ size = 18 }: IconProps) {
  return (
    <Paperclip
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Welcome wave for the tutorial's opening step. */
export function WelcomeIcon({ size = 22 }: IconProps) {
  return (
    <Hand
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Clock-with-arrow for the "past rooms" tutorial step (the durable log
 *  is the app's "history" surface). */
export function PastRoomsIcon({ size = 22 }: IconProps) {
  return (
    <History
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/** Translate — Lucide's standard translation icon (two glyphs with
 *  translation lines). Used in the tutorial's auto-translate step. */
export function TranslateIcon({ size = 22 }: IconProps) {
  return (
    <Languages
      className="icon-svg"
      size={size}
      strokeWidth={STROKE}
      aria-hidden="true"
      focusable={false}
    />
  )
}

/* ---- Dice ---- */

/**
 * A 6-sided die in 3/4 perspective showing the "1" face. Sourced from
 * game-icons.net (Delapouite, CC BY 3.0); the original `fill="#000"` is
 * swapped for `currentColor` so the icon takes on the surrounding text
 * color. See `src/assets/icons/perspective-dice-six-faces-one.svg` for
 * the canonical (attributed) source file.
 *
 * The path is duplicated here (and in the asset SVG) so the icon ships
 * as a plain React component — no `dangerouslySetInnerHTML`, no extra
 * fetch. `icons.test.ts` asserts the two copies stay in lock-step, so a
 * future change to the upstream icon must update both files in one
 * commit or CI fails.
 *
 * Used for every dice-related affordance in the UI — the feed "Rolls"
 * filter, the Dock's dice panel and the tutorial dice step — so the
 * concept reads with a single recognisable silhouette wherever it
 * appears. A simple d6 keeps its shape at small sizes where a more
 * detailed d20 would turn into noise.
 */
export function DiceIcon({ size = 18 }: IconProps) {
  return (
    <svg
      className="icon-svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M255.76 44.764c-6.176 0-12.353 1.384-17.137 4.152L85.87 137.276c-9.57 5.536-9.57 14.29 0 19.826l152.753 88.36c9.57 5.536 24.703 5.536 34.272 0l152.753-88.36c9.57-5.535 9.57-14.29 0-19.825l-152.753-88.36c-4.785-2.77-10.96-4.153-17.135-4.153zm.926 82.855a31.953 18.96 0 0 1 22.127 32.362 31.953 18.96 0 1 1-45.188-26.812 31.953 18.96 0 0 1 23.06-5.55zM75.67 173.84c-5.753-.155-9.664 4.336-9.664 12.28v157.696c0 11.052 7.57 24.163 17.14 29.69l146.93 84.848c9.57 5.526 17.14 1.156 17.14-9.895V290.76c0-11.052-7.57-24.16-17.14-29.688l-146.93-84.847c-2.69-1.555-5.225-2.327-7.476-2.387zm360.773.002c-2.25.06-4.783.83-7.474 2.385l-146.935 84.847c-9.57 5.527-17.14 18.638-17.14 29.69v157.7c0 11.05 7.57 15.418 17.14 9.89L428.97 373.51c9.57-5.527 17.137-18.636 17.137-29.688v-157.7c0-7.942-3.91-12.432-9.664-12.278zM89.297 195.77a31.236 18.008 58.094 0 1 33.818 41.183 31.236 18.008 58.094 1 1-45-25.98 31.236 18.008 58.094 0 1 11.182-15.203zm221.52 64.664A18.008 31.236 31.906 0 1 322 275.637a18.008 31.236 31.906 0 1-45 25.98 18.008 31.236 31.906 0 1 33.818-41.183zM145.296 289.1a31.236 18.008 58.094 0 1 33.818 41.183 31.236 18.008 58.094 0 1-45-25.98 31.236 18.008 58.094 0 1 11.182-15.203zm277.523 29.38A18.008 31.236 31.906 0 1 434 333.684a18.008 31.236 31.906 0 1-45 25.98 18.008 31.236 31.906 0 1 33.818-41.184zm-221.52 64.663a31.236 18.008 58.094 0 1 33.817 41.183 31.236 18.008 58.094 1 1-45-25.98 31.236 18.008 58.094 0 1 11.182-15.203z"
      />
    </svg>
  )
}

/**
 * Brand mark for "Dice & Chat": a speech bubble framing a d20 (hexagon +
 * inscribed hexagram + "20"). Sized via `size` (defaults to `1em` so it
 * scales with the surrounding text). The gradient is baked in — the icon
 * keeps its brand colours regardless of the parent's text colour, even
 * inside `background-clip: text` headings.
 *
 * Visually consistent with `public/brand-icon.svg`; when changing one,
 * keep the other in sync.
 */
export function BrandIcon({
  size = '1em',
  className,
}: {
  size?: string | number
  className?: string
}) {
  // useId ensures each instance has a unique gradient id, so multiple
  // BrandIcons on the page do not collide in the DOM.
  const id = useId().replace(/:/g, '')
  const gradId = `brand-grad-${id}`
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="16"
          y1="16"
          x2="496"
          y2="496"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5B8DF6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M 256,11 A 245,245 0 1 1 124,463 L 22,501 L 55,397 A 245,245 0 0 1 256,11 Z"
        fill="#fff"
        stroke={`url(#${gradId})`}
        strokeWidth="22"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g stroke="#fff" strokeWidth="12" strokeLinejoin="round" fill="none">
        <polygon
          points="256,90 399.8,173 399.8,339 256,422 112.2,339 112.2,173"
          fill={`url(#${gradId})`}
        />
        <polygon points="256,90 399.8,339 112.2,339" />
        <polygon points="256,422 112.2,173 399.8,173" />
      </g>
      <text
        x="256"
        y="256"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
        fontWeight={800}
        fontSize={135}
        fill="#fff"
        letterSpacing="-4"
      >
        20
      </text>
    </svg>
  )
}
