import { memo, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Sparkles, TriangleAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { nodeId } from '@shared/index'
import { useCrux } from '../../store/runStore'
import { selectRecommendationStale, selectSynthesisError } from '../../store/selectors'
import { synthesize } from '../../lib/api'
import type { CruxNode } from '../buildGraph'
import { stop } from '../helpers'
import { NodeShell } from './NodeShell'

const CONFIDENCE = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' } as const

function RecommendationNodeImpl({ id }: NodeProps<CruxNode>) {
  const detailed = useCrux((s) => s.viewMode === 'detailed')
  const status = useCrux((s) => s.synthesisStatus)
  const synthesis = useCrux((s) => s.synthesis)
  const summary = useCrux((s) => s.reasoning.orchestrator?.summary ?? null)
  const waiting = useCrux(useShallow((s) => {
    const qs = s.plan?.questions.filter((q) => q.origin === 'plan') ?? []
    const open = qs.filter((q) => {
      const st = s.agents[s.agentByQuestion[q.id]]?.status
      return st !== 'done' && st !== 'failed' && st !== 'timeout'
    })
    return { k: open.length, m: qs.length }
  }))
  const stale = useCrux(useShallow((s) => {
    const r = selectRecommendationStale(s)
    return { stale: r.stale, reasons: r.reasons.join(' · ') }
  }))
  const select = useCrux((s) => s.select)
  const runId = useCrux((s) => s.runId)
  const mock = useCrux((s) => s.mock)
  const weights = useCrux((s) => s.weights)
  const replay = useCrux((s) => s.replay)
  const failure = useCrux(selectSynthesisError)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = status === 'ready' && synthesis
  const live = !mock && !replay && !!runId
  const update = async (e: { stopPropagation(): void }) => {
    e.stopPropagation()
    if (!runId) return
    setUpdating(true); setError(null)
    try { await synthesize(runId, { weights }) } catch (err) { setError(err instanceof Error ? err.message : 'Update failed') } finally { setUpdating(false) }
  }

  return (
    <NodeShell id={id} className="cx-node-root" label="Recommendation">
      <div className="cx-k">
        <Sparkles />
        Recommendation
        {ready && stale.stale && (
          <span className="cx-right">
            <span className="cx-stale" title={stale.reasons}>
              <TriangleAlert style={{ width: 12, height: 12 }} />
              New information since this was written.
              <button type="button" className="cx-btn nodrag nopan" disabled={updating || !live} onPointerDown={stop} onClick={update}
                title={replay ? 'Not available on a replay — start a live run.' : undefined}>
                Update recommendation
              </button>
            </span>
          </span>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--crux-bad)', margin: '0 0 4px' }}>{error}</p>}
      {ready && failure && (
        <div className="cx-row" style={{ gap: 8, margin: '0 0 6px', color: 'var(--crux-warn)', fontSize: 12, lineHeight: '16px' }}>
          <TriangleAlert style={{ width: 12, height: 12, flex: 'none' }} />
          <span className="cx-ellipsis" title={failure}>Couldn't update the recommendation ({failure}). Showing the previous one.</span>
          <RetryButton disabled={updating || !live} replay={replay} onClick={update} />
        </div>
      )}

      {ready ? (
        <div className="cx-rec">
          <div className="cx-rec-main">
            <div className="cx-row" style={{ gap: 10 }}>
              <span className="cx-title cx-title-lg cx-ellipsis" title={synthesis.recommendation}>{synthesis.recommendation}</span>
              <span className="cx-pill">{CONFIDENCE[synthesis.confidence]}</span>
            </div>
            <div className={`cx-body ${detailed ? 'cx-clamp-3' : 'cx-clamp-2'}`} style={{ marginTop: 6 }} title={synthesis.summary}>
              {synthesis.summary}
            </div>
            {detailed && synthesis.conditions[0] && (
              <div className="cx-body cx-muted cx-ellipsis" style={{ marginTop: 'auto', fontStyle: 'italic' }} title={synthesis.conditions[0]}>
                {synthesis.conditions[0]}
              </div>
            )}
          </div>
          {synthesis.reasons.length > 0 && (
            <div className="cx-rec-why">
              <div className="cx-k" style={{ marginBottom: 0 }}>Why</div>
              <ol>
                {synthesis.reasons.slice(0, 2).map((r, i) => (
                  <li key={i}>
                    <span className="cx-num">{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="cx-body cx-body-strong cx-clamp-2" title={r.text}>{r.text}</div>
                      {detailed && r.findingIds.length > 0 && (
                        <div className="cx-row nodrag nopan" style={{ marginTop: 3, gap: 4 }} onPointerDown={stop}>
                          {r.findingIds.slice(0, 4).map((fid) => (
                            <button
                              key={fid} type="button" className="cx-fchip"
                              onClick={(e) => { e.stopPropagation(); select(nodeId.finding(fid)) }}
                            >{fid}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : status === 'failed' ? (
        <div className="cx-row" style={{ gap: 10 }}>
          <span className="cx-body" style={{ color: 'var(--crux-bad)' }} title={failure ?? undefined}>
            Couldn't write a recommendation{failure ? ` (${failure})` : ''}.
          </span>
          <RetryButton disabled={updating || !live} replay={replay} onClick={update} />
        </div>
      ) : status === 'running' ? (
        <Pending text="Writing your recommendation…" live={summary} />
      ) : (
        <Pending text={waiting.m ? `Waiting on ${waiting.k} of ${waiting.m} questions` : 'Waiting on research'} live={null} />
      )}
    </NodeShell>
  )
}

function RetryButton({ disabled, replay, onClick }: { disabled: boolean; replay: boolean; onClick: (e: { stopPropagation(): void }) => void }) {
  return (
    <button type="button" className="cx-btn nodrag nopan" style={{ flex: 'none' }} disabled={disabled} onPointerDown={stop} onClick={onClick}
      title={disabled ? (replay ? 'Not available on a replay — start a live run.' : 'Not available on mock data — start a live run.') : undefined}>
      Try again
    </button>
  )
}

function Pending({ text, live }: { text: string; live: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="cx-live cx-body cx-body-strong">
        {live !== null ? <span className="cx-dot" /> : null}
        <span className="cx-ellipsis">{text}</span>
      </div>
      {live ? <div className="cx-body cx-muted cx-ellipsis">{live}</div> : null}
      <div className="cx-row" style={{ gap: 8 }} aria-hidden>
        <span className="cx-skel" style={{ width: 280 }} />
        <span className="cx-skel" style={{ width: 180 }} />
      </div>
    </div>
  )
}

export const RecommendationNode = memo(RecommendationNodeImpl)
