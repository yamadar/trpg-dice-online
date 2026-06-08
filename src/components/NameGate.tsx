import { useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useDialogFocus } from '../hooks/useDialogFocus'
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
  const dialogRef = useRef<HTMLDivElement>(null)

  const submit = () => {
    if (canSubmit) onSubmit(name.trim())
  }

  // Move focus to the name input on open (replacing the bare `autoFocus`)
  // and trap Tab within the gate — there is nothing behind it to reach.
  useDialogFocus(dialogRef)

  return (
    <div
      className="name-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-gate-title"
      ref={dialogRef}
    >
      <div className="name-gate-card">
        <h1 className="brand-heading gradient-heading" id="name-gate-title">
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
