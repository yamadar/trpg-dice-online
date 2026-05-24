import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { useI18n } from './i18n/useI18n'
import { useSession } from './hooks/useSession'
import { useCharacters } from './characters/useCharacters'
import { rollPattern } from './dice/roll'
import type { Pattern } from './dice/types'
import { isTutorialSeen, markTutorialSeen } from './storage/tutorial'
import {
  loadBroadcastTyping,
  loadCompactFeed,
  loadShowTyping,
  saveBroadcastTyping,
  saveCompactFeed,
  saveShowTyping,
} from './storage/display'
import { useConfirm } from './hooks/useConfirm'
import {
  CharacterIcon,
  CloseIcon,
  DiceIcon,
  RoomIcon,
} from './components/icons'
import { StatusBar } from './components/StatusBar'
import { NameGate } from './components/NameGate'
import { Tutorial } from './components/Tutorial'
import { SettingsMenu } from './components/SettingsMenu'
import { Dock, type DockId, type SheetId } from './components/Dock'
import { Sheet } from './components/Sheet'
import { RoomPanel } from './components/RoomPanel'
import { RoomHistory } from './components/RoomHistory'
import { CharacterPanel } from './components/CharacterPanel'
import { type Draft } from './components/DiceRoller'
import { RollsPanel } from './components/RollsPanel'
import { ActivityPanel } from './components/ActivityPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TablePanel } from './components/TablePanel'
import type { SessionSummary } from './storage/roomLog'

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
  // Past-session browser. Rendered as a top-level page replacing the
  // ActivityPanel rather than nested inside the room Sheet, so the
  // multi-level navigation (sessions → feed → speaker detail) is not
  // competing with the Sheet's own close affordances. `historySession`
  // is the session whose feed is currently being viewed (controlled
  // here so the room Sheet can mirror it as a "past room" menu); null
  // while the user is browsing the session list.
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySession, setHistorySession] = useState<SessionSummary | null>(null)
  // Tabletop is a full-screen mode, not a Sheet — it takes over the
  // viewport (hiding the Dock and chat feed) so the map and tokens get
  // the entire screen. The Dock's tabletop button toggles this state
  // through `handleDock` below.
  const [tabletopOpen, setTabletopOpen] = useState(false)
  const [showTutorial, setShowTutorial] = useState(() => !isTutorialSeen())
  // Denser feed layout — a display preference, so its toggle sits in the
  // settings menu while the feed itself consumes the value.
  const [compact, setCompact] = useState(loadCompactFeed)
  // HSP-friendly typing-indicator preferences (see + be seen, split so a
  // sensitive user can opt out of either side independently — the
  // settings menu owns the toggles, the feed / chat composer consume them.
  const [showTyping, setShowTyping] = useState(loadShowTyping)
  const [broadcastTyping, setBroadcastTyping] = useState(loadBroadcastTyping)

  const { updateIdentity, setCharacterImage, resumeRoom } = session
  const activeCharacterId = characters.activeId ?? ''
  const activeName = characters.activeCharacter?.name
  const activeBackground = characters.activeCharacter?.background
  const activeImage = characters.activeCharacter?.image

  // Keep the synced identity in step with the active character...
  useEffect(() => {
    updateIdentity({
      characterId: activeCharacterId,
      characterName: activeName ?? '',
      background: activeBackground ?? '',
    })
  }, [updateIdentity, activeCharacterId, activeName, activeBackground])

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

  // The roll's speaker fields: (playerId, characterId) identify the
  // record the feed looks up the display name / background / portrait
  // from, and `isGM` captures the GM mark at the moment of the roll so
  // the feed renders the speaker's role as it was, independent of any
  // later role change.
  const roller = useMemo(
    () => ({
      id: session.playerId,
      characterId: activeCharacterId,
      isGM: session.isGM,
    }),
    [session.playerId, activeCharacterId, session.isGM],
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

  const confirm = useConfirm()
  const handleSave = useCallback(async () => {
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
      const ok = await confirm({ message: t('pattern.replaceConfirm', { name }) })
      if (!ok) return
      characters.updatePattern(characterId, existing.id, { ...draft, name })
      flash(t('toast.patternUpdated'))
    } else {
      characters.addPattern(characterId, { ...draft, name })
      flash(t('toast.patternSaved'))
    }
  }, [draft, characters, flash, t, confirm])

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

  // The Dock now hosts both Sheet-opening buttons and the full-screen
  // Tabletop. Route the tabletop click through a separate state; the
  // other ids pass through to `toggleSheet`. The two modes are kept
  // mutually exclusive — opening one closes the other — so the user
  // never has a Sheet rendered underneath a full-screen Tabletop (or
  // vice versa) where they cannot reach it.
  const handleDock = (id: DockId) => {
    if (id === 'tabletop') {
      setOpenSheet(null)
      setTabletopOpen((cur) => !cur)
      return
    }
    setTabletopOpen(false)
    toggleSheet(id)
  }

  // Opening the history closes the room Sheet so the full-screen browser
  // is unobstructed; the history's own back button returns to the feed.
  const openHistory = useCallback(() => {
    setOpenSheet(null)
    setHistoryOpen(true)
    setHistorySession(null)
  }, [])

  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
    setHistorySession(null)
  }, [])

  // Persist the feed-density preference as it is toggled.
  const toggleCompact = () => {
    const next = !compact
    setCompact(next)
    saveCompactFeed(next)
  }

  // Persist the typing-indicator preferences as they are toggled.
  const toggleShowTyping = () => {
    const next = !showTyping
    setShowTyping(next)
    saveShowTyping(next)
  }
  const toggleBroadcastTyping = () => {
    const next = !broadcastTyping
    setBroadcastTyping(next)
    saveBroadcastTyping(next)
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
          showTyping={showTyping}
          onToggleShowTyping={toggleShowTyping}
          broadcastTyping={broadcastTyping}
          onToggleBroadcastTyping={toggleBroadcastTyping}
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
        {historyOpen ? (
          <RoomHistory
            playerId={session.playerId}
            selected={historySession}
            onSelect={setHistorySession}
            onBack={closeHistory}
          />
        ) : (
          <ActivityPanel
            session={session}
            characters={characters.characters}
            compact={compact}
            showTyping={showTyping}
            broadcastTyping={broadcastTyping}
            onNotice={flash}
            onOpenRoom={() => setOpenSheet('room')}
          />
        )}
      </main>

      <Dock
        active={tabletopOpen ? 'tabletop' : openSheet}
        onOpen={handleDock}
      />

      {openSheet && (
        <Sheet
          title={t(
            openSheet === 'room'
              ? historySession
                ? 'room.pastSection'
                : 'room.section'
              : openSheet === 'character'
                ? 'character.section'
                : 'dice.section',
          )}
          titleIcon={
            openSheet === 'room' ? (
              <RoomIcon size={20} />
            ) : openSheet === 'character' ? (
              <CharacterIcon size={20} />
            ) : (
              <DiceIcon size={20} />
            )
          }
          onClose={() => setOpenSheet(null)}
        >
          {openSheet === 'room' && (
            <RoomPanel
              session={session}
              initialJoinCode={initialJoinCode}
              onNotice={flash}
              onOpenHistory={openHistory}
              historyOpen={historyOpen}
              historySession={historySession}
              onCloseHistory={closeHistory}
              onCloseHistorySession={() => {
                setHistorySession(null)
                setOpenSheet(null)
              }}
            />
          )}
          {openSheet === 'character' && (
            <CharacterPanel characters={characters} onNotice={flash} />
          )}
          {openSheet === 'dice' && (
            <RollsPanel
              draft={draft}
              onDraftChange={setDraft}
              isGM={session.isGM}
              onRoll={handleRoll}
              onSave={handleSave}
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

      {tabletopOpen && (
        // The tabletop is Konva-heavy and the most likely source of a
        // render-phase crash (bad image data, NaN coords from a broken
        // sync, etc.). Wrap it in an ErrorBoundary so a thrown error
        // surfaces a recovery card instead of unmounting the whole
        // app tree — the user can close the tabletop, clear the
        // offending background map, or just retry. The boundary
        // unmounts whenever `tabletopOpen` is false (see the `&&`
        // gate above), so any latched error state is discarded
        // implicitly on close — no `resetKey` needed.
        <ErrorBoundary
          fallback={({ error, reset }) => (
            <TabletopErrorFallback
              error={error}
              onRetry={reset}
              onClearMap={() => {
                session.clearMapBackground()
                reset()
              }}
              onClose={() => {
                setTabletopOpen(false)
                reset()
              }}
              hasMap={!!session.tabletop.map}
              canClearMap={session.role !== 'client'}
            />
          )}
        >
          <TablePanel
            session={session}
            onClose={() => setTabletopOpen(false)}
            characters={characters.characters}
            activeCharacterId={activeCharacterId}
            onNotice={flash}
            chatPanel={
              <ActivityPanel
                session={session}
                characters={characters.characters}
                compact={compact}
                showTyping={showTyping}
                broadcastTyping={broadcastTyping}
                onNotice={flash}
                onOpenRoom={() => setOpenSheet('room')}
              />
            }
            rollsPanel={
              <RollsPanel
                draft={draft}
                onDraftChange={setDraft}
                isGM={session.isGM}
                onRoll={handleRoll}
                onSave={handleSave}
                hasCharacter={characters.activeCharacter !== null}
                characterName={characters.activeCharacter?.name ?? ''}
                patterns={characters.activeCharacter?.patterns ?? []}
                onLoad={handleLoad}
                onQuickRoll={handleQuickRoll}
                onDelete={handleDeletePattern}
                onMove={handleMovePattern}
              />
            }
          />
        </ErrorBoundary>
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

interface TabletopErrorFallbackProps {
  error: Error
  onRetry: () => void
  onClearMap: () => void
  onClose: () => void
  hasMap: boolean
  /** Hide the "clear map" affordance for clients — they can't mutate
   *  the host-authoritative background. */
  canClearMap: boolean
}

/**
 * Recovery card shown when the tabletop's render tree throws. Kept in
 * App.tsx (not the boundary itself) so it can wire host-authoritative
 * recovery actions like clearing the background map; the boundary
 * itself stays generic.
 */
function TabletopErrorFallback({
  error,
  onRetry,
  onClearMap,
  onClose,
  hasMap,
  canClearMap,
}: TabletopErrorFallbackProps) {
  const { t } = useI18n()
  return (
    <div
      className="error-fallback"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="tabletop-error-title"
    >
      <div className="error-fallback-card">
        <h2 id="tabletop-error-title" className="error-fallback-title">
          {t('tabletop.error.title')}
        </h2>
        <p className="error-fallback-body">{t('tabletop.error.body')}</p>
        <div className="error-fallback-actions">
          <button
            type="button"
            className="primary"
            onClick={onRetry}
            autoFocus
          >
            {t('tabletop.error.retry')}
          </button>
          {canClearMap && hasMap && (
            <button type="button" onClick={onClearMap}>
              {t('tabletop.error.clearMap')}
            </button>
          )}
          <button type="button" onClick={onClose}>
            {t('tabletop.error.close')}
          </button>
        </div>
        <details className="error-fallback-details">
          <summary>{t('tabletop.error.details')}</summary>
          <pre>{error.stack ?? error.message}</pre>
        </details>
      </div>
    </div>
  )
}

export default App
