import { useState, type ComponentType } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  CharacterIcon,
  ChatIcon,
  FogIcon,
  HelpIcon,
  PenIcon,
  PointerIcon,
  TabletopIcon,
  type IconProps,
} from './icons'

const TUTORIAL_ICON_SIZE = 44

/** Step deck specific to the tabletop. Smaller than the app-wide
 *  `Tutorial` (7 steps vs. 10) and focused on the tabletop chrome the
 *  user just opened — pan/zoom, tools, tokens, the right toolbar, the
 *  bottom dock — rather than the broader app flow.
 *  GM-only features are called out inline in the step bodies (see
 *  `tabletop.tutorial.*.body` translations) instead of being split into
 *  separate steps so first-time PLs and GMs share one tour. */
const STEPS: {
  Icon: ComponentType<IconProps>
  titleKey: string
  bodyKey: string
}[] = [
  {
    Icon: TabletopIcon,
    titleKey: 'tabletop.tutorial.welcome.title',
    bodyKey: 'tabletop.tutorial.welcome.body',
  },
  {
    Icon: PointerIcon,
    titleKey: 'tabletop.tutorial.viewport.title',
    bodyKey: 'tabletop.tutorial.viewport.body',
  },
  {
    Icon: PenIcon,
    titleKey: 'tabletop.tutorial.tools.title',
    bodyKey: 'tabletop.tutorial.tools.body',
  },
  {
    Icon: CharacterIcon,
    titleKey: 'tabletop.tutorial.tokens.title',
    bodyKey: 'tabletop.tutorial.tokens.body',
  },
  {
    Icon: FogIcon,
    titleKey: 'tabletop.tutorial.rightPanel.title',
    bodyKey: 'tabletop.tutorial.rightPanel.body',
  },
  {
    Icon: ChatIcon,
    titleKey: 'tabletop.tutorial.dock.title',
    bodyKey: 'tabletop.tutorial.dock.body',
  },
  {
    Icon: HelpIcon,
    titleKey: 'tabletop.tutorial.help.title',
    bodyKey: 'tabletop.tutorial.help.body',
  },
]

interface Props {
  onClose: () => void
}

/** First-time walkthrough of the tabletop. Reuses the existing
 *  `.tutorial-*` CSS chrome so the visual treatment matches the
 *  app-wide tutorial — only the step deck and copy differ. */
export function TabletopTutorial({ onClose }: Props) {
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
