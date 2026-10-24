import { useEffect, useMemo, useRef } from 'react'
import { ListTree, ShieldCheck } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '@/store/runStore'
import type { ActivityItem, CruxStore } from '@/store/types'
import { fmtClock } from '@/lib/format'
import { Dot, dotForTone } from '../common/StatusDot'
import { RunStats } from './RunStats'
import { ChecksTab, checksCount } from './ChecksTab'

const ACTIVE = new Set(['searching', 'reading', 'thinking', 'writing'])

/** Actors that are thinking right now; their latest feed item shows the live summary. */
function activeActors(s: CruxStore): string[] {
  const out: string[] = []
  if (s.phase === 'planning' || s.synthesisStatus === 'running') out.push('orchestrator')
  for (const a of Object.values(s.agents)) if (ACTIVE.has(a.status)) out.push(a.id)
  return out
}

/** Maps item id → live summary for the latest item of each active actor. */
function useLiveSummaries(items: ActivityItem[]): Map<string, string> {
  const actors = useCrux(useShallow(activeActors))
  const summaries = useCrux(useShallow((s) => actors.map((a) => s.reasoning[a]?.summary ?? null)))
  return useMemo(() => {
    const m = new Map<string, string>()
    actors.forEach((a, idx) => {
      const text = summaries[idx]
      if (!text) return
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].actorId === a) { m.set(items[i].id, text); break }
      }
    })
    return m
  }, [actors, summaries, items])
}

function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [dep])
  const onScroll = () => {
    const el = ref.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }
  return { ref, onScroll }
}

function SimpleFeed() {
  const activity = useCrux((s) => s.activity)
  const items = useMemo(() => activity.filter((i) => i.simple !== null), [activity])
  const live = useLiveSummaries(items)
  const trust = useCrux(useShallow((s) => {
    const fs = Object.values(s.findings)
    return { n: fs.length, ok: fs.filter((f) => f.checks.supported).length, x: s.contradictions.length }
  }))
  const setViewMode = useCrux((s) => s.setViewMode)
  const { ref, onScroll } = useAutoScroll(`${items.length}|${[...live.values()].join('|')}`)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4 pb-2"><div className="ui-label">What's happening</div></div>
      <div ref={ref} onScroll={onScroll} className="ui-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ul className="flex flex-col gap-3">
          {items.map((i) => (
            <li key={i.id} className="crux-node-enter grid grid-cols-[8px_minmax(0,1fr)] gap-2.5">
              <Dot kind={dotForTone(i.tone)} className="mt-[6px]" />
              <div className="min-w-0">
                <p className="text-[13px] leading-[19px] text-crux-text">{i.simple}</p>
                {live.has(i.id) ? (
                  <p className="mt-0.5 text-[12px] leading-4 text-crux-text-tertiary italic">{live.get(i.id)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {trust.n > 0 ? (
        <div className="flex-none border-t border-crux-border px-4 py-3">
          <p className={`text-[13px] leading-[19px] ${trust.ok === trust.n && trust.x === 0 ? 'text-crux-ok' : 'text-crux-warn'}`}>
            {trust.ok === trust.n ? `All ${trust.n} quotes checked` : `${trust.ok} of ${trust.n} quotes checked`}
            {trust.x > 0 ? ` · agents disagree on ${trust.x} point${trust.x === 1 ? '' : 's'}` : ''}
          </p>
          <button type="button" className="ui-link mt-1 text-[12px]" onClick={() => setViewMode('detailed')}>Show details</button>
        </div>
      ) : null}
    </div>
  )
}

function TimelineItem({ item, startedTs, live }: { item: ActivityItem; startedTs: number | null; live: string | null }) {
  const select = useCrux((s) => s.select)
  const body = (
    <>
      <span className="tm">{startedTs ? fmtClock(Math.max(0, item.ts - startedTs)) : '00:00'}</span>
      <span className="mk"><Dot kind={dotForTone(item.tone)} /></span>
      <span className="tx">
        {item.title}
        {item.detail ? <small>{item.detail}</small> : null}
        {live ? <small className="italic">{live}</small> : null}
      </span>
    </>
  )
  if (!item.nodeId) return <div className="ui-ev">{body}</div>
  const nodeId = item.nodeId
  return <button type="button" className="ui-ev click" onClick={() => select(nodeId)}>{body}</button>
}

function Timeline() {
  const activity = useCrux((s) => s.activity)
  const startedTs = useCrux((s) => s.startedTs)
  const live = useLiveSummaries(activity)
  const { ref, onScroll } = useAutoScroll(`${activity.length}|${[...live.values()].join('|')}`)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={ref} onScroll={onScroll} className="ui-scroll min-h-0 flex-1 overflow-y-auto px-4 py-1">
        {activity.map((i) => <TimelineItem key={i.id} item={i} startedTs={startedTs} live={live.get(i.id) ?? null} />)}
      </div>
      <div className="flex-none border-t border-crux-border px-4 py-3"><RunStats /></div>
    </div>
  )
}

export function ActivityRail() {
  const { phase, viewMode, railTab } = useCrux(useShallow((s) => ({ phase: s.phase, viewMode: s.viewMode, railTab: s.railTab })))
  const setRailTab = useCrux((s) => s.setRailTab)
  const nChecks = useCrux(checksCount)

  return (
    <aside aria-label="Activity" className="flex min-h-0 flex-col border-r border-crux-border bg-crux-surface">
      {phase === 'idle' ? (
        <div className="px-4 py-5">
          <div className="ui-label">What's happening</div>
          <p className="mt-2 text-[13px] leading-[19px] text-crux-text-tertiary">Agents appear here once Crux splits your decision into questions.</p>
        </div>
      ) : viewMode === 'simple' ? (
        <SimpleFeed />
      ) : (
        <>
          <div className="flex-none px-4 pt-3 pb-2">
            <div className="ui-seg" role="tablist">
              <button type="button" role="tab" aria-selected={railTab === 'timeline'} data-on={railTab === 'timeline'} onClick={() => setRailTab('timeline')}>
                <ListTree />Timeline
              </button>
              <button type="button" role="tab" aria-selected={railTab === 'checks'} data-on={railTab === 'checks'} onClick={() => setRailTab('checks')}>
                <ShieldCheck />Checks<span className={`n ${nChecks > 0 ? 'warn' : ''}`}>{nChecks}</span>
              </button>
            </div>
          </div>
          {railTab === 'timeline' ? <Timeline /> : <ChecksTab />}
        </>
      )}
    </aside>
  )
}
