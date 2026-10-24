import { memo, useEffect, useState, type ReactNode } from 'react'
import type { NodeProps } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BadgeCheck, TriangleAlert } from 'lucide-react'
import type { SourceRef } from '@shared/index'
import { useCrux } from '../../store/runStore'
import { selectQuestionTrust } from '../../store/selectors'
import { fmtMs, fmtTokens } from '../../lib/format'
import type { CruxNode } from '../buildGraph'
import { agentColor, agentNumber, disagreesWith, modelName, qLabel } from '../helpers'
import { AgentBadge, SourceChip, StatePill, TypeOut, pillState } from '../parts'
import { NodeShell } from './NodeShell'
import '../activity.css'

function QuestionNodeImpl({ id, data }: NodeProps<CruxNode>) {
  const qid = data.refId ?? ''
  const detailed = useCrux((s) => s.viewMode === 'detailed')
  const question = useCrux((s) => s.plan?.questions.find((q) => q.id === qid))
  const label = useCrux((s) => qLabel(s.plan, qid))
  const agent = useCrux((s) => s.agents[s.agentByQuestion[qid]])
  const summary = useCrux((s) => {
    const a = s.agentByQuestion[qid]
    return a ? s.reasoning[a]?.summary ?? null : null
  })
  if (!question) return null

  const status = agent?.status ?? null
  const deeper = question.origin === 'dig_deeper'
  const agentId = agent?.id ?? null
  const total = 1 + (agent?.extraRounds ?? 0)

  return (
    <NodeShell id={id} dim={question.stale} label={question.text} accent={agentId ? agentColor(agentId) : undefined}>
      <div className="cx-k">
        {agentId && <AgentBadge agentId={agentId} />}
        <span className="cx-agent-name">{agentId ? `Agent ${agentNumber(agentId)}` : 'Waiting for an agent'}</span>
        {detailed && <span className="cx-mono cx-ellipsis">{deeper ? `${label} · deeper` : label}</span>}
        {!detailed && deeper && <span className="cx-ellipsis">Deeper</span>}
        {question.stale && <span className="cx-tag">Superseded</span>}
        <span className="cx-right">
          <StatePill state={pillState(status)} progress={agentProgress(status, agent?.round ?? 0, total)} />
        </span>
      </div>
      <div className="ax-who" title={agentLine(agentId, agent?.model, question.effort)}>
        <b>{modelName(agent?.model || 'deepseek')}</b> · effort {EFFORT_WORD[question.effort]}
        {detailed && agent?.usage ? ` · ${fmtTokens(agent.usage.outputTokens)} tok · ${fmtMs(agent.usage.ms)}` : ''}
      </div>
      <div className="cx-title cx-clamp-2">{question.text}</div>
      {agent ? (
        <AgentActivity agentId={agent.id} questionId={qid} total={total} summary={summary} />
      ) : (
        <div className="ax-panel"><div className="ax-text">Waiting to start</div></div>
      )}
    </NodeShell>
  )
}

const EFFORT_WORD = { low: 'Low', high: 'High', max: 'Max' } as const

/** Tooltip: "Agent 1 · DeepSeek V4.1 Flash · High effort". */
function agentLine(agentId: string | null, model: string | undefined, effort: keyof typeof EFFORT_WORD): string {
  if (!agentId) return 'Waiting for an agent'
  return `Agent ${agentNumber(agentId)} · ${modelName(model || 'deepseek')} · ${EFFORT_WORD[effort]} effort`
}

/** Rough 0..1 progress for the pill ring: rounds × (search → read → think), then writing. */
function agentProgress(status: string | null, round: number, total: number): number {
  const r = Math.min(Math.max(round, 1), total)
  const stage: Record<string, number> = { searching: 0.25, reading: 0.55, thinking: 0.85 }
  switch (status) {
    case 'searching': case 'reading': case 'thinking':
      return (((r - 1) + stage[status]) / total) * 0.85
    case 'writing': return 0.92
    case 'done': case 'failed': case 'timeout': return 1
    default: return 0
  }
}

const isVerified = (q: string) => q === 'verified' || q === 'partial'

