import { useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { Session } from '../hooks/useSession'
import type { ChatFile } from '../net/protocol'
import { MAX_ATTACHMENT_BYTES, formatBytes, isImageType, readAttachment } from '../chat/attachment'
import { resolveMentions } from '../chat/mentions'
import { useMentionAutocomplete } from '../hooks/useMentionAutocomplete'
import { AttachIcon, CloseIcon, SendIcon } from './icons'

interface Props {
  session: Session
  /** Whether keystrokes broadcast a typing signal to other players.
   *  Default is on; an HSP-sensitive user can opt out in settings. */
  broadcastTyping: boolean
  /** Surfaces attachment errors as a toast. */
  onNotice: (message: string, kind?: 'success' | 'error') => void
}

/**
 * The chat compose area: a staged-attachment chip, the @mention
 * autocomplete, the text input with a file-attach button, and Send.
 */
export function ChatComposer({ session, broadcastTyping, onNotice }: Props) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  // A file picked but not yet sent.
  const [pending, setPending] = useState<ChatFile | null>(null)
  const [attaching, setAttaching] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  const mentions = useMentionAutocomplete({
    text,
    setText,
    players: session.players,
    playerId: session.playerId,
    inputRef: chatInputRef,
  })

  const send = () => {
    if (!text.trim() && !pending) return
    const { ids, all } = resolveMentions(text, session.players)
    session.sendChat(text, pending ?? undefined, ids, all)
    setText('')
    setPending(null)
    mentions.clear()
  }

  const onType = (value: string, cursor: number) => {
    setText(value)
    // Skip the typing broadcast entirely when the local user has opted
    // out — no signal leaves this client, so the other end sees nothing.
    if (broadcastTyping) session.sendTyping()
    mentions.refresh(value, cursor)
  }

  // Read a picked file into a sendable attachment (images are downscaled).
  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setAttaching(true)
    try {
      const result = await readAttachment(file)
      if (result.ok) {
        setPending(result.file)
      } else if (result.error === 'tooLarge') {
        onNotice(t('chat.attachTooLarge', { max: formatBytes(MAX_ATTACHMENT_BYTES) }), 'error')
      } else {
        onNotice(t('chat.attachFailed'), 'error')
      }
    } finally {
      setAttaching(false)
    }
  }

  return (
    <div className="chat-compose">
      {pending && (
        <div className="attach-pending">
          {isImageType(pending.type) ? (
            <img className="attach-pending-thumb" src={pending.dataUrl} alt={pending.name} />
          ) : (
            <span className="attach-pending-icon" aria-hidden="true">
              <AttachIcon size={20} />
            </span>
          )}
          <span className="attach-pending-name">{pending.name}</span>
          <button
            type="button"
            className="link icon-btn attach-pending-remove"
            aria-label={t('chat.removeAttachment')}
            onClick={() => setPending(null)}
          >
            <CloseIcon />
          </button>
        </div>
      )}
      {mentions.suggestions.length > 0 && (
        <ul className="mention-suggest">
          {mentions.suggestions.map((s, i) => (
            <li key={s.kind === 'all' ? '@all' : s.id}>
              <button
                type="button"
                className={`mention-item${i === mentions.selected ? ' active' : ''}`}
                // preventDefault keeps focus on the chat input.
                onMouseDown={(e) => {
                  e.preventDefault()
                  mentions.pick(s)
                }}
              >
                {s.kind === 'all' ? (
                  <>
                    <span className="mention-handle">@all</span>
                    <span className="mention-sub">{t('chat.mentionEveryone')}</span>
                  </>
                ) : (
                  <span className="mention-handle">@{s.name}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="chat-input">
        <input ref={fileInputRef} type="file" className="visually-hidden" onChange={handlePickFile} />
        <button
          type="button"
          className="attach-btn"
          aria-label={t('chat.attach')}
          disabled={attaching}
          onClick={() => fileInputRef.current?.click()}
        >
          <AttachIcon size={20} />
        </button>
        <input
          ref={chatInputRef}
          type="text"
          value={text}
          maxLength={300}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          onChange={(e) => onType(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onSelect={(e) => {
            const el = e.currentTarget
            mentions.refresh(el.value, el.selectionStart ?? el.value.length)
          }}
          onBlur={mentions.clear}
          onKeyDown={(e) => {
            // The autocomplete claims the arrow keys / Enter while it is open.
            if (mentions.handleKeyDown(e)) return
            // Ignore Enter that only confirms an IME (e.g. Japanese) conversion.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
        />
        {/* preventDefault on mousedown keeps focus on the input, so clicking
            Send does not blur it and force-commit an in-progress IME
            composition — that blur previously raced with the click and left
            the message in the box (and a second click re-sent it). */}
        <button
          type="button"
          className="send-btn icon-btn"
          aria-label={t('chat.send')}
          title={t('chat.send')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={send}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
