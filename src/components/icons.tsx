import { useId } from 'react'

/**
 * Small inline SVG icons. Using SVG (rather than a "×" glyph) keeps icons
 * perfectly centered and identical across fonts and locales.
 */

/** A close / dismiss "X". Inherits the parent's color via currentColor. */
export function CloseIcon() {
  return (
    <svg
      className="x-icon"
      width="18"
      height="18"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
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
        d="M 256,11 A 245,245 0 1 1 201,495 Q 70,524 5,482 L 47,383 A 245,245 0 0 1 256,11 Z"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="22"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g stroke="#fff" strokeWidth="12" strokeLinejoin="round" fill="none">
        <polygon
          points="255,49 398.8,132 398.8,298 255,381 111.2,298 111.2,132"
          fill={`url(#${gradId})`}
        />
        <polygon points="255,49 398.8,298 111.2,298" />
        <polygon points="255,381 111.2,132 398.8,132" />
      </g>
      <text
        x="255"
        y="215"
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
