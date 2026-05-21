import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { useI18n } from './i18n/useI18n'
import { useSession } from './hooks/useSession'
import { useCharacters } from './characters/useCharacters'
import { rollPattern } from './dice/roll'
import type { Pattern } from './dice/types'
import { isTutorialSeen, markTutorialSeen } from './storage/tutorial'
import { loadCompactFeed, saveCompactFeed } from './storage/display'
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
  hidden: false,
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
  const [openSheet, setOpenSheet] = useState<SheetId | null>(null)
  const [showTutorial, setShowTutorial] = useState(() => !isTutorialSeen())
  // Denser feed layout — a display preference, so its toggle sits in the
  // settings menu while the feed itself consumes the value.
  const [compact, setCompact] = useState(loadCompactFeed)

  const { updateIdentity, setCharacterImage, resumeRoom } = session
  const activeName = characters.activeCharacter?.name
  const activeBackground = characters.activeCharacter?.background
  const activeImage = characters.activeCharacter?.image

  // Keep the synced identity in step with the active character...
  useEffect(() => {
    updateIdentity({ characterName: activeName ?? '', background: activeBackground ?? '' })
  }, [updateIdentity, activeName, activeBackground])

  // ...and sync the active character's portrait to the room.
  useEffect(() => {
    setCharacterImage(activeImage ?? '')
  }, [setCharacterImage, activeImage])

  // ...and with the chosen UI language.
  useEffect(() => {
    updateIdentity({ lang })
  }, [updateIdentity, lang])

  // When the page is opened (or reloaded) with a ?room= code, resume that
  // room automatically: re-host it if this tab was its GM, otherwise join.
  // The ref guards against React StrictMode running the effect twice in dev.
  const resumeDone = useRef(false)
  useEffect(() => {
    if (resumeDone.current) return
    resumeDone.current = true
    void resumeRoom(initialJoinCode)
  }, [initialJoinCode, resumeRoom])

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

  // Confirm before the page is left (reload, back, close) only while in a
  // room, so an active connection and its feed are not lost by accident.
  // Offline there is nothing live to protect, so the prompt is skipped.
  useEffect(() => {
    if (session.role === 'offline') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [session.role])

  // Clear the previous dismissal timer first, so a quick second toast is
  // not cut short by the earlier one's timer.
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flash = useCallback((text: string, kind: 'success' | 'error' = 'success') => {
    setNotice({ text, kind })
    clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2500)
  }, [])

  const rollerName = session.displayName || t('common.you')

  // Identity snapshot attached to a roll, so tapping the name later shows
  // the character used at that time rather than the current one.
  const roller = useMemo(
    () => ({
      id: session.playerId,
      name: rollerName,
      isGM: session.isGM,
      characterName: activeName ?? '',
      background: activeBackground ?? '',
    }),
    [session.playerId, session.isGM, rollerName, activeName, activeBackground],
  )

  const handleRoll = useCallback(
    (hidden: boolean) => {
      const result = rollPattern(draft, roller, hidden)
      session.roll(result)
      setOpenSheet(null) // return to the feed to see the result
    },
    [draft, roller, session],
  )

  const handleQuickRoll = useCallback(
    (p: Pattern) => {
      // A hidden pattern only rolls hidden for the GM; others roll it openly.
      const result = rollPattern(p, roller, p.hidden && session.isGM)
      session.roll(result)
      setOpenSheet(null)
    },
    [roller, session],
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
      hidden: p.hidden,
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

  // Persist the feed-density preference as it is toggled.
  const toggleCompact = () => {
    const next = !compact
    setCompact(next)
    saveCompactFeed(next)
  }

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
          compact={compact}
          onToggleCompact={toggleCompact}
          onOpenHelp={() => setShowTutorial(true)}
          onNotice={flash}
        />
      </header>

      {session.reconnecting && session.role === 'client' && (
        <p className="app-banner reconnecting" role="status">
          {t('room.gmOffline')}
        </p>
      )}

      {session.errorKind && (
        <p className="app-banner" role="alert">
          {session.errorKind === 'connect'
            ? t('room.error')
            : session.errorKind === 'codeTaken'
              ? t('room.codeTaken')
              : t('room.hostLost')}
          <button
            type="button"
            className="link icon-btn"
            aria-label={t('settings.close')}
            onClick={session.clearError}
          >
            <CloseIcon />
          </button>
        </p>
      )}

      <main className="app-main">
        <ActivityPanel
          session={session}
          characters={characters.characters}
          compact={compact}
          onNotice={flash}
          onOpenRoom={() => setOpenSheet('room')}
        />
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
              isGM={session.isGM}
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
