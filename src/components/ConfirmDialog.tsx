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
  // The element that owned focus before the dialog opened, so we can
  // restore it on close. A ref (not state) — restoring focus is a
  // side-effect, not something React should re-render on.
  const lastFocusRef = useRef<HTMLElement | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        // A still-open dialog gets cancelled before we replace it, so
        // its caller's promise never hangs.
        prev?.resolve(false)
        lastFocusRef.current = (document.activeElement as HTMLElement | null) ?? null
        return { opts, resolve }
      })
    })
  }, [])

  // Hard-cancel any pending dialog if the provider itself unmounts (e.g.
  // a hot reload during development) so we never leak an unresolved
  // promise into the caller's `await`.
  useEffect(() => {
    return () => {
      setPending((prev) => {
        prev?.resolve(false)
        return null
      })
    }
  }, [])

  const settle = useCallback((value: boolean) => {
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
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null)
  // Per-instance ids so multiple dialogs (unit tests, future nesting)
  // don't collide on `confirm-title` / `confirm-message`.
  const instanceId = useId().replace(/:/g, '-')
  const titleId = `confirm-title-${instanceId}`
  const messageId = `confirm-message-${instanceId}`

  // Escape cancels, like a native dialog. Registered in the *capture*
  // phase and `stopImmediatePropagation`s the event so this dialog
  // absorbs the keystroke — otherwise an Escape would also reach the
  // window-level Escape handler on the Sheet sitting underneath, and
  // close both the confirm and the sheet that opened it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onCancel()
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
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
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
