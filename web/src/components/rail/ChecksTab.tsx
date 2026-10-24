import { CircleX, GitCompareArrows, TriangleAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { nodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import type { CruxStore } from '@/store/types'
import { fmtMs, fmtTokens, fmtUsd } from '@/lib/format'
import { CitationChip } from '../common/CitationChip'
import { EffortBadge } from '../common/EffortBadge'

/** "Checks {n}": unsupported findings + contradictions. */
export function checksCount(s: CruxStore): number {
  let n = s.contradictions.length
  for (const f of Object.values(s.findings)) if (!f.checks.supported) n++
  return n
}

function qLabel(s: CruxStore, questionId: string): string {
  const i = s.plan?.questions.findIndex((q) => q.id === questionId) ?? -1
  return i >= 0 ? `Q${i + 1}` : questionId
}

const SEGMENTS = [
  { key: 'verified', label: 'Verified', color: 'var(--crux-ok)' },
  { key: 'partial', label: 'Close match', color: 'var(--crux-ok-border)' },
  { key: 'not_found', label: 'Not found', color: 'var(--crux-warn-bar)' },
  { key: 'no_quote', label: 'No quote', color: 'var(--crux-text-quaternary)' },
  { key: 'not_retrieved', label: 'Source not retrieved', color: 'var(--crux-bad)' },
] as const

export function ChecksTab() {
  const stats = useCrux((s) => s.stats)
  const findings = useCrux((s) => s.findings)
  const contradictions = useCrux((s) => s.contradictions)
  const select = useCrux((s) => s.select)
  const labels = useCrux(useShallow((s) => Object.fromEntries((s.plan?.questions ?? []).map((q) => [q.id, qLabel(s, q.id)]))))
  const agents = useCrux(useShallow((s) => Object.values(s.agents)))

  const all = Object.values(findings)
  const counts = { verified: 0, partial: 0, not_found: 0, no_quote: 0, not_retrieved: 0 }
  for (const f of all) {
    if (!f.checks.sourceRetrieved) counts.not_retrieved++
    else counts[f.checks.quote]++
  }
  const total = all.length

  const attention = [
    ...contradictions.map((x) => ({ kind: 'contradiction' as const, id: x.id, x })),
    ...all.filter((f) => !f.checks.sourceRetrieved).map((f) => ({ kind: 'not_retrieved' as const, id: f.id, f })),
    ...all.filter((f) => f.checks.sourceRetrieved && f.checks.quote === 'not_found').map((f) => ({ kind: 'not_found' as const, id: f.id, f })),
  ]

  const wall = stats?.agentPhaseWallMs ?? 0
  const seq = stats?.agentMsSum ?? 0
  const maxBar = Math.max(wall, seq, 1)

  return (
    <div className="ui-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="ui-kpi"><div className="l">Tokens</div><div className="v">{stats ? fmtTokens(stats.inputTokens + stats.outputTokens) : '–'}</div></div>
        <div className="ui-kpi"><div className="l">Cost</div><div className="v">{stats ? fmtUsd(stats.costUsd) : '–'}</div></div>
        <div className="ui-kpi"><div className="l">Calls</div><div className="v">{stats ? stats.llmCalls : '–'}</div></div>
        <div className="ui-kpi"><div className="l">Speed-up</div><div className="v">{stats ? `${stats.speedup.toFixed(1)}×` : '–'}</div></div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5 text-[12px] text-crux-text-secondary">
        {[['Parallel', wall, 'var(--crux-accent)'], ['Sequential', seq, 'var(--crux-text-quaternary)']].map(([l, v, c]) => (
          <div key={l as string} className="grid grid-cols-[68px_minmax(0,1fr)_52px] items-center gap-2">
            <span>{l}</span>
            <span className="h-2 overflow-hidden rounded-[3px] bg-crux-subtle">
              <span className="block h-full rounded-[3px] transition-[width] duration-300" style={{ width: `${((v as number) / maxBar) * 100}%`, background: c as string }} />
            </span>
            <span className="ui-num text-right">{fmtMs(v as number)}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 ui-label">Citations · {total}</div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-[3px] bg-crux-subtle">
        {SEGMENTS.map((sg) => counts[sg.key] > 0 ? (
          <span key={sg.key} style={{ width: `${(counts[sg.key] / Math.max(total, 1)) * 100}%`, background: sg.color }} className="h-full border-r border-crux-surface last:border-r-0" />
        ) : null)}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-crux-text-secondary">
        {SEGMENTS.map((sg) => (
          <li key={sg.key} className="flex items-center gap-1.5">
            <span className="size-2 flex-none rounded-[2px]" style={{ background: sg.color }} />
            <span className="min-w-0 flex-1 truncate">{sg.label}</span>
            <span className="ui-num text-crux-text">{counts[sg.key]}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 ui-label">Needs attention · {attention.length}</div>
      <div className="mt-2 flex flex-col gap-2">
        {attention.length === 0 ? <p className="text-[13px] text-crux-text-tertiary">Nothing flagged so far.</p> : null}
        {attention.map((a) => {
          if (a.kind === 'contradiction') {
            const [fa, fb] = a.x.findingIds
            const qa = findings[fa] ? labels[findings[fa].questionId] : '?'
            const qb = findings[fb] ? labels[findings[fb].questionId] : '?'
            return (
              <button key={a.id} type="button" className="ui-ck" onClick={() => select(nodeId.finding(fa))}>
                <div className="h text-crux-bad"><GitCompareArrows />Contradiction · {qa} ↔ {qb}</div>
                <div className="b ui-clamp-3">{a.x.explanation}</div>
              </button>
            )
          }
          const bad = a.kind === 'not_retrieved'
          return (
            <button key={a.id} type="button" className="ui-ck" onClick={() => select(nodeId.finding(a.f.id))}>
              <div className={`h ${bad ? 'text-crux-bad' : 'text-crux-warn'}`}>
                {bad ? <CircleX /> : <TriangleAlert />}
                {bad ? 'Source not retrieved' : 'Quote not found'} · {labels[a.f.questionId] ?? ''}
              </div>
              <div className="b ui-clamp-2">{a.f.claim}</div>
              <div className="mt-2"><CitationChip finding={a.f} /></div>
            </button>
          )
        })}
      </div>

      {agents.length > 0 ? (
        <>
          <div className="mt-5 ui-label">Effort used</div>
          <table className="mt-2 w-full text-[12px] text-crux-text-secondary">
            <thead>
              <tr className="text-left text-[11px] text-crux-text-tertiary">
                <th className="pb-1 font-medium">Branch</th><th className="pb-1 font-medium">Effort</th>
                <th className="pb-1 text-right font-medium">Reasoning</th><th className="pb-1 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-t border-crux-border">
                  <td className="py-1.5 font-medium text-crux-text">{labels[a.questionId] ?? a.questionId}</td>
                  <td className="py-1.5"><EffortBadge effort={a.effort} /></td>
                  <td className="ui-num py-1.5 text-right">{a.usage ? fmtTokens(a.usage.reasoningTokens) : '–'}</td>
                  <td className="ui-num py-1.5 text-right">{a.usage ? fmtMs(a.usage.ms) : a.endedAt ? fmtMs(a.endedAt - a.startedAt) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  )
}
