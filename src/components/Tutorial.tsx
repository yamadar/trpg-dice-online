import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'

/** The walkthrough steps, also reused as the in-app help. */
const STEPS: { icon: string; titleKey: string; bodyKey: string }[] = [
  { icon: '👋', titleKey: 'tutorial.welcome.title', bodyKey: 'tutorial.welcome.body' },
  { icon: '🎲', titleKey: 'tutorial.dice.title', bodyKey: 'tutorial.dice.body' },
  { icon: '🎭', titleKey: 'tutorial.character.title', bodyKey: 'tutorial.character.body' },
  { icon: '⭐', titleKey: 'tutorial.patterns.title', bodyKey: 'tutorial.patterns.body' },
  { icon: '👥', titleKey: 'tutorial.room.title', bodyKey: 'tutorial.room.body' },
  { icon: '📜', titleKey: 'tutorial.pastRooms.title', bodyKey: 'tutorial.pastRooms.body' },
  { icon: '💬', titleKey: 'tutorial.chat.title', bodyKey: 'tutorial.chat.body' },
  { icon: '🌐', titleKey: 'tutorial.translate.title', bodyKey: 'tutorial.translate.body' },
  { icon: '⚙', titleKey: 'tutorial.settings.title', bodyKey: 'tutorial.settings.body' },
]

interface Props {
  onClose: () => void
}

/**
 * Overlay walkthrough of the app. Shown once on first run and re-openable
 * from the settings menu as the in-app help.
 */
export function Tutorial({ onClose }: Props) {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div className="tutorial" role="dialog" aria-modal="true">
      <div className="tutorial-card">
        {!isLast && (
          <button type="button" className="link tutorial-skip" onClick={onClose}>
            {t('tutorial.skip')}
          </button>
        )}
        <div className="tutorial-icon" aria-hidden="true">
          {current.icon}
        </div>
        <h2>{t(current.titleKey)}</h2>
        <p className="tutorial-body">{t(current.bodyKey)}</p>

        <div className="tutorial-dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.titleKey} className={i === step ? 'dot active' : 'dot'} />
          ))}
        </div>

        <div className="tutorial-nav">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)}>
              {t('tutorial.back')}
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
          >
            {isLast ? t('tutorial.done') : t('tutorial.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
