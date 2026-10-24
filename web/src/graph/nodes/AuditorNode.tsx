import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ShieldCheck } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '../../store/runStore'
import type { CruxNode } from '../buildGraph'
import { NodeShell } from './NodeShell'
import { StagePill, firstWords } from './StagePill'
import { ModelBadge, NemotronTag } from './ModelBadge'

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
  const simple = useCrux((s) => s.viewMode === 'simple')

  if (simple) {
    const conflicts = status === 'ready' ? contradictions.length : 0
    if (conflicts > 0) {
      return (
        <NodeShell id={id} className="cx-node-auditor is-attention" label="Contradiction check">
          <StagePill state="attention" name="Auditor" text={`${conflicts} conflict${conflicts === 1 ? '' : 's'}`} />
          <div className="cx-aud-who">
            <ModelBadge family="minimax" />
            <span className="cx-ellipsis">a different lab checks DeepSeek's work</span>
          </div>
          <div className="cx-aud-list">
            {contradictions.slice(0, 2).map((c) => (
              <div key={c.id} className="cx-ellipsis" title={c.explanation}>
                <b>{c.findingIds.join(' vs ')}</b>: {firstWords(c.explanation, 7)}
              </div>
            ))}
          </div>
        </NodeShell>
      )
    }
    const [state, text] = status === 'failed' ? ['attention', 'check failed'] as const
      : status === 'ready' ? ['ok', 'no conflicts'] as const
      : checking ? ['working', 'checking…'] as const
      : ['waiting', 'waiting for agents'] as const
    return (
      <NodeShell id={id} className={`cx-node-pill is-${state}`} label="Contradiction check">
        <StagePill state={state} name={state === 'ok' ? 'Auditor (MiniMax)' : 'Auditor'} text={text}
          title={status === 'failed' && error ? error : 'Contradiction check · MiniMax, a different model family from the researchers'} />
      </NodeShell>
    )
  }

  return (
    <NodeShell id={id} className="cx-node-auditor" label="Contradiction check">
      <div className="cx-k">
        <ShieldCheck />
        Auditor
        <ModelBadge family="minimax" />
        <span className="cx-byline cx-ellipsis">· Contradiction check</span>
      </div>
      <div className="cx-aud-who" title="MiniMax M3.1 Flash, from a different lab, cross-examines every DeepSeek finding for contradictions">
        <span className="cx-ellipsis"><b>MiniMax M3.1</b> · a different lab checks DeepSeek's work</span>
        {status === 'ready' && (
          <span className={`cx-aud-count ${contradictions.length ? 'is-bad' : 'is-ok'}`}>
            {contradictions.length} conflict{contradictions.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="cx-body" style={{ marginTop: 'auto' }}>
        {waiting && <span className="cx-ellipsis">Waits for all agents to finish</span>}
        {checking && (
          <div className="cx-live">
            <span className="cx-dot cx-aud-pulse" />
            <span className="cx-ellipsis">{live || 'Checking findings against each other…'}</span>
            {live && <NemotronTag />}
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
