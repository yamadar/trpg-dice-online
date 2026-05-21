import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { BrandIcon } from './icons'

interface Props {
  onSubmit: (name: string) => void
}

/**
 * First-run gate: the app needs a player name before it can be used.
 * Blocks the rest of the UI until a name is entered.
 */
export function NameGate({ onSubmit }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const canSubmit = name.trim().length > 0

  const submit = () => {
    if (canSubmit) onSubmit(name.trim())
  }

  return (
    <div className="name-gate" role="dialog" aria-modal="true">
      <div className="name-gate-card">
        <h1 className="brand-heading gradient-heading">
          <BrandIcon className="brand-mark" />
          <span>{t('app.title')}</span>
        </h1>
        <p className="hint">{t('app.tagline')}</p>
        <label className="field">
          <span>{t('player.name')}</span>
          <input
            type="text"
            value={name}
            maxLength={24}
            autoFocus
            placeholder={t('player.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
          />
        </label>
        <p className="hint">{t('gate.nameHint')}</p>
        <button type="button" className="primary big" disabled={!canSubmit} onClick={submit}>
          {t('gate.start')}
        </button>
      </div>
    </div>
  )
}
