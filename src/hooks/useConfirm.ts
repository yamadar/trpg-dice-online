import { useContext } from 'react'
import { ConfirmContext, type ConfirmFn } from './confirmContext'

/**
 * Opens a themed confirmation dialog (in place of `window.confirm`) and
 * resolves to the user's choice. Must be used inside `<ConfirmProvider>`
 * — `main.tsx` already wraps the app.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within <ConfirmProvider>')
  }
  return ctx
}
