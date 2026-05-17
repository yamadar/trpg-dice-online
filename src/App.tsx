import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { useI18n } from './i18n/useI18n'
import { useSession } from './hooks/useSession'
import { useCharacters } from './characters/useCharacters'
import { rollPattern } from './dice/roll'
import type { Pattern } from './dice/types'
import { SettingsMenu } from './components/SettingsMenu'
import { RoomPanel } from './components/RoomPanel'
import { CharacterPanel } from './components/CharacterPanel'
import { DiceRoller, type Draft } from './components/DiceRoller'
import { PatternList } from './components/PatternList'
import { ActivityPanel } from './components/ActivityPanel'

const DEFAULT_DRAFT: Draft = {
  name: '',
  kind: 'damage',
  diceType: 'D6',
  diceCount: 1,
  modifier: 0,
}

function App() {
  const { t, lang } = useI18n()
  const session = useSession()
  const characters = useCharacters()
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [notice, setNotice] = useState<string | null>(null)

  const { updateIdentity } = session
  const activeName = characters.activeCharacter?.name
  const activeBackground = characters.activeCharacter?.background

  // Keep the synced identity in step with the active character...
  useEffect(() => {
    updateIdentity({ characterName: activeName ?? '', background: activeBackground ?? '' })
  }, [updateIdentity, activeName, activeBackground])

  // ...and with the chosen UI language.
  useEffect(() => {
    updateIdentity({ lang })
  }, [updateIdentity, lang])

  const flash = useCallback((msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 2500)
  }, [])

  const rollerName = session.displayName || t('common.you')

  const handleRoll = useCallback(
    (hidden: boolean) => {
      const result = rollPattern(draft, { id: session.playerId, name: rollerName }, hidden)
      session.roll(result)
    },
    [draft, rollerName, session],
  )

  // Quick-roll a saved pattern directly, without loading it into the builder.
  const handleQuickRoll = useCallback(
    (p: Pattern) => {
      const result = rollPattern(p, { id: session.playerId, name: rollerName }, false)
      session.roll(result)
    },
    [rollerName, session],
  )

  const handleSave = useCallback(() => {
    if (!characters.activeId) {
      flash(t('pattern.needCharacter'))
      return
    }
    if (!draft.name.trim()) {
      flash(t('pattern.needName'))
      return
    }
    characters.addPattern(characters.activeId, { ...draft, name: draft.name.trim() })
  }, [draft, characters, flash, t])

  const handleLoad = useCallback((p: Pattern) => {
    setDraft({
      name: p.name,
      kind: p.kind,
      diceType: p.diceType,
      diceCount: p.diceCount,
      modifier: p.modifier,
    })
  }, [])

  const handleDeletePattern = useCallback(
    (patternId: string) => {
      if (characters.activeId) characters.deletePattern(characters.activeId, patternId)
    },
    [characters],
  )

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1>{t('app.title')}</h1>
          {characters.activeCharacter ? (
            <p className="acting-as">{t('character.actingAs', { name: session.displayName })}</p>
          ) : (
            <p className="tagline">{t('app.tagline')}</p>
          )}
        </div>
        <SettingsMenu
          name={session.name}
          onChangeName={(next) => updateIdentity({ name: next })}
        />
      </header>

      <main className="layout">
        <div className="col">
          <RoomPanel session={session} />
          <CharacterPanel characters={characters} />
          <DiceRoller
            draft={draft}
            onChange={setDraft}
            isGM={session.isGM}
            onRoll={handleRoll}
            onSave={handleSave}
          />
          <PatternList
            hasCharacter={characters.activeCharacter !== null}
            patterns={characters.activeCharacter?.patterns ?? []}
            onLoad={handleLoad}
            onQuickRoll={handleQuickRoll}
            onDelete={handleDeletePattern}
          />
        </div>
        <div className="col">
          <ActivityPanel session={session} />
        </div>
      </main>

      <footer className="app-footer">
        <span>TRPG Online Dice · MIT License</span>
        <a href="https://github.com/yamadar/trpg-dice-online" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}

export default App
