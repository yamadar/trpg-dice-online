import { useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { CloseIcon } from './icons'
import type { ChatFile } from '../net/protocol'

interface Props {
  file: ChatFile
  onClose: () => void
}

/**
 * Fullscreen image viewer. The image is shown fit-to-screen; clicking
 * anywhere or pressing Escape dismisses it.
 */
export function Lightbox({ file, onClose }: Props) {
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button
        type="button"
        className="lightbox-close icon-x"
        aria-label={t('lightbox.close')}
        onClick={onClose}
      >
        <CloseIcon />
      </button>
      <img className="lightbox-img" src={file.dataUrl} alt={file.name} />
    </div>
  )
}
