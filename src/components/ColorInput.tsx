/**
 * Hex color input — swatch + hex text field; tapping either opens a
 * `react-colorful` picker popover that floats above the surrounding
 * panel. Pointerdown anywhere outside dismisses it.
 *
 * Why a custom wrapper around `react-colorful`:
 *   - The native `<input type="color">` opens a system picker that
 *     mobile browsers position poorly (full-screen Safari sheet
 *     covers everything) and limits to RGB only.
 *   - `react-colorful` is React-native, ~2.8 kB gzip, zero deps, and
 *     gives a touch-friendly HSV pad with a hue slider. Pairing it
 *     with a hex text field keeps power-users on the keyboard.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'

interface Props {
  value: string
  onChange: (next: string) => void
  /** Visible accessible label for the swatch button — used for both
   *  `aria-label` and the popover's `aria-labelledby` target. */
  label: string
}

export function ColorInput({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId().replace(/:/g, '-')

  // Close on any pointerdown outside the wrapper. Listening at
  // `document` (not on a backdrop) avoids the click-eating overlay
  // pattern that would also intercept legitimate scrolls / drags on
  // the surrounding panel.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target
      if (t instanceof Node && wrapRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Escape closes the popover. Capture phase so a parent Sheet
  // listening at the window level doesn't also close behind us.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  const toggle = useCallback(() => setOpen((p) => !p), [])

  return (
    <div className="color-input" ref={wrapRef}>
      <button
        type="button"
        className="color-input-swatch"
        style={{ background: value }}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      />
      <HexColorInput
        className="color-input-text"
        color={value}
        onChange={onChange}
        prefixed
        aria-label={label}
      />
      {open && (
        <div
          className="color-input-popover"
          role="dialog"
          aria-labelledby={titleId}
        >
          <span id={titleId} className="sr-only">
            {label}
          </span>
          <HexColorPicker color={value} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
