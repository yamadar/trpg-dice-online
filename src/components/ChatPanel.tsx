import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { ChatMessage } from '../net/protocol'

interface Props {
  chat: ChatMessage[]
  playerId: string
  onSend: (text: string) => void
}

export function ChatPanel({ chat, playerId, onSend }: Props) {
  const { t, lang } = useI18n()
  const [text, setText] = useState('')

  const send = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <section className="panel chat">
      <h2>{t('chat.section')}</h2>
      <ul className="chat-list">
        {chat.length === 0 && <li className="hint">{t('chat.empty')}</li>}
        {chat.map((m) => (
          <li key={m.id} className={m.playerId === playerId ? 'chat-msg own' : 'chat-msg'}>
            <div className="chat-meta">
              <span className="chat-name">{m.playerName}</span>
              <time>{new Date(m.timestamp).toLocaleTimeString(lang)}</time>
            </div>
            <p className="chat-text">{m.text}</p>
          </li>
        ))}
      </ul>
      <div className="chat-input">
        <input
          type="text"
          value={text}
          maxLength={300}
          placeholder={t('chat.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button type="button" onClick={send}>
          {t('chat.send')}
        </button>
      </div>
    </section>
  )
}
