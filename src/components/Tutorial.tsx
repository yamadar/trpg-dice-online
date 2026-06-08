import { Fragment, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useDialogFocus } from '../hooks/useDialogFocus'
import {
  CharacterIcon,
  ChatIcon,
  DiceIcon,
  PastRoomsIcon,
  PatternsIcon,
  RoomIcon,
  SettingsIcon,
  TabletopIcon,
  TranslateIcon,
  WelcomeIcon,
  type IconProps,
} from './icons'

// The tutorial card displays each step's icon at a poster-like size so
// the metaphor reads at a glance. Sized in one place so every step keeps
// the same visual weight.
const TUTORIAL_ICON_SIZE = 44

// Sentinel character the localized "Settings & help" body uses to mark
// where the inline gear icon should land. Kept as the same `⚙` glyph
// the translators already wrote — that way the i18n dictionaries stay
// untouched and the render step just swaps the marker for a real
// `SettingsIcon` so it matches the header's Lucide gear.
const SETTINGS_GEAR_MARKER = '⚙'
const INLINE_GEAR_SIZE = 14

/** Render the tutorial body, swapping every `⚙` glyph for the live
 *  `SettingsIcon` so the inline reference reads as the real Lucide
 *  gear the header uses (rather than the emoji-ish glyph fonts render
 *  inconsistently across platforms). For bodies without the marker
 *  the original string is returned untouched. */
function renderTutorialBody(body: string): ReactNode {
  if (!body.includes(SETTINGS_GEAR_MARKER)) return body
  const parts = body.split(SETTINGS_GEAR_MARKER)
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        // The icon component owns its own `aria-hidden`; the wrapping
        // span just carries the layout class — IconProps does not
        // accept `className`, so the alignment hook lives one level
        // up where CSS can grab it.
        <span className="inline-gear">
          <SettingsIcon size={INLINE_GEAR_SIZE} />
        </span>
      )}
    </Fragment>
  ))
}

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
  { Icon: TabletopIcon, titleKey: 'tutorial.tabletop.title', bodyKey: 'tutorial.tabletop.body' },
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
  const dialogRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Move focus to the card on open, trap Tab within the dialog, and
  // restore focus to the trigger on close (the card holds focus first so
  // a screen reader announces the step title before the controls).
  useDialogFocus(dialogRef, { initialFocusRef: cardRef })

  // Close on Escape, like a standard modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="tutorial"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-tutorial-title"
      ref={dialogRef}
    >
      <div className="tutorial-card" ref={cardRef} tabIndex={-1}>
        {!isLast && (
          <button type="button" className="link tutorial-skip" onClick={onClose}>
            {t('tutorial.skip')}
          </button>
        )}
        <div className="tutorial-icon" aria-hidden="true">
          <CurrentIcon size={TUTORIAL_ICON_SIZE} />
        </div>
        <h2 id="app-tutorial-title">{t(current.titleKey)}</h2>
        <p className="tutorial-body">{renderTutorialBody(t(current.bodyKey))}</p>

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
