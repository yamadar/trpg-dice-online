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
