import { clip } from '@/lib/format'
import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { BadgeCheck, TriangleAlert } from 'lucide-react'
import { useCrux } from '../../store/runStore'
import { selectQuestionTrust } from '../../store/selectors'
import { fmtMs, fmtTokens } from '../../lib/format'
import type { CruxNode } from '../buildGraph'
import { agentColor, agentNumber, disagreesWith, modelName, qLabel } from '../helpers'
import { AgentBadge, EffortBadge, StatusDot, dotTone, statusWord } from '../parts'
import { NodeShell } from './NodeShell'

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
  const tone = dotTone(status)
  const failed = tone === 'failed'
  const deeper = question.origin === 'dig_deeper'
  const agentId = agent?.id ?? null
  
  const modelLine = agentId ? (
    <span className="cx-model cx-ellipsis" title={agentLine(agentId, agent?.model, question.effort, false)}>
      {modelName(agent?.model || 'deepseek')}
    </span>
  ) : null

  return (
    <NodeShell id={id} dim={question.stale} label={question.text} accent={agentId ? agentColor(agentId) : undefined}>
      <div className="cx-k">
        {agentId && <AgentBadge agentId={agentId} />}
        <span className="cx-agent-name">{agentId ? `Agent ${agentNumber(agentId)}` : 'Waiting for an agent'}</span>
        {agentId && !detailed && <span className="cx-effpill" title={`${EFFORT_WORD[question.effort]} effort`}>{EFFORT_WORD[question.effort]}</span>}
        {detailed && <span className="cx-mono cx-ellipsis">{deeper ? `${label} · deeper` : label}</span>}
        {!detailed && deeper && <span className="cx-ellipsis">Deeper</span>}
        {question.stale && <span className="cx-tag">Superseded</span>}
        <span className="cx-right">
          <StatusDot tone={tone} label={statusWord(status, agent?.sourcesRead)} />
        </span>
      </div>
      <div className="cx-title cx-clamp-3">{question.text}</div>

      {detailed ? (
        <>
          <div className="cx-row" style={{ marginTop: 8 }}>
            <EffortBadge effort={question.effort} />
            <span className="cx-body cx-muted cx-ellipsis" style={{ fontSize: 12 }} title={question.effortReason}>
              {question.effortReason}
            </span>
          </div>
          <div className="cx-foot cx-foot-col">
            {modelLine}
            <span className="cx-meta-mono">
              {agent?.usage
                ? `${fmtTokens(agent.usage.outputTokens)} tok · ${fmtMs(agent.usage.ms)}`
                : agent && tone === 'active'
                  ? `round ${Math.max(agent.round, 1)} · ${agent.sourcesRead} sources`
                  : failed && agent?.error
                    ? agent.error
                    : 'not started'}
            </span>
          </div>
        </>
      ) : (
        <>
          <div
            className={`cx-body cx-clamp-2${status === 'done' ? ' cx-body-strong' : ''}`}
            style={{ marginTop: 6, color: failed ? 'var(--crux-bad)' : undefined }}
          >
            {simpleLine(status, agent?.sourcesRead ?? 0, summary, agent?.answer, agent?.error ?? agent?.note ?? null)}
          </div>
          <div className="cx-foot cx-foot-col">
            {modelLine}
            {status === 'done' || status === 'timeout' ? <TrustLine questionId={qid} /> : null}
          </div>
        </>
      )}
    </NodeShell>
  )
}

const EFFORT_WORD = { low: 'Low', high: 'High', max: 'Max' } as const

/** Tooltip: "Agent 1 · DeepSeek V4.1 Flash · High effort". */
function agentLine(agentId: string | null, model: string | undefined, effort: keyof typeof EFFORT_WORD, _full: boolean): string {
  if (!agentId) return 'Waiting for an agent'
  return `Agent ${agentNumber(agentId)} · ${modelName(model || 'deepseek')} · ${EFFORT_WORD[effort]} effort`
}

function simpleLine(
  status: string | null, sourcesRead: number, summary: string | null,
  answer: string | undefined, reason: string | null,
): string {
  switch (status) {
    case 'searching': return 'Searching the web…'
    case 'reading': return sourcesRead > 0 ? `Reading ${sourcesRead} sources…` : 'Reading sources…'
    case 'thinking': return summary || 'Thinking…'
    case 'writing': return 'Writing up findings…'
    case 'done': return answer || 'Finished.'
    case 'failed': return `Couldn't finish — ${shortReason(reason)}`
    case 'timeout': return 'Ran out of time — partial results'
    default: return 'Waiting to start'
  }
}

const shortReason = (r: string | null) => (r ? clip(r, 60) : 'something went wrong')

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
