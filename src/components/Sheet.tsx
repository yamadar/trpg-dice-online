import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { CloseIcon } from './icons'

interface Props {
  /** Sheet title — shown in the fixed header, right of the icon. */
  title?: ReactNode
  /** Icon shown left of the title in the fixed header. Matches the
   *  panel icon each `*.Panel` would otherwise have rendered inline. */
  titleIcon?: ReactNode
  children: ReactNode
  onClose: () => void
}

/**
 * On-demand overlay panel: a bottom sheet on mobile, a centered modal on
 * desktop. Two stacked regions:
 *  - `.sheet-header`: fixed at the top, carries the panel icon + title
 *    and the close button. Does not scroll, so the heading and the close
 *    affordance never slide out of view.
 *  - `.sheet-body`: the only scrollable region; holds the panel content.
 * `.sheet` itself uses `overflow: hidden` so a long body cannot bleed
 * above the header line when the user scrolls.
 */
export function Sheet({ title, titleIcon, children, onClose }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  // Per-instance id so the title link is robust if two sheets ever
  // co-mount (e.g. during a cross-fade) rather than colliding on a
  // shared static id.
  const titleId = useId()

  // Move focus into the sheet on open, trap Tab while open, and restore
  // focus to the trigger on close.
  useDialogFocus(dialogRef)

  // Close on Escape, like a normal dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="sheet-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title || titleIcon ? titleId : undefined}
      ref={dialogRef}
    >
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-header">
          {(titleIcon || title) && (
            <h2 className="sheet-title" id={titleId}>
              {titleIcon && (
                <span className="panel-icon" aria-hidden="true">
                  {titleIcon}
                </span>
              )}
              {title}
            </h2>
          )}
          <button
            type="button"
            className="sheet-close icon-btn"
            aria-label={t('settings.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
