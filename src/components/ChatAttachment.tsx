import { useI18n } from '../i18n/useI18n'
import type { ChatFile } from '../net/protocol'
import { formatBytes, isImageType } from '../chat/attachment'

interface Props {
  file: ChatFile
  /** Called with the file when an image thumbnail is tapped. */
  onOpenImage: (file: ChatFile) => void
}

/**
 * A chat attachment in the feed: images show a tappable thumbnail that
 * opens the lightbox; other files show a chip that downloads on click.
 */
export function ChatAttachment({ file, onOpenImage }: Props) {
  const { t } = useI18n()

  if (isImageType(file.type)) {
    return (
      <button type="button" className="chat-thumb" onClick={() => onOpenImage(file)}>
        <img src={file.dataUrl} alt={file.name} loading="lazy" />
      </button>
    )
  }

  return (
    <a className="chat-file" href={file.dataUrl} download={file.name}>
      <span className="chat-file-icon" aria-hidden="true">
        📎
      </span>
      <span className="chat-file-meta">
        <span className="chat-file-name">{file.name || t('chat.download')}</span>
        <span className="chat-file-size">
          {formatBytes(file.size)} · {t('chat.download')}
        </span>
      </span>
    </a>
  )
}
