import { ExternalLink } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { EFFORT_ORDER, type SourceRef } from '@shared/index'
import { useCrux } from '@/store/runStore'
import { selectQuestionLabel } from '@/store/selectors'
import { fmtMs } from '@/lib/format'
import { EffortBadge, effortWord } from '../common/EffortBadge'
import { StatusDot } from '../common/StatusDot'
import { FindingCard } from './FindingCard'
import { Header, List, RawReasoning, Sec, UsageLine, statusCopy } from './parts'
import type { ReactNode } from 'react'

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.length > 28 ? `${u.pathname.slice(0, 28)}…` : u.pathname
    return `${u.hostname.replace(/^www\./, '')}${path === '/' ? '' : path}`
  } catch { return url }
}

export function QuestionView({ questionId, onClose, actions }: { questionId: string; onClose: () => void; actions?: ReactNode }) {
  const detailed = useCrux((s) => s.viewMode === 'detailed')
  const q = useCrux((s) => s.plan?.questions.find((x) => x.id === questionId))
  const label = useCrux((s) => selectQuestionLabel(s, questionId))
  const agent = useCrux((s) => s.agents[s.agentByQuestion[questionId] ?? ''])
  const status = useCrux((s) => statusCopy(s, s.agentByQuestion[questionId]))
  const findings = useCrux(useShallow((s) => (agent?.findingIds ?? []).map((id) => s.findings[id]).filter(Boolean)))
  const searches = useCrux(useShallow((s) => (agent?.searchIds ?? []).map((id) => s.searches[id]).filter(Boolean)))
  if (!q) return null

  const cited = new Set(findings.map((f) => f.sourceId))
  const sources = new Map<string, SourceRef>()
  for (const se of searches) for (const src of se.sources) if (!sources.has(src.id)) sources.set(src.id, src)
  const sortedSources = [...sources.values()].sort((a, b) => Number(cited.has(b.id)) - Number(cited.has(a.id)))
  const capped = q.effortRequested !== q.effort && EFFORT_ORDER.indexOf(q.effortRequested) > EFFORT_ORDER.indexOf(q.effort)

  return (
    <>
      <Header kind={`Question${label ? ` · ${label}` : ''}`} onClose={onClose} />
      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
        <Sec>
          <h2 className="text-[17px] leading-6 font-semibold">{q.text}</h2>
          {q.why ? <p className="mt-2 text-[13px] leading-[19px] text-crux-text-secondary"><span className="text-crux-text-tertiary">Why it matters: </span>{q.why}</p> : null}
          <div className="mt-3 flex flex-col gap-1.5">
            <EffortBadge effort={q.effort} reason={q.effortReason} />
            {capped ? (
              <p className="text-[12px] leading-4 text-crux-text-tertiary">
                Orchestrator asked for {effortWord(q.effortRequested)}; capped to {effortWord(q.effort)} by the run budget.
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <StatusDot status={agent?.status ?? 'queued'} />
              {agent && agent.status !== 'done' && agent.status !== 'queued' ? <span className="min-w-0 truncate text-[12px] text-crux-text-tertiary">{status}</span> : null}
            </div>
            {detailed ? <UsageLine usage={agent?.usage} /> : null}
          </div>
          {actions ? <div className="mt-3 flex flex-col gap-2">{actions}</div> : null}
        </Sec>

        {agent?.answer ? (
          <Sec title="Answer"><p className="text-[14px] leading-5 text-crux-text">{agent.answer}</p></Sec>
        ) : null}

        <Sec title={`Findings · ${findings.length}`}>
          {findings.length === 0 ? (
            agent?.status === 'done' || agent?.status === 'failed' || agent?.status === 'timeout' ? (
              <p className="text-[13px] text-crux-text-tertiary">No findings were submitted.</p>
            ) : (
              <div className="flex flex-col gap-2" aria-busy="true">
                <p className="flex items-center gap-2 text-[12px] text-crux-text-tertiary"><StatusDot status={agent?.status ?? 'queued'} /><span className="truncate">{status}</span></p>
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-[8px] border border-crux-border p-3">
                    <div className="ui-skel shimmer w-4/5" />
                    <div className="ui-skel shimmer mt-2 w-3/5" />
                    <div className="ui-skel shimmer mt-3 h-[18px] w-24 rounded-[6px]" />
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2">{findings.map((f, i) => <FindingCard key={f.id} finding={f} n={i + 1} />)}</div>
          )}
        </Sec>

        {agent?.gaps.length ? <Sec title="Gaps"><List items={agent.gaps} /></Sec> : null}

        {sortedSources.length > 0 ? (
          <Sec title={`Sources · ${sortedSources.length}`}>
            <ul className="flex flex-col">
              {sortedSources.map((src) => (
                <li key={src.id}>
                  <a href={src.url} target="_blank" rel="noreferrer" title={src.title}
                    className="group flex items-center gap-2 rounded-[6px] py-1 text-[12px] hover:text-crux-accent-text">
                    <span className="ui-mono min-w-0 flex-1 truncate text-crux-text-secondary group-hover:text-crux-accent-text">{shortUrl(src.url)}</span>
                    {cited.has(src.id) ? <span className="ui-tag neutral">cited</span> : null}
                    <ExternalLink className="!size-3.5 flex-none text-crux-text-quaternary group-hover:text-crux-accent-text" />
                  </a>
                </li>
              ))}
            </ul>
          </Sec>
        ) : null}

        {detailed && searches.length > 0 ? (
          <Sec title="Searches">
            <table className="w-full text-[12px]">
              <tbody>
                {searches.map((se) => (
                  <tr key={se.id} className="border-t border-crux-border first:border-t-0 align-top">
                    <td className="py-1.5 pr-2 text-crux-text-tertiary">R{se.round}</td>
                    <td className="ui-mono py-1.5 pr-2 text-[11px] text-crux-text-secondary">
                      {se.query}
                      {se.error ? <span className="block font-sans text-crux-bad">{se.error}</span> : null}
                    </td>
                    <td className="ui-num py-1.5 pr-2 text-right whitespace-nowrap text-crux-text-tertiary">{se.status === 'running' ? '…' : `${se.sources.length} res`}</td>
                    <td className="ui-num py-1.5 text-right whitespace-nowrap text-crux-text-tertiary">{se.status === 'running' ? '' : fmtMs(se.ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sec>
        ) : null}

        {detailed && agent ? <Sec><RawReasoning actorId={agent.id} label={label || 'agent'} /></Sec> : null}
      </div>
    </>
  )
}
