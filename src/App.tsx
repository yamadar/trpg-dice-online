import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { useI18n } from './i18n/useI18n'
import { useSession } from './hooks/useSession'
import { useCharacters } from './characters/useCharacters'
import { rollPattern } from './dice/roll'
import type { Pattern } from './dice/types'
import { StatusBar } from './components/StatusBar'
import { SettingsMenu } from './components/SettingsMenu'
import { Dock, type SheetId } from './components/Dock'
import { Sheet } from './components/Sheet'
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
  const [openSheet, setOpenSheet] = useState<SheetId | null>(null)

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
      setOpenSheet(null) // return to the feed to see the result
    },
    [draft, rollerName, session],
  )

  const handleQuickRoll = useCallback(
    (p: Pattern) => {
      const result = rollPattern(p, { id: session.playerId, name: rollerName }, false)
      session.roll(result)
      setOpenSheet(null)
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

  // Loading a pattern into the builder opens the dice sheet to tweak/roll it.
  const handleLoad = useCallback((p: Pattern) => {
    setDraft({
      name: p.name,
      kind: p.kind,
      diceType: p.diceType,
      diceCount: p.diceCount,
      modifier: p.modifier,
    })
    setOpenSheet('dice')
  }, [])

  const handleDeletePattern = useCallback(
    (patternId: string) => {
      if (characters.activeId) characters.deletePattern(characters.activeId, patternId)
    },
    [characters],
  )

  const toggleSheet = (id: SheetId) => setOpenSheet((cur) => (cur === id ? null : id))

  return (
    <div className="app">
      <header className="app-header">
        <StatusBar
          roomCode={session.roomCode}
          playerCount={session.players.length}
          characterName={characters.activeCharacter?.name ?? ''}
        />
        <SettingsMenu
          name={session.name}
          onChangeName={(next) => updateIdentity({ name: next })}
        />
      </header>

      {session.errorKind && (
        <p className="app-banner" role="alert">
          {session.errorKind === 'connect' ? t('room.error') : t('room.hostLost')}
          <button type="button" className="link" onClick={session.clearError}>
            ×
          </button>
        </p>
      )}

      <main className="app-main">
        <ActivityPanel session={session} />
      </main>

      <Dock active={openSheet} onOpen={toggleSheet} />

      {openSheet && (
        <Sheet onClose={() => setOpenSheet(null)}>
          {openSheet === 'room' && <RoomPanel session={session} />}
          {openSheet === 'character' && <CharacterPanel characters={characters} />}
          {openSheet === 'dice' && (
            <DiceRoller
              draft={draft}
              onChange={setDraft}
              isGM={session.isGM}
              onRoll={handleRoll}
              onSave={handleSave}
            />
          )}
          {openSheet === 'patterns' && (
            <PatternList
              hasCharacter={characters.activeCharacter !== null}
              patterns={characters.activeCharacter?.patterns ?? []}
              onLoad={handleLoad}
              onQuickRoll={handleQuickRoll}
              onDelete={handleDeletePattern}
            />
          )}
        </Sheet>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}

export default App
