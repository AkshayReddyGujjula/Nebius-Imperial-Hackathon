import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Split } from 'lucide-react'
import { useCrux } from '../../store/runStore'
import { fmtTokens, optionLetter } from '../../lib/format'
import type { CruxNode } from '../buildGraph'
import { NodeShell } from './NodeShell'

const MAX_FACTS = 4

function DecisionNodeImpl({ id }: NodeProps<CruxNode>) {
  const plan = useCrux((s) => s.plan)
  const decision = useCrux((s) => s.decision)
  const detailed = useCrux((s) => s.viewMode === 'detailed')
  const summary = useCrux((s) => s.reasoning.orchestrator?.summary ?? null)
  const reasoningTok = useCrux((s) => s.stats?.reasoningTokens ?? 0)
  const failed = useCrux((s) => s.phase === 'error' && !s.plan)

  const title = plan?.title || decision || 'Your decision'
  const facts = plan?.facts ?? []
  const extra = facts.length - MAX_FACTS

  return (
    <NodeShell id={id} className="cx-node-root" label={title}>
      <div className="cx-k">
        <Split />
        Decision
        {detailed && <span className="cx-byline cx-ellipsis" title="Planner: DeepSeek V4.1 Flash, max reasoning">
          · Planner · DeepSeek V4.1 Flash · max{plan ? ` — split into ${plan.questions.filter((q) => q.parentNodeId === null).length} questions, set each agent's effort` : ''}
        </span>}
        {detailed && !plan && (
          <span className="cx-right cx-meta-mono">{fmtTokens(reasoningTok)} reasoning tok</span>
        )}
      </div>
      <div className="cx-title cx-title-lg cx-clamp-2" title={title}>{title}</div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plan ? (
          <>
            {detailed && <div className="cx-chips">
              {facts.slice(0, MAX_FACTS).map((f) => (
                <span key={f.id} className="cx-chip" title={f.text}><span>{f.text}</span></span>
              ))}
              {extra > 0 && <span className="cx-chip cx-chip-more">+{extra}</span>}
            </div>}
            <div className="cx-chips">
              {plan.options.map((o, i) => (
                <span key={o.id} className="cx-chip" title={o.description}>
                  <b>{optionLetter(i)} ·</b><span>{o.label}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="cx-chips" aria-hidden>
              {[96, 120, 84, 108].map((w, i) => <span key={i} className="cx-skel-chip" style={{ width: w }} />)}
            </div>
            <div className="cx-live cx-body" style={{ height: 22 }}>
              {failed ? (
                <span className="cx-ellipsis" style={{ color: 'var(--crux-bad)' }}>Couldn't plan this decision.</span>
              ) : (
                <>
                  <span className="cx-dot" />
                  <span className="cx-ellipsis">{summary || 'Understanding your decision…'}</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </NodeShell>
  )
}

export const DecisionNode = memo(DecisionNodeImpl)
