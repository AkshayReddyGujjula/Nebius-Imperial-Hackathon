import { ChevronRight, Download, Plus, Split } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '@/store/runStore'
import { selectTopStatus } from '@/store/selectors'
import { fmtClock } from '@/lib/format'
import { Dot, dotForTone } from './common/StatusDot'
import { useNow } from './useNow'

const API = import.meta.env.VITE_API_BASE ?? ''

export function TopBar({ onNewDecision }: { onNewDecision: () => void }) {
  const { phase, title, replay, mock, startedTs, doneTs, runId, viewMode } = useCrux(useShallow((s) => ({
    phase: s.phase, title: s.plan?.title ?? s.decision, replay: s.replay, mock: s.mock,
    startedTs: s.startedTs, doneTs: s.doneTs, runId: s.runId, viewMode: s.viewMode,
  })))
  const status = useCrux(useShallow((s) => {
    const t = selectTopStatus(s)
    return { label: t.label, tone: t.tone }
  }))
  const setViewMode = useCrux((s) => s.setViewMode)
  const running = phase !== 'idle' && phase !== 'done' && phase !== 'error'
  const now = useNow(running)
  const elapsed = startedTs ? (doneTs ?? (running ? now : startedTs)) - startedTs : 0
  const kind = phase === 'done' ? 'ok' : phase === 'error' ? 'bad' : dotForTone(status.tone)
  const textTone = kind === 'active' ? 'text-crux-accent-text' : kind === 'ok' ? 'text-crux-ok' : kind === 'bad' ? 'text-crux-bad' : 'text-crux-text-secondary'

  return (
    <header className="col-span-2 flex h-[52px] min-w-0 items-center gap-4 border-b border-crux-border bg-crux-surface px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-[22px] flex-none place-items-center rounded-[6px] bg-crux-text text-white">
          <Split className="!size-3" />
        </span>
        <span className="text-[15px] font-semibold">Crux</span>
        {phase !== 'idle' && title ? (
          <>
            <ChevronRight className="flex-none text-crux-text-quaternary" />
            <span className="max-w-[460px] truncate text-[14px] font-medium" title={title}>{title}</span>
          </>
        ) : null}
      </div>

      {phase !== 'idle' ? (
        <div className="flex flex-none items-center gap-2">
          {replay ? <span className="ui-pill">Replay</span> : null}
          {mock ? <span className="ui-pill warn">Mock data</span> : null}
          <span className={`inline-flex items-center gap-1.5 text-[13px] ${textTone}`}>
            <Dot kind={kind} />
            <span>{status.label || 'Starting'}</span>
            <span className="text-crux-text-quaternary">·</span>
            <span className="ui-num">{fmtClock(Math.max(0, elapsed))}</span>
          </span>
        </div>
      ) : null}

      <div className="flex-1" />

      <div className="ui-seg" role="radiogroup" aria-label="View mode">
        {(['simple', 'detailed'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={viewMode === m} data-on={viewMode === m}
            onClick={() => setViewMode(m)} title="Toggle with D">
            {m === 'simple' ? 'Simple' : 'Detailed'}
          </button>
        ))}
      </div>
      {viewMode === 'detailed' && runId && !mock ? (
        <a className="ui-btn icon" href={`${API}/api/runs/${runId}/export`} target="_blank" rel="noreferrer" title="Export run log" aria-label="Export run log">
          <Download />
        </a>
      ) : null}
      {phase !== 'idle' ? (
        <button type="button" className="ui-btn" onClick={onNewDecision}><Plus />New decision</button>
      ) : null}
    </header>
  )
}
