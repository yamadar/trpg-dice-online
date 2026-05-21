import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useI18n } from '../i18n/useI18n'
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from '../hooks/confirmContext'
import { CloseIcon } from './icons'

interface PendingConfirm {
  opts: ConfirmOptions
  resolve: (value: boolean) => void
}

/**
 * Wraps the app so any descendant can call `useConfirm()` to surface a
 * themed confirmation dialog. Only one dialog is shown at a time — a new
 * call while another is open resolves the previous one as cancelled and
 * replaces it (the common shape: the user opens one panel, then another).
 *
 * The dialog itself is rendered by this provider — call sites never
 * import `ConfirmDialog` directly.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  // The element that owned focus before the FIRST dialog opened. Only
  // captured on a null→pending transition: if a second `confirm()` call
  // replaces a still-open dialog, we keep the original trigger so the
  // eventual close restores focus to where the user actually started,
  // not to a button inside the soon-to-be-unmounted previous dialog.
  const lastFocusRef = useRef<HTMLElement | null>(null)
  // Mirror of the current resolver, kept in a ref. The unmount cleanup
  // below reads through this ref instead of `setPending(...)` because
  // React skips state updates while a component is unmounting — a
  // setState-only cleanup could leave the caller's promise hanging.
  const pendingResolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      // Update the ref synchronously, before `setPending` schedules the
      // render, so an unmount that happens before the matching effect
      // runs still has the latest resolver to clean up with.
      pendingResolverRef.current = resolve
      setPending((prev) => {
        if (prev) {
          // Cancel the still-open dialog without touching `lastFocusRef`
          // — it already holds the original trigger element.
          prev.resolve(false)
        } else {
          lastFocusRef.current = (document.activeElement as HTMLElement | null) ?? null
        }
        return { opts, resolve }
      })
    })
  }, [])

  // Hard-cancel any pending dialog if the provider itself unmounts (e.g.
  // a hot reload during development) so we never leak an unresolved
  // promise into the caller's `await`. Resolves through the ref because
  // React drops setState updates issued during unmount.
  useEffect(() => {
    return () => {
      pendingResolverRef.current?.(false)
      pendingResolverRef.current = null
    }
  }, [])

  const settle = useCallback((value: boolean) => {
    pendingResolverRef.current = null
    setPending((prev) => {
      prev?.resolve(value)
      return null
    })
    // Restore focus to whatever had it when the dialog opened — keeps
    // keyboard users from being dropped at the top of the page.
    // `preventScroll: true` keeps the page from jumping if the prior
    // focus target has scrolled off-screen behind the dialog (common
    // on mobile when the on-screen keyboard had shifted the layout).
    // Older Safari versions ignore the option but still re-focus, so
    // the call is safe to make unconditionally.
    lastFocusRef.current?.focus?.({ preventScroll: true })
    lastFocusRef.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          title={pending.opts.title}
          // Fallback accessible name when the caller does not supply a
          // visible title — screen readers should announce the dialog
          // as e.g. "Confirmation" instead of an unnamed alertdialog.
          dialogLabel={t('common.confirmDialog')}
          message={pending.opts.message}
          confirmLabel={pending.opts.confirmLabel ?? t('common.confirm')}
          cancelLabel={pending.opts.cancelLabel ?? t('common.cancel')}
          destructive={pending.opts.destructive ?? false}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

interface ConfirmDialogProps {
  title?: string
  /** Fallback accessible name used when no `title` is supplied — keeps
   *  the alertdialog from being announced as unnamed. */
  dialogLabel: string
  message: string
  confirmLabel: string
  cancelLabel: string
  destructive: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The visual confirmation dialog. Rendered by `ConfirmProvider` when a
 * caller has a pending `confirm()` — call sites do not import this
 * directly. Public for unit testing.
 */
export function ConfirmDialog({
  title,
  dialogLabel,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null)
  // Per-instance ids so multiple dialogs (unit tests, future nesting)
  // don't collide on `confirm-title` / `confirm-message`.
  const instanceId = useId().replace(/:/g, '-')
  const titleId = `confirm-title-${instanceId}`
  const messageId = `confirm-message-${instanceId}`

  // Keystroke handling: Escape cancels (like a native dialog), Tab and
  // Shift-Tab cycle focus *within* the dialog. The handler is registered
  // in the *capture* phase and `stopImmediatePropagation`s anything it
  // claims, so the keystroke does not also reach the window-level
  // Escape handler on a Sheet sitting underneath (which would close
  // both the confirm and its parent sheet).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      // Focus trap: collect the focusable elements inside the card and
      // wrap the focus when Tab tries to move out either end. Without
      // this, Tab would walk to whatever lives behind the backdrop,
      // which contradicts `aria-modal="true"` and confuses assistive
      // tech users.
      const card = cardRef.current
      if (!card) return
      const focusables = Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !card.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !card.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  // Focus the safe option on open: the cancel button for destructive
  // confirms (so a hasty Enter doesn't fire the destructive action), and
  // the confirm button otherwise (matches the typical "press Enter to
  // continue" flow). useEffect (not auto-focus) so it runs once after
  // mount, not during the parent's render.
  useEffect(() => {
    const target = destructive ? cancelBtnRef.current : confirmBtnRef.current
    target?.focus()
  }, [destructive])

  return (
    <div className="confirm-layer" role="presentation">
      <div
        className="confirm-backdrop"
        onClick={onCancel}
        // Clicks on the backdrop are aliased to cancel; the dialog
        // itself stops propagation below so a click on the card stays.
        aria-hidden="true"
      />
      <div
        ref={cardRef}
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        // When a visible title is shown, point assistive tech at it
        // through `aria-labelledby`. Otherwise fall back to a localised
        // generic name so the dialog is never announced as unnamed.
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : dialogLabel}
        aria-describedby={messageId}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="confirm-close icon-btn"
          aria-label={cancelLabel}
          onClick={onCancel}
        >
          <CloseIcon />
        </button>
        {title && (
          <h2 id={titleId} className="confirm-title">
            {title}
          </h2>
        )}
        <p id={messageId} className="confirm-message">
          {message}
        </p>
        <div className="confirm-actions">
          <button ref={cancelBtnRef} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
