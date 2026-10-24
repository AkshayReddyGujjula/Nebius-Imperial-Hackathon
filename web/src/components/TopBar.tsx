import { ChevronRight, Download, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '@/store/runStore'
import type { CruxStore } from '@/store/types'
import { selectTopStatus } from '@/store/selectors'
import { fmtClock } from '@/lib/format'
import { Dot, dotForTone } from './common/StatusDot'
import { useNow } from './useNow'

const API = import.meta.env.VITE_API_BASE ?? ''
const FINISHED = ['done', 'failed', 'timeout']

// Global progress: planning ~10%, researching 10→75% by agents finished, checking 80, writing 90, done 100.
// Follow-ups (re-synthesis, dig deeper, ladder) after the run show an indeterminate "Updating the brief…".
function progressOf(s: CruxStore): { pct: number; label: string; active: boolean } | null {
  const agents = Object.values(s.agents)
  const finished = agents.filter((a) => FINISHED.includes(a.status)).length
  switch (s.phase) {
    case 'idle': return null
    case 'planning': return { pct: 10, label: 'Planning', active: true }
    case 'researching': {
      const pct = agents.length ? 10 + 65 * (finished / agents.length) : 10
      return { pct, label: `Researching · ${finished} of ${agents.length} agents done`, active: true }
    }
    case 'checking': return { pct: 80, label: 'Checking citations', active: true }
    case 'synthesizing': return { pct: 90, label: 'Writing the brief', active: true }
    case 'error': return { pct: 100, label: 'Stopped', active: false }
    case 'done': {
      const ladderRunning = Object.values(s.ladders).some((l) => Object.values(l.arms).some((a) => a?.status === 'running'))
      const pending = agents.filter((a) => !FINISHED.includes(a.status))
      if (s.synthesisStatus === 'running') return { pct: 90, label: 'Updating the brief…', active: true }
      if (ladderRunning) return { pct: 60, label: 'Comparing effort levels…', active: true }
      if (pending.length) {
        return { pct: 10 + 80 * (finished / Math.max(1, agents.length)), label: `Digging deeper · ${pending.length} agent${pending.length === 1 ? '' : 's'} working`, active: true }
      }
      return { pct: 100, label: 'Done', active: false }
    }
  }
}

function simpleLabel(label: string): string {
  if (label === 'Done') return 'Brief ready'
  if (label === 'Checking citations') return 'Checking quotes'
  return label
}

export function TopBar({ onNewDecision }: { onNewDecision: () => void }) {
  const { phase, title, replay, mock, runId, viewMode } = useCrux(useShallow((s) => ({
    phase: s.phase, title: s.plan?.title ?? s.decision, replay: s.replay, mock: s.mock,
    runId: s.runId, viewMode: s.viewMode,
  })))
  const status = useCrux(useShallow((s) => {
    const t = selectTopStatus(s)
    return { label: t.label, tone: t.tone }
  }))
  const setViewMode = useCrux((s) => s.setViewMode)
  const running = phase !== 'idle' && phase !== 'done' && phase !== 'error'
  const now = useNow(running)
  const elapsed = useCrux((s) => selectTopStatus(s, running ? now : (s.doneTs ?? s.startedTs ?? now)).elapsedMs)
  const progress = useCrux(useShallow((s) => progressOf(s)))
  const kind = phase === 'done' ? 'ok' : phase === 'error' ? 'bad' : dotForTone(status.tone)
  const textTone = kind === 'active' ? 'text-crux-accent-text' : kind === 'ok' ? 'text-crux-ok' : kind === 'bad' ? 'text-crux-bad' : 'text-crux-text-secondary'

  return (
    <header className="dl-topbar col-span-3 flex h-[52px] min-w-0 items-center gap-4 px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="dl-mark grid size-[18px] flex-none place-items-center rounded-[4px]" aria-hidden="true">DL</span>
        <span className="whitespace-nowrap text-[15px] font-semibold">Decision Lab</span>
        {phase !== 'idle' && title ? (
          <>
            <ChevronRight className="dl-topbar-muted flex-none" />
            <span className="max-w-[460px] truncate text-[14px] font-medium" title={title}>{title}</span>
          </>
        ) : null}
      </div>

      {phase !== 'idle' ? (
        <div className="flex flex-none items-center gap-2">
          {replay ? <span className="ui-pill">Replay</span> : null}
          {mock ? <span className="ui-pill warn">Mock data</span> : null}
          {viewMode === 'simple' && progress ? (
            // Simple mode: one big phase line over the bar, always shown (incl. "Brief ready").
            <div className="dl-progress" data-active={progress.active} role="progressbar" aria-label={simpleLabel(progress.label)}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.pct)} style={{ minWidth: 280 }}>
              <span className={`text-[14px] font-semibold leading-[17px] ${progress.label === 'Stopped' ? 'text-crux-bad' : progress.label === 'Done' ? 'text-crux-ok' : 'text-crux-text'}`}>
                {simpleLabel(progress.label)}<span className="dl-topbar-muted font-normal"> · </span><span className="ui-num font-normal">{fmtClock(Math.max(0, elapsed))}</span>
              </span>
              <span className="dl-progress-track" style={{ height: 6 }}><span className="dl-progress-fill" style={{ width: `${progress.pct}%` }} /></span>
            </div>
          ) : progress && progress.label !== 'Done' && progress.label !== 'Stopped' ? (
            <div className="dl-progress" data-active={progress.active} role="progressbar" aria-label={progress.label}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.pct)}>
              <span className="dl-progress-label">{progress.label}<span className="dl-topbar-muted"> · </span><span className="ui-num">{fmtClock(Math.max(0, elapsed))}</span></span>
              <span className="dl-progress-track"><span className="dl-progress-fill" style={{ width: `${progress.pct}%` }} /></span>
            </div>
          ) : (
            <span className={`inline-flex items-center gap-1.5 text-[13px] ${textTone}`}>
              <Dot kind={kind} />
              <span>{status.label || 'Starting'}</span>
              <span className="dl-topbar-muted">·</span>
              <span className="ui-num">{fmtClock(Math.max(0, elapsed))}</span>
            </span>
          )}
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
        <a className="ui-btn icon" href={`${API}/api/runs/${runId}/export`} target="_blank" rel="noreferrer" download={`decision-lab-${runId}.jsonl`} title="Export the Decision Lab run log" aria-label="Export run log">
          <Download />
        </a>
      ) : null}
      {phase !== 'idle' ? (
        <button type="button" className="ui-btn" onClick={onNewDecision}><Plus />New decision</button>
      ) : null}
    </header>
  )
}
