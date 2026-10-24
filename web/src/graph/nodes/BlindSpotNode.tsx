import { memo, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Check, EyeOff, X } from 'lucide-react'
import { useCrux } from '../../store/runStore'
import { dismissBlindSpot, researchBlindSpot } from '../../lib/api'
import type { CruxNode } from '../buildGraph'
import { stop } from '../helpers'
import { StatusDot } from '../parts'
import { NodeShell } from './NodeShell'

function BlindSpotNodeImpl({ id }: NodeProps<CruxNode>) {
  const bs = useCrux((s) => s.plan?.blindSpot ?? null)
  const runId = useCrux((s) => s.runId)
  const mock = useCrux((s) => s.mock)
  const select = useCrux((s) => s.select)
  const [busy, setBusy] = useState(false)
  if (!bs) return null
  const live = !mock && !!runId

  const research = async () => {
    if (!live) return
    setBusy(true)
    try { await researchBlindSpot(runId) } catch (err) { console.warn('Research failed', err) } finally { setBusy(false) }
  }

  const dismiss = async () => {
    // DECISION: the mock run has no server, so Dismiss updates the store directly there.
    if (mock || !runId) {
      useCrux.setState((s) => (s.plan?.blindSpot
        ? { plan: { ...s.plan, blindSpot: { ...s.plan.blindSpot, status: 'dismissed' } }, selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId }
        : {}))
      return
    }
    setBusy(true)
    try { await dismissBlindSpot(runId) } catch (err) { console.warn('Dismiss failed', err) } finally { setBusy(false) }
  }

  return (
    <NodeShell id={id} className="cx-node-blind" label={`Blind spot: ${bs.text}`}>
      <div className="cx-k">
        <EyeOff />
        Blind spot
        <span className="cx-right">
          {bs.status === 'researching' && <StatusDot tone="active" label="Researching" />}
          {bs.status === 'answered' && <StatusDot tone="done" label="Answered" />}
        </span>
      </div>
      <div className="cx-title cx-clamp-3">
        <span className="cx-muted">You may be overlooking: </span>
        {bs.text}
      </div>
      <div className="cx-foot">
        {bs.status === 'answered' && bs.answer ? (
          <span className="cx-body cx-clamp-2" style={{ display: '-webkit-box' }} title={bs.answer}>
            <Check style={{ width: 13, height: 13, color: 'var(--crux-ok)', verticalAlign: '-2px', marginRight: 4 }} />
            {bs.answer}
          </span>
        ) : bs.status === 'open' ? (
          <div className="cx-row nodrag nopan" onPointerDown={stop} onClick={stop}>
            {bs.researchable && (
              <button type="button" className="cx-btn" disabled={busy || !live} onClick={research} title={live ? undefined : 'Not available in mock data'}>
                Research it
              </button>
            )}
            {/* Answer it opens the inspector, which owns the answer box (Lane W2). */}
            <button type="button" className="cx-btn" disabled={busy} onClick={() => select(id)}>Answer it</button>
            {bs.researchable ? (
              // DECISION: three worded buttons don't fit 232 px, so Dismiss becomes an icon button here.
              <button type="button" className="cx-btn cx-btn-ghost cx-btn-icon" disabled={busy} onClick={dismiss} aria-label="Dismiss" title="Dismiss"><X /></button>
            ) : (
              <button type="button" className="cx-btn cx-btn-ghost" disabled={busy} onClick={dismiss}>Dismiss</button>
            )}
          </div>
        ) : null}
      </div>
    </NodeShell>
  )
}

export const BlindSpotNode = memo(BlindSpotNodeImpl)
