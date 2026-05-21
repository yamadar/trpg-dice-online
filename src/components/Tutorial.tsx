import { useState, type ComponentType } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  CharacterIcon,
  ChatIcon,
  DiceIcon,
  PastRoomsIcon,
  PatternsIcon,
  RoomIcon,
  SettingsIcon,
  TranslateIcon,
  WelcomeIcon,
  type IconProps,
} from './icons'

// The tutorial card displays each step's icon at a poster-like size so
// the metaphor reads at a glance. Sized in one place so every step keeps
// the same visual weight.
const TUTORIAL_ICON_SIZE = 44

/** The walkthrough steps, also reused as the in-app help. Each step
 *  picks the same canonical icon used in the matching dock / chrome
 *  surface, so the tutorial mirrors what the user sees in the app. */
const STEPS: {
  Icon: ComponentType<IconProps>
  titleKey: string
  bodyKey: string
}[] = [
  { Icon: WelcomeIcon, titleKey: 'tutorial.welcome.title', bodyKey: 'tutorial.welcome.body' },
  { Icon: DiceIcon, titleKey: 'tutorial.dice.title', bodyKey: 'tutorial.dice.body' },
  { Icon: CharacterIcon, titleKey: 'tutorial.character.title', bodyKey: 'tutorial.character.body' },
  { Icon: PatternsIcon, titleKey: 'tutorial.patterns.title', bodyKey: 'tutorial.patterns.body' },
  { Icon: RoomIcon, titleKey: 'tutorial.room.title', bodyKey: 'tutorial.room.body' },
  { Icon: PastRoomsIcon, titleKey: 'tutorial.pastRooms.title', bodyKey: 'tutorial.pastRooms.body' },
  { Icon: ChatIcon, titleKey: 'tutorial.chat.title', bodyKey: 'tutorial.chat.body' },
  { Icon: TranslateIcon, titleKey: 'tutorial.translate.title', bodyKey: 'tutorial.translate.body' },
  { Icon: SettingsIcon, titleKey: 'tutorial.settings.title', bodyKey: 'tutorial.settings.body' },
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
  const CurrentIcon = current.Icon

  return (
    <div className="tutorial" role="dialog" aria-modal="true">
      <div className="tutorial-card">
        {!isLast && (
          <button type="button" className="link tutorial-skip" onClick={onClose}>
            {t('tutorial.skip')}
          </button>
        )}
        <div className="tutorial-icon" aria-hidden="true">
          <CurrentIcon size={TUTORIAL_ICON_SIZE} />
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
