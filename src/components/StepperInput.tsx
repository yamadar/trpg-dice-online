/**
 * Touch-friendly integer stepper: large -/+ buttons flanking a
 * direct-entry text field. Long-press on either button repeats with
 * acceleration so the user can sweep through a long range without
 * tapping 200 times.
 *
 * Why not `<input type="number">`:
 *   - The default spinner buttons are tiny (≈12 px hit area) and
 *     hidden on mobile.
 *   - On iOS Safari, `type="number"` defeats `value` formatting and
 *     hides the keyboard's done bar in some configurations.
 *   - A real text field with `inputMode="numeric"` shows the same
 *     numeric keypad while giving us full control over the value.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  /** Visible accessible label routed to `aria-label` on the text
   *  field and used to compose the +/- button labels. */
  label: string
}

/** Initial press-and-hold delay, then how fast the value advances
 *  once the timer kicks in. Acceleration kicks in after a short hold
 *  so a deliberate tap stays a single tick. */
const HOLD_DELAY_MS = 320
const REPEAT_INTERVAL_MS = 80

const clampToRange = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n))

export function StepperInput({
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  label,
}: Props) {
  // A transient editing string. `null` means "not editing — render
  // the external `value`". Set to a string while the user is typing
  // (so they can clear the field or type "-" without the value
  // snapping back), cleared on blur / Enter / +/-. This sidesteps
  // the "sync state to prop" anti-pattern entirely: `value` stays
  // the single source of truth.
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? String(value)

  const repeatTimerRef = useRef<number | null>(null)
  const accelTimerRef = useRef<number | null>(null)

  /** Clear both timers — called on pointerup, pointerleave, or
   *  unmount so a held button never keeps incrementing after the
   *  user lifted. */
  const stopHold = useCallback(() => {
    if (repeatTimerRef.current !== null) {
      clearInterval(repeatTimerRef.current)
      repeatTimerRef.current = null
    }
    if (accelTimerRef.current !== null) {
      clearTimeout(accelTimerRef.current)
      accelTimerRef.current = null
    }
  }, [])

  useEffect(() => stopHold, [stopHold])

  const commit = useCallback(
    (raw: string) => {
      const n = Number(raw)
      if (Number.isFinite(n)) {
        const clamped = clampToRange(Math.round(n / step) * step, min, max)
        onChange(clamped)
      }
      // Either way, drop the draft so the displayed value falls
      // back to `value` (newly-committed clamp, or the prior value
      // for an unparseable input).
      setDraft(null)
    },
    [min, max, step, onChange],
  )

  const bump = useCallback(
    (dir: 1 | -1) => {
      const current =
        draft !== null && Number.isFinite(Number(draft))
          ? Number(draft)
          : value
      const next = clampToRange(current + dir * step, min, max)
      if (next !== current) onChange(next)
      setDraft(null)
    },
    [draft, value, min, max, step, onChange],
  )

  const startHold = useCallback(
    (dir: 1 | -1) => {
      stopHold()
      bump(dir)
      // Delay before the repeat kicks in so a quick tap stays a
      // single step. After the delay, fire at REPEAT_INTERVAL.
      accelTimerRef.current = window.setTimeout(() => {
        repeatTimerRef.current = window.setInterval(
          () => bump(dir),
          REPEAT_INTERVAL_MS,
        )
      }, HOLD_DELAY_MS)
    },
    [bump, stopHold],
  )

  return (
    <div className="stepper-input" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-input-btn"
        aria-label={`${label} −`}
        // Pointer events cover mouse / touch / pen in one listener.
        // `onPointerDown` starts the press; `onPointerUp` / Leave
        // stop it. `onClick` is *also* fired by browsers on pointer
        // up, but our `startHold` already did the single bump, so we
        // suppress the synthetic click by stopping propagation in
        // `onPointerDown` and not registering `onClick` here.
        onPointerDown={(e) => {
          e.preventDefault()
          startHold(-1)
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        disabled={value <= min}
      >
        −
      </button>
      <input
        type="text"
        className="stepper-input-text"
        inputMode="numeric"
        // pattern lets iOS Safari hint the numeric keyboard even when
        // we use type=text (which we do to allow a transient "-" or
        // empty draft state).
        pattern="-?[0-9]*"
        value={display}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            bump(1)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            bump(-1)
          }
        }}
      />
      <button
        type="button"
        className="stepper-input-btn"
        aria-label={`${label} +`}
        onPointerDown={(e) => {
          e.preventDefault()
          startHold(1)
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  )
}
