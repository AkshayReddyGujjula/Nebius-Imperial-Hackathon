import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ShieldCheck } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '../../store/runStore'
import type { CruxNode } from '../buildGraph'
import { NodeShell } from './NodeShell'

const MAX_SHOWN = 3

function AuditorNodeImpl({ id }: NodeProps<CruxNode>) {
  const { status, phase, contradictions, live, error } = useCrux(useShallow((s) => ({
    status: s.contradictionsStatus,
    phase: s.phase,
    contradictions: s.contradictions,
    live: s.reasoning.auditor?.summary ?? s.reasoning.auditor?.raw.trim().split(/[.\n]/).filter(Boolean).pop() ?? null,
    error: s.notices.filter((n) => n.level !== 'info' && /audit|contradict/i.test(n.message)).pop()?.message ?? null,
  })))
  const checking = status === 'idle' && phase === 'checking'
  const waiting = status === 'idle' && !checking

  return (
    <NodeShell id={id} className="cx-node-auditor" label="Contradiction check">
      <div className="cx-k">
        <ShieldCheck />
        Auditor
        <span className="cx-byline cx-ellipsis">· Contradiction check · MiniMax M3.1 Flash · different model family from the researchers</span>
      </div>
      <div className="cx-body" style={{ marginTop: 'auto' }}>
        {waiting && <span className="cx-ellipsis">Waits for all agents to finish</span>}
        {checking && (
          <div className="cx-live">
            <span className="cx-dot cx-aud-pulse" />
            <span className="cx-ellipsis">{live || 'Checking findings against each other…'}</span>
          </div>
        )}
        {status === 'failed' && (
          <span className="cx-ellipsis" style={{ color: 'var(--crux-bad)' }}>Contradiction check failed{error ? `: ${error}` : ''}</span>
        )}
        {status === 'ready' && contradictions.length === 0 && (
          <span style={{ color: 'var(--crux-ok)' }}>No contradictions found</span>
        )}
        {status === 'ready' && contradictions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <b className="cx-body-strong">{contradictions.length} contradiction{contradictions.length === 1 ? '' : 's'}</b>
            {contradictions.slice(0, MAX_SHOWN).map((c) => (
              <div key={c.id} className="cx-ellipsis" title={c.explanation}>
                {c.findingIds.join(' vs ')} — {c.explanation}
              </div>
            ))}
            {contradictions.length > MAX_SHOWN && <span>+{contradictions.length - MAX_SHOWN} more</span>}
          </div>
        )}
      </div>
    </NodeShell>
  )
}

export const AuditorNode = memo(AuditorNodeImpl)
