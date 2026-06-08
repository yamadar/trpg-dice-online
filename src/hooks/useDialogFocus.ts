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
 * The marker attribute that an open dialog's container carries while its
 * trap is active. It lets an ancestor dialog detect that a nested one owns
 * the focus and step aside — both for the Tab trap below and for the Escape
 * handler in `useDialogEscape`, which matches it via
 * `DIALOG_FOCUS_TRAP_SELECTOR`.
 */
const DIALOG_FOCUS_TRAP_ATTR = 'data-dialog-focus-trap'
export const DIALOG_FOCUS_TRAP_SELECTOR = `[${DIALOG_FOCUS_TRAP_ATTR}]`

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
 * Escape-to-close lives in the companion `useDialogEscape`, not here: it
 * needs capture phase + `stopImmediatePropagation` (so the key doesn't also
 * dismiss a panel underneath) plus the same nested-dialog handoff this hook
 * does for Tab. Kept a separate hook so a dialog can opt into either
 * independently — `ConfirmDialog` runs its own Tab trap but shares the
 * Escape one. The handoff keys off the `data-dialog-focus-trap` marker this
 * hook sets; a dialog that takes only the Escape hook (`ConfirmDialog`)
 * stays unmarked, which is harmless — nothing nests inside it.
 *
 * The Tab listener is bound to the container in the *capture* phase so it
 * (a) only fires for keystrokes originating inside this dialog and (b)
 * runs before any descendant that might stop the event bubbling. Dialogs
 * layered as DOM *siblings* (a confirm over a Sheet, the Lightbox over the
 * map gallery) thus never see each other's keystrokes. For a dialog
 * rendered as a DOM *descendant* of another (the image-crop dialog or
 * Lightbox opened from inside a Sheet), each trap tags its container with
 * `data-dialog-focus-trap`, and an ancestor trap steps aside when a
 * nested trap owns the focus — so only the innermost trap acts.
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
    // tabindex; add a -1 one (removed on cleanup) so the fallback focus
    // actually lands when a dialog has no focusable controls of its own.
    const addedTabIndex =
      initial === container && !container.hasAttribute('tabindex')
    if (addedTabIndex) container.setAttribute('tabindex', '-1')
    initial.focus({ preventScroll: true })

    // Tag this container so an ancestor trap can detect that a nested
    // dialog owns the focus and step aside (see the handler below).
    container.setAttribute(DIALOG_FOCUS_TRAP_ATTR, '')

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      // If focus sits inside a nested dialog that runs its own trap —
      // e.g. the image-crop dialog or Lightbox opened from within a
      // Sheet, which React renders as a DOM *descendant* rather than a
      // sibling — let that inner trap handle the key. Otherwise this
      // outer trap, whose focusable set recursively includes the inner
      // dialog's controls, could wrap focus to a control behind it.
      const owner = (document.activeElement as HTMLElement | null)?.closest(
        DIALOG_FOCUS_TRAP_SELECTOR,
      )
      if (owner && owner !== container && container.contains(owner)) return
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
      container.removeAttribute(DIALOG_FOCUS_TRAP_ATTR)
      if (addedTabIndex) container.removeAttribute('tabindex')
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
