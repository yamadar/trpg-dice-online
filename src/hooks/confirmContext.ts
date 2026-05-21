import { createContext } from 'react'

/**
 * Options the call site supplies when asking for a confirmation. Only
 * `message` is required — the rest fall back to neutral defaults
 * supplied by `ConfirmProvider`.
 */
export interface ConfirmOptions {
  /** Optional bold heading shown above the message. */
  title?: string
  /** The main message — multiple lines are kept as-is (preserves `\n`). */
  message: string
  /** Override the "Confirm" button label (defaults to `common.confirm`). */
  confirmLabel?: string
  /** Override the "Cancel" button label (defaults to `common.cancel`). */
  cancelLabel?: string
  /** Styles the confirm button as a destructive action (red accent). */
  destructive?: boolean
}

/**
 * Asks the user to confirm an action with a custom-styled dialog (rather
 * than the browser's `window.confirm`, which looks out-of-place and on
 * mobile sometimes hangs behind the address-bar chrome).
 *
 * Returns a promise that resolves to `true` if the user confirmed and
 * `false` otherwise (cancel button, Escape, backdrop click, or unmount).
 */
export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

/**
 * Lives in its own module so React's Fast Refresh can keep the
 * `ConfirmProvider` component and the `useConfirm` hook in files that
 * each export only one kind of thing (no `react-refresh/only-export-components`
 * warnings).
 */
export const ConfirmContext = createContext<ConfirmFn | null>(null)
