import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { useI18n } from './i18n/useI18n'
import { useSession } from './hooks/useSession'
import { useCharacters } from './characters/useCharacters'
import { rollPattern } from './dice/roll'
import type { Pattern } from './dice/types'
import { isTutorialSeen, markTutorialSeen } from './storage/tutorial'
import { CloseIcon } from './components/icons'
import { StatusBar } from './components/StatusBar'
import { NameGate } from './components/NameGate'
import { Tutorial } from './components/Tutorial'
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

interface Notice {
  text: string
  kind: 'success' | 'error'
}

/** Room code passed in via the URL (?room=CODE), if any. */
function roomCodeFromUrl(): string {
  return new URLSearchParams(window.location.search).get('room') ?? ''
}

function App() {
  const { t, lang } = useI18n()
  const session = useSession()
  const characters = useCharacters()
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [initialJoinCode] = useState(roomCodeFromUrl)
  const [openSheet, setOpenSheet] = useState<SheetId | null>(initialJoinCode ? 'room' : null)
  const [showTutorial, setShowTutorial] = useState(() => !isTutorialSeen())

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

  // Reflect the current room in the URL so it can be shared / bookmarked.
  const firstUrlSync = useRef(true)
  useEffect(() => {
    if (firstUrlSync.current) {
      firstUrlSync.current = false
      return
    }
    const base = window.location.pathname
    const url = session.roomCode ? `${base}?room=${session.roomCode}` : base
    window.history.replaceState(null, '', url)
  }, [session.roomCode])

  // Confirm before the page is left (reload, back, close) so the room
  // connection and feed are not lost by accident.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const flash = useCallback((text: string, kind: 'success' | 'error' = 'success') => {
    setNotice({ text, kind })
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
    const characterId = characters.activeId
    if (!characterId) {
      flash(t('pattern.needCharacter'), 'error')
      return
    }
    const name = draft.name.trim()
    if (!name) {
      flash(t('pattern.needName'), 'error')
      return
    }
    // A pattern with the same name and kind is treated as the same pattern.
    const existing = characters.activeCharacter?.patterns.find(
      (p) => p.name === name && p.kind === draft.kind,
    )
    if (existing) {
      if (!window.confirm(t('pattern.replaceConfirm', { name }))) return
      characters.updatePattern(characterId, existing.id, { ...draft, name })
      flash(t('toast.patternUpdated'))
    } else {
      characters.addPattern(characterId, { ...draft, name })
      flash(t('toast.patternSaved'))
    }
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

  const handleMovePattern = useCallback(
    (patternId: string, dir: -1 | 1) => {
      if (characters.activeId) characters.movePattern(characters.activeId, patternId, dir)
    },
    [characters],
  )

  const toggleSheet = (id: SheetId) => setOpenSheet((cur) => (cur === id ? null : id))

  return (
    <div className="app">
      <header className="app-header">
        <StatusBar
          status={session.status}
          roomCode={session.roomCode}
          roomName={session.roomName}
          playerCount={session.players.length}
          characterName={characters.activeCharacter?.name ?? ''}
          onOpenRoom={() => setOpenSheet('room')}
          onOpenCharacter={() => setOpenSheet('character')}
        />
        <SettingsMenu
          name={session.name}
          onChangeName={(next) => updateIdentity({ name: next })}
          onOpenHelp={() => setShowTutorial(true)}
        />
      </header>

      {session.errorKind && (
        <p className="app-banner" role="alert">
          {session.errorKind === 'connect' ? t('room.error') : t('room.hostLost')}
          <button
            type="button"
            className="link icon-x"
            aria-label={t('settings.close')}
            onClick={session.clearError}
          >
            <CloseIcon />
          </button>
        </p>
      )}

      <main className="app-main">
        <ActivityPanel session={session} />
      </main>

      <Dock active={openSheet} onOpen={toggleSheet} />

      {openSheet && (
        <Sheet onClose={() => setOpenSheet(null)}>
          {openSheet === 'room' && (
            <RoomPanel session={session} initialJoinCode={initialJoinCode} onNotice={flash} />
          )}
          {openSheet === 'character' && (
            <CharacterPanel characters={characters} onNotice={flash} />
          )}
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
              characterName={characters.activeCharacter?.name ?? ''}
              patterns={characters.activeCharacter?.patterns ?? []}
              onLoad={handleLoad}
              onQuickRoll={handleQuickRoll}
              onDelete={handleDeletePattern}
              onMove={handleMovePattern}
            />
          )}
        </Sheet>
      )}

      {notice && (
        <div className={`toast ${notice.kind}`} role="status">
          {notice.text}
        </div>
      )}

      {!session.name.trim() && (
        <NameGate onSubmit={(next) => updateIdentity({ name: next })} />
      )}

      {/* Tutorial waits until a player name exists so it never overlaps the gate. */}
      {showTutorial && session.name.trim() && (
        <Tutorial
          onClose={() => {
            setShowTutorial(false)
            markTutorialSeen()
          }}
        />
      )}
    </div>
  )
}

export default App