function AgentActivity({ agentId, questionId, total, summary }: {
  agentId: string; questionId: string; total: number; summary: string | null
}) {
  const agent = useCrux((s) => s.agents[agentId])
  const searches = useCrux(useShallow((s) => (s.agents[agentId]?.searchIds ?? []).map((sid) => s.searches[sid]).filter(Boolean)))
  const lastFinding = useCrux((s) => {
    const ids = s.agents[agentId]?.findingIds ?? []
    return ids.length ? s.findings[ids[ids.length - 1]] : undefined
  })
  const reduce = useReducedMotion()

  // Unique sources across this agent's searches, newest search first.
  const seen = new Set<string>()
  const sources: SourceRef[] = []
  for (let i = searches.length - 1; i >= 0; i--) {
    for (const src of searches[i].sources) if (!seen.has(src.id)) { seen.add(src.id); sources.push(src) }
  }
  const current = searches[searches.length - 1]
  const status = agent?.status ?? 'queued'
  const newest = Math.min(current?.sources.length ?? 0, 6)
  const readIdx = useCycle(status === 'reading' ? newest : 0)
  const findingCount = agent?.findingIds.length ?? 0
  const sourcesRead = Math.max(agent?.sourcesRead ?? 0, status === 'done' ? sources.length : 0)
  const round = Math.min(Math.max(current?.round ?? agent?.round ?? 1, 1), total)

  const strip = sources.length > 0 && (
    <div className="ax-strip nowheel nodrag">
      <AnimatePresence initial={false}>
        {sources.slice(0, 12).map((src, i) => (
          <motion.span key={src.id} layout={!reduce} style={{ display: 'inline-flex', flex: 'none' }}
            initial={reduce ? false : { opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: reduce ? 0 : Math.min(i, 6) * 0.07, ease: [0.2, 0, 0, 1] }}>
            <SourceChip domain={src.domain} title={src.title} reading={status === 'reading' && i === readIdx} />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )

  const findingChip = lastFinding && (
    <motion.span key={lastFinding.id}
      initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: reduce ? 1 : [0.6, 1.08, 1] }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`ax-fchip ${isVerified(lastFinding.checks.quote) ? 'ax-fchip-ok' : 'ax-fchip-warn'}`}
      title={lastFinding.claim}>
      {isVerified(lastFinding.checks.quote)
        ? <><BadgeCheck />Finding {lastFinding.id} · quote verified ✓</>
        : <><TriangleAlert />Finding {lastFinding.id} · {lastFinding.checks.sourceRetrieved ? 'not found ⚠' : 'source missing ⚠'}</>}
    </motion.span>
  )

  let body: ReactNode
  switch (status) {
    case 'searching':
      body = (
        <>
          <div className="ax-label">Searching the web<span className="ax-count">search {round} of {total}</span></div>
          <div className="ax-query is-live">{current ? <TypeOut text={current.query} /> : <span className="ax-caret" />}</div>
          {findingChip}
        </>
      )
      break
    case 'reading':
      body = (
        <>
          <div className="ax-label">Reading sources<span className="ax-count">{sourcesRead} source{sourcesRead === 1 ? '' : 's'} read</span></div>
          {strip}
          {findingChip}
        </>
      )
      break
    case 'thinking':
      body = (
        <>
          <div className="ax-label">Thinking<span className="ax-count">search {round} of {total}</span></div>
          <div className="ax-think">
            {summary ? <TypeOut key={summary} text={summary} cps={60} /> : <>Weighing what the sources say<span className="ax-caret" aria-hidden /></>}
          </div>
          {findingChip}
        </>
      )
      break
    case 'writing':
      body = (
        <>
          <div className="ax-label">Writing up findings<span className="ax-count">{findingCount} so far</span></div>
          {strip}
          {findingChip}
        </>
      )
      break
    case 'done':
    case 'timeout':
      body = (
        <>
          <div className="ax-label">
            {status === 'done' ? 'Finished' : 'Ran out of time'}
            <span className="ax-count">{findingCount} finding{findingCount === 1 ? '' : 's'} · {sources.length} sources</span>
          </div>
          <div className="ax-text is-strong cx-clamp-2" title={agent?.answer}>{agent?.answer || (status === 'done' ? 'Finished.' : 'Partial results only.')}</div>
          <div className="cx-foot"><TrustLine questionId={questionId} /></div>
        </>
      )
      break
    case 'failed':
      body = (
        <>
          <div className="ax-label" style={{ color: 'var(--crux-bad)' }}>Couldn&apos;t finish</div>
          <div className="ax-text is-bad ax-scroll nowheel">{agent?.error ?? agent?.note ?? 'Something went wrong.'}</div>
        </>
      )
      break
    default:
      body = <div className="ax-text">Waiting to start</div>
  }
  return <div className="ax-panel">{body}</div>
}

/** Cycles 0..n-1 every 900 ms (which chip is "being read"). */
function useCycle(n: number): number {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (n <= 1) { setI(0); return }
    const t = setInterval(() => setI((k) => (k + 1) % n), 900)
    return () => clearInterval(t)
  }, [n])
  return n > 0 ? i % n : -1
}

function TrustLine({ questionId }: { questionId: string }) {
  const t = useCrux(useShallow((s) => selectQuestionTrust(s, questionId)))
  const others = useCrux(useShallow((s) => disagreesWith(s, questionId)))
  const suffix = others.length ? ` · disagrees with ${others.join(', ')}` : ''
  if (t.findings === 0) return <span className="cx-trust cx-trust-neutral cx-ellipsis">No cited findings{suffix}</span>
  const warn = t.unverified > 0 || others.length > 0
  const text = t.unverified > 0
    ? `${t.unverified} of ${t.findings} quotes couldn't be verified`
    : `${t.sources} source${t.sources === 1 ? '' : 's'} · all quotes checked`
  const full = text + suffix
  return (
    <span className={`cx-trust ${warn ? 'cx-trust-warn' : 'cx-trust-ok'}`} title={full}>
      {warn ? <TriangleAlert /> : <BadgeCheck />}
      <span className="cx-ellipsis">{full}</span>
    </span>
  )
}

export const QuestionNode = memo(QuestionNodeImpl)
