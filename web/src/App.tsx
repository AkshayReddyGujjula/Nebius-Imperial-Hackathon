import { useCallback, useEffect, useRef, useState } from 'react'
import { useCrux } from '@/store/runStore'
import { forgetActiveRun, resumeActiveRun, startReplay, startRun, stopRun } from '@/lib/api'
import { mockSpeedFromUrl, playMock } from '@/dev/mockRun'
import { Canvas } from '@/graph/Canvas'
import { TopBar } from '@/components/TopBar'
import { EmptyState } from '@/components/EmptyState'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { SummaryPanel } from '@/components/summary/SummaryPanel'
import { Inspector } from '@/components/inspector/Inspector'
import { useShortcuts } from '@/components/useShortcuts'
import { FeedRail } from '@/components/feed/FeedRail'
import { useFeedUi } from '@/components/feed/feedUi'
import '@/components/shell.css'

export default function App() {
  const phase = useCrux((s) => s.phase)
  const feedOpen = useFeedUi((s) => s.open)
  const [error, setError] = useState<string | null>(null)
  const cancelMock = useRef<(() => void) | null>(null)
  useShortcuts()

  useEffect(() => {
    const speed = mockSpeedFromUrl()
    if (speed) cancelMock.current = playMock(useCrux, speed)
    else void resumeActiveRun()
    return () => { cancelMock.current?.(); cancelMock.current = null }
  }, [])

  const run = useCallback(async (text: string) => {
    const mode = useCrux.getState().draftInputMode
    cancelMock.current?.(); cancelMock.current = null
    setError(null)
    try { await startRun(text, mode) } catch (e) {
      useCrux.getState().setDraft(text, mode)
      setError(`Couldn't start the run — ${e instanceof Error ? e.message : 'server unreachable'}.`)
    }
  }, [])

  const replay = useCallback(async (file: string) => {
    cancelMock.current?.(); cancelMock.current = null
    setError(null)
    try { await startReplay(file) } catch (e) {
      setError(`Couldn't start the replay — ${e instanceof Error ? e.message : 'server unreachable'}.`)
    }
  }, [])

  const newDecision = useCallback(() => {
    cancelMock.current?.(); cancelMock.current = null
    stopRun()
    forgetActiveRun()
    useCrux.getState().reset()
    setError(null)
  }, [])

  const idle = phase === 'idle'
  return (
    <div className={`dl-app grid h-dvh grid-rows-[52px_minmax(0,1fr)] overflow-hidden bg-crux-page text-crux-text transition-[grid-template-columns] duration-[240ms] ease-[cubic-bezier(.2,0,0,1)] ${idle ? 'grid-cols-[0px_minmax(0,1fr)_0px]' : feedOpen ? 'grid-cols-[420px_minmax(0,1fr)_clamp(300px,23vw,340px)]' : 'grid-cols-[420px_minmax(0,1fr)_44px]'}`}>
      <TopBar onNewDecision={newDecision} />
      <div className="min-h-0 min-w-0 overflow-hidden">{idle ? null : <ChatPanel />}</div>
      <main className="relative flex min-h-0 min-w-0 flex-col">
        {idle ? (
          <EmptyState onRun={run} onReplay={replay} error={error} />
        ) : (
          <>
            <div className="dl-fade-in relative min-h-0 flex-1"><Canvas /></div>
            <SummaryPanel />
          </>
        )}
        <Inspector />
      </main>
      <div className="min-h-0 min-w-0 overflow-hidden">{idle ? null : <FeedRail />}</div>
    </div>
  )
}
