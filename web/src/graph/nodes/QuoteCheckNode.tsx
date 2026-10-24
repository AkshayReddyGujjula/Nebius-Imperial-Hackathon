import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Quote } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '../../store/runStore'
import type { CruxNode } from '../buildGraph'
import { NodeShell } from './NodeShell'
import { StagePill } from './StagePill'

/** Deterministic quote check (code, no model): every finding's quote is matched against its source text. */
function QuoteCheckNodeImpl({ id }: NodeProps<CruxNode>) {
  const c = useCrux(useShallow((s) => {
    let verified = 0, partial = 0, missing = 0, total = 0
    for (const f of Object.values(s.findings)) {
      total++
      if (f.checks.quote === 'verified') verified++
      else if (f.checks.quote === 'partial') partial++
      else missing++
    }
    return { verified, partial, missing, total }
  }))
  const simple = useCrux((s) => s.viewMode === 'simple')
  const busy = useCrux((s) => s.phase === 'planning' || s.phase === 'researching')
  if (simple) {
    const state = c.total === 0 ? 'waiting' : busy ? 'working' : c.missing ? 'attention' : 'ok'
    const text = c.total === 0 ? 'waiting for findings' : `${c.verified + c.partial}/${c.total} verified`
    return (
      <NodeShell id={id} className={`cx-node-pill is-${state}`} label="Quote check">
        <StagePill state={state} name="Quote check" text={text} title="Code, no model: each quote must appear in its source" />
      </NodeShell>
    )
  }
  return (
    <NodeShell id={id} className="cx-node-qc" label="Quote check">
      <div className="cx-k">
        <Quote />
        Quote check
        <span className="cx-byline cx-ellipsis">· code, no model · quote must be in the source</span>
      </div>
      <div className="cx-qc-row" style={{ marginTop: 'auto' }}>
        {c.total === 0 ? (
          <span className="cx-body cx-muted">Waits for findings</span>
        ) : (
          <>
            <span className="cx-qc cx-qc-ok"><b>{c.verified}</b> verified</span>
            <span className="cx-qc cx-qc-warn"><b>{c.partial}</b> partial</span>
            <span className={`cx-qc ${c.missing ? 'cx-qc-bad' : ''}`}><b>{c.missing}</b> unverified</span>
            <span className="cx-qc-tot cx-meta-mono">of {c.total}</span>
          </>
        )}
      </div>
    </NodeShell>
  )
}

export const QuoteCheckNode = memo(QuoteCheckNodeImpl)
