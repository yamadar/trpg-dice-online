import { useEffect, type RefObject } from 'react'
import { DIALOG_FOCUS_TRAP_SELECTOR } from './useDialogFocus'

/**
 * Should an ancestor dialog's Escape handler step aside? It must when a
 * nested dialog currently owns the focus — i.e. `owner` (the nearest
 * enclosing dialog of `document.activeElement`) is a DIFFERENT, DEEPER
 * dialog than `container`: distinct from it yet contained by it. Then only
 * that inner dialog should close on a single Escape, so this one yields.
 *
 * The same shape `useDialogFocus` uses to hand the Tab trap to a nested
 * dialog. Generic over the node type (needing only `contains`) so it can be
 * unit-tested with plain stand-ins in the DOM-less (`node`) Vitest env.
 */
export function shouldYieldEscape<T extends { contains(other: T): boolean }>(
  container: T | null,
  owner: T | null,
): boolean {
  return (
    container != null &&
    owner != null &&
    owner !== container &&
    container.contains(owner)
  )
}

/**
 * Close-on-Escape for a modal dialog layered over a panel or another
 * dialog. Registered on `window` in the *capture* phase; when it acts it
 * calls `stopImmediatePropagation()` so the key does not also reach a
 * handler underneath — a bubble-phase Sheet, the tabletop shortcut layer,
 * or another capture dialog behind this one — and dismiss it too.
 *
 * When dialogs nest, only the innermost should close on one press. Every
 * capture handler sits on `window`, so registration order would otherwise
 * pick the winner — and the outer dialog mounts first, so it would win and
 * tear down the whole stack. To prevent that, this handler yields when a
 * nested dialog (tagged `data-dialog-focus-trap` by `useDialogFocus`) owns
 * the focus and is contained by `containerRef` (see `shouldYieldEscape`);
 * the event then flows on to that inner dialog's own capture handler, which
 * closes only itself. This mirrors the nested-trap handoff `useDialogFocus`
 * does for Tab — covering the case where the OUTER layer is itself a capture
 * dialog (a Lightbox / crop dialog opened from a tabletop token's character
 * modal), which capture-vs-bubble ordering alone cannot resolve.
 *
 * @param containerRef ref to this dialog's container — the same node passed
 *   to `useDialogFocus`, so it carries `data-dialog-focus-trap`.
 * @param onClose what closing THIS dialog means. Usually the `onClose` prop;
 *   `MapGalleryDialog` passes a closure that first dismisses its own nested
 *   Lightbox preview (a DOM sibling the contains-check can't reach).
 * @param active whether the handler is engaged. Dialogs that mount/unmount
 *   per open can leave this at its default; a kept-mounted dialog behind an
 *   `open` prop should pass it.
 */
export function useDialogEscape(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const owner =
        document.activeElement?.closest<HTMLElement>(
          DIALOG_FOCUS_TRAP_SELECTOR,
        ) ?? null
      // A nested dialog owns the focus — let it handle Escape alone.
      if (shouldYieldEscape(containerRef.current, owner)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, containerRef, onClose])
}
