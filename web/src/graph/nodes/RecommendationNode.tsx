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

const EVIDENCE = { high: 'Evidence: strong', medium: 'Evidence: medium', low: 'Evidence: thin' } as const

/** "If you value X, then Y" → ["X", "Y"]; anything else stays one line. */
function splitCondition(c: string): [string, string] | null {
  const m = /^\s*if\s+(.+?),\s*(?:then\s+)?(.+)$/i.exec(c)
  return m ? [m[1].replace(/^you value\s+/i, ''), m[2]] : null
}

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
    <NodeShell id={id} className="cx-node-root" label="Decision brief">
      <div className="cx-k">
        <Sparkles />
        Decision brief
        {!(ready && (failure || stale.stale)) && <span className="cx-byline cx-ellipsis">· Written by DeepSeek V4.1 Flash · max</span>}
        {ready && failure && (
          <span className="cx-right" style={{ minWidth: 0 }}>
            <span className="cx-stale" style={{ minWidth: 0 }}>
              <TriangleAlert style={{ width: 12, height: 12, flex: 'none' }} />
              <span className="cx-ellipsis" title={failure}>Couldn't update the brief ({failure}). Showing the previous one.</span>
              <RetryButton disabled={updating || !live} replay={replay} onClick={update} />
            </span>
          </span>
        )}
        {ready && !failure && stale.stale && (
          <span className="cx-right">
            <span className="cx-stale" title={stale.reasons}>
              <TriangleAlert style={{ width: 12, height: 12 }} />
              New information since this was written.
              <button type="button" className="cx-btn nodrag nopan" disabled={updating || !live} onPointerDown={stop} onClick={update}
                title={replay ? 'Not available on a replay — start a live run.' : undefined}>
                Update the brief
              </button>
            </span>
          </span>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--crux-bad)', margin: '0 0 4px' }}>{error}</p>}
      {replay && (status === 'failed' || (ready && (failure || stale.stale))) && (
        <p className="text-xs" style={{ color: 'var(--crux-text-tertiary)', margin: '0 0 4px' }}>Not available on a replay — start a live run.</p>
      )}
      {ready ? (
        <div className="cx-rec ui-scroll nowheel nodrag" onPointerDown={stop}>
          <div className="cx-rec-main">
            <div className="cx-k" style={{ marginBottom: 2 }}>What it hinges on</div>
            <div className="cx-row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="cx-title cx-title-lg cx-wrap" title={synthesis.cruxes[0] ?? synthesis.recommendation}>{synthesis.cruxes[0] ?? synthesis.recommendation}</span>
              <span className="cx-pill">{EVIDENCE[synthesis.confidence]}</span>
            </div>
            <div className="cx-body" style={{ marginTop: 6 }}>
              {synthesis.summary}
            </div>
            {synthesis.conditions.length > 0 && (
              <div className="cx-cond">
                {synthesis.conditions.slice(0, 4).map((c, i) => {
                  const parts = splitCondition(c)
                  return (
                    <div key={i}>
                      {parts ? <><b>If you value</b> {parts[0]} <b>→</b> {parts[1]}</> : c}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {synthesis.reasons.length > 0 && (
            <div className="cx-rec-why">
              <div className="cx-k" style={{ marginBottom: 0 }}>Why</div>
              <ol>
                {synthesis.reasons.slice(0, 4).map((r, i) => (
                  <li key={i}>
                    <span className="cx-num">{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="cx-body cx-body-strong">{r.text}</div>
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
            Couldn't write the brief{failure ? ` (${failure})` : ''}.
          </span>
          <RetryButton disabled={updating || !live} replay={replay} onClick={update} />
        </div>
      ) : status === 'running' ? (
        <Pending text="Writing your decision brief…" live={summary} />
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
