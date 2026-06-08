import { useEffect, type RefObject } from 'react'

/**
 * The elements a keyboard user can Tab to. Mirrors the set the WAI-ARIA
 * dialog pattern keeps inside a modal: links, enabled form controls and
 * buttons, plus anything explicitly tabbable. Disabled controls and
 * `tabindex="-1"` (programmatic-only focus) are excluded.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Collect the focusable elements inside `container`, in DOM (tab) order,
 * skipping any that can't actually receive focus right now — chiefly
 * `display:none` controls such as the hidden `<input type="file">` the
 * image pickers keep around. Without that filter the trap could hand
 * focus to a dead end and strand the keyboard user. `getClientRects()`
 * is empty for an element (or any ancestor) with `display:none`, which
 * is the case we care about here.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.getClientRects().length > 0)
}

/**
 * Pure focus-trap math: given the focusable elements (in tab order), the
 * currently focused one, and whether Shift is held, return the element
 * focus should wrap to — or `null` when the browser's own Tab handling
 * already keeps focus inside the dialog.
 *
 * An `active` that is not among `focusables` (e.g. the dialog container
 * itself, focused on open via `tabindex="-1"`) is treated as "at the
 * edge", so the very first Tab / Shift+Tab still lands on a real control
 * inside the dialog instead of escaping it.
 *
 * Generic over the element type so it can be unit-tested with plain
 * tokens in the DOM-less (`node`) Vitest environment.
 */
export function getTrapFocusTarget<T>(
  focusables: readonly T[],
  active: T | null,
  shiftKey: boolean,
): T | null {
  if (focusables.length === 0) return null
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const inside = active != null && focusables.includes(active)
  if (shiftKey) {
    return active === first || !inside ? last : null
  }
  return active === last || !inside ? first : null
}

interface UseDialogFocusOptions {
  /** Whether the dialog is currently open. Dialogs that mount/unmount
   *  per open can leave this at its default (`true`); dialogs that stay
   *  mounted behind an `open` prop should pass it so the trap engages
   *  and releases as the dialog shows and hides. */
  active?: boolean
  /** Element to focus when the dialog opens. Defaults to the first
   *  focusable descendant, falling back to the container itself. Pass
   *  this to start focus on the dialog's body / heading (give that
   *  element `tabindex={-1}`) instead of the first control. */
  initialFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Modal dialog focus management for the WAI-ARIA dialog pattern
 * (WCAG 2.4.3 Focus Order, 2.1.2 No Keyboard Trap). While the dialog is
 * open it:
 *   1. records the element that had focus (the trigger that opened it),
 *   2. moves focus into the dialog,
 *   3. traps Tab / Shift+Tab within the dialog's focusable elements, and
 *   4. restores focus to the trigger when the dialog closes.
 *
 * Escape-to-close is intentionally NOT handled here: several callers need
 * bespoke Escape handling (capture phase + `stopImmediatePropagation` so
 * the key doesn't also dismiss a panel sitting underneath), which a
 * shared default would fight. Each dialog keeps its own Escape handler.
 *
 * The Tab listener is bound to the container in the *capture* phase so it
 * (a) only fires for keystrokes originating inside this dialog — letting
 * a dialog layered on top trap its own focus without the two fighting —
 * and (b) runs before any descendant that might stop the event bubbling.
 *
 * @param containerRef ref to the dialog element whose descendants the
 *   trap is scoped to (typically the `role="dialog"` node).
 */
export function useDialogFocus(
  containerRef: RefObject<HTMLElement | null>,
  options: UseDialogFocusOptions = {},
): void {
  const { active = true, initialFocusRef } = options

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    // Capture the trigger BEFORE moving focus in, so it's the element
    // that opened the dialog rather than anything inside it.
    const trigger = document.activeElement as HTMLElement | null

    const initial =
      initialFocusRef?.current ??
      getFocusableElements(container)[0] ??
      container
    // The container is only programmatically focusable if it carries a
    // tabindex; add a -1 one so the fallback focus actually lands when a
    // dialog has no focusable controls of its own.
    if (initial === container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1')
    }
    initial.focus({ preventScroll: true })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const target = getTrapFocusTarget(
        getFocusableElements(container),
        document.activeElement as HTMLElement | null,
        e.shiftKey,
      )
      if (target) {
        e.preventDefault()
        target.focus({ preventScroll: true })
      }
    }
    container.addEventListener('keydown', onKeyDown, true)

    return () => {
      container.removeEventListener('keydown', onKeyDown, true)
      // Restore focus to the trigger, but only if it's still in the
      // document — a trigger that itself unmounted (e.g. a token popover
      // that closed behind the dialog) would otherwise throw focus to
      // <body>. `preventScroll` avoids a jump if the layout shifted.
      if (trigger && trigger.isConnected) {
        trigger.focus?.({ preventScroll: true })
      }
    }
  }, [active, containerRef, initialFocusRef])
}
