import { useEffect, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import { CloseIcon } from './icons'

interface Props {
  children: ReactNode
  onClose: () => void
}

/**
 * On-demand overlay panel: a bottom sheet on mobile, a centered modal on
 * desktop. Holds one of the room / character / dice / pattern panels.
 */
export function Sheet({ children, onClose }: Props) {
  const { t } = useI18n()

  // Close on Escape, like a normal dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-layer" role="dialog" aria-modal="true">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <button
          type="button"
          className="sheet-close icon-x"
          aria-label={t('settings.close')}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
