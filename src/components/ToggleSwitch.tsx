/**
 * On/off toggle styled as a switch. Conveys binary state at a glance
 * far better than a checkbox: the thumb's left/right position +
 * background color encode the state without needing the user to
 * read an associated label.
 *
 * Implemented as a `role="switch"` button — the WAI-ARIA pattern
 * screen readers announce as "on / off" — rather than a hidden
 * `<input type="checkbox">` so the hit target and visual styling
 * are decoupled from the platform's checkbox renderer (which on iOS
 * can override CSS in subtle ways).
 */
import { useCallback } from 'react'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  /** Accessible name. Required — assistive tech needs to know which
   *  setting the switch controls; a visible adjacent `<label>` does
   *  not auto-associate with `role="switch"`. */
  label: string
  disabled?: boolean
}

export function ToggleSwitch({ checked, onChange, label, disabled }: Props) {
  const onClick = useCallback(() => {
    if (!disabled) onChange(!checked)
  }, [checked, onChange, disabled])

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle-switch${checked ? ' on' : ''}`}
      onClick={onClick}
    >
      <span className="toggle-switch-thumb" aria-hidden="true" />
    </button>
  )
}
