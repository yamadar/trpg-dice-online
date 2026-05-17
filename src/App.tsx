import { useCallback, useState } from 'react'
import './App.css'
import { useI18n } from './i18n/useI18n'
import { useSession } from './hooks/useSession'
import { usePatterns } from './hooks/usePatterns'
import { rollPattern } from './dice/roll'
import type { Pattern } from './dice/types'
import { LanguageToggle } from './components/LanguageToggle'
import { PlayerBar } from './components/PlayerBar'
import { RoomPanel } from './components/RoomPanel'
import { DiceRoller, type Draft } from './components/DiceRoller'
import { PatternList } from './components/PatternList'
import { HistoryPanel } from './components/HistoryPanel'
import { ChatPanel } from './components/ChatPanel'

const DEFAULT_DRAFT: Draft = {
  name: '',
  kind: 'damage',
  diceType: 'D6',
  diceCount: 1,
  modifier: 0,
}

function App() {
  const { t } = useI18n()
  const session = useSession()
  const { patterns, addPattern, deletePattern } = usePatterns()
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [notice, setNotice] = useState<string | null>(null)

  const flash = useCallback((msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 2500)
  }, [])

  const handleRoll = useCallback(
    (hidden: boolean) => {
      const result = rollPattern(
        draft,
        { id: session.playerId, name: session.name || t('common.you') },
        hidden,
      )
      session.roll(result)
    },
    [draft, session, t],
  )

  const handleSave = useCallback(() => {
    if (!draft.name.trim()) {
      flash(t('pattern.needName'))
      return
    }
    addPattern({ ...draft, name: draft.name.trim() })
  }, [draft, addPattern, flash, t])

  const handleLoad = useCallback((p: Pattern) => {
    setDraft({
      name: p.name,
      kind: p.kind,
      diceType: p.diceType,
      diceCount: p.diceCount,
      modifier: p.modifier,
    })
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1>{t('app.title')}</h1>
          <p className="tagline">{t('app.tagline')}</p>
        </div>
        <LanguageToggle />
      </header>

      <main className="layout">
        <div className="col">
          <PlayerBar name={session.name} onChangeName={session.setName} />
          <RoomPanel session={session} />
          <DiceRoller
            draft={draft}
            onChange={setDraft}
            isGM={session.isGM}
            onRoll={handleRoll}
            onSave={handleSave}
          />
          <PatternList patterns={patterns} onLoad={handleLoad} onDelete={deletePattern} />
        </div>
        <div className="col">
          <HistoryPanel history={session.history} isGM={session.isGM} onClear={session.clearHistory} />
          <ChatPanel chat={session.chat} playerId={session.playerId} onSend={session.sendChat} />
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
