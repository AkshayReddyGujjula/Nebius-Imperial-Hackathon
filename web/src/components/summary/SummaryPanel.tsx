import { effectiveWeight } from '@shared/matrix'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RefreshCw, Table2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { nodeId } from '@shared/index'
import { useCrux } from '@/store/runStore'
import { selectRecommendationStale } from '@/store/selectors'
import { synthesize } from '@/lib/api'
import { MatrixDrawer } from '@/components/matrix/MatrixDrawer'
import { useMatrix } from '@/components/matrix/useMatrix'
import { clip, splitIf } from './text'
import './summary.css'

/**
 * The one obvious final output: best fit (computed in code from the user's weights), why, and
 * "if you care most about X → Y". When the full comparison is open, the matrix drawer takes its place.
 */
export function SummaryPanel() {
  const matrixOpen = useCrux((s) => s.matrixOpen)
  if (matrixOpen) return <MatrixDrawer />
  return <Summary />
}

function Summary() {
  const { plan, synthesis, status, sourceCount, replay, mock, runId, weights } = useCrux(useShallow((s) => ({
    plan: s.plan, synthesis: s.synthesis, status: s.synthesisStatus, sourceCount: Object.keys(s.sources).length,
    replay: s.replay, mock: s.mock, runId: s.runId, weights: s.weights,
  })))
  const agents = useCrux(useShallow((s) => {
    const qs = s.plan?.questions.filter((q) => q.origin === 'plan') ?? []
    const done = qs.filter((q) => {
      const st = s.agents[s.agentByQuestion[q.id]]?.status
      return st === 'done' || st === 'failed' || st === 'timeout'
    })
    return { done: done.length, total: qs.length }
  }))
  const stale = useCrux((s) => selectRecommendationStale(s).stale)
  const { setMatrixOpen, select, setViewMode } = useCrux(useShallow((s) => ({ setMatrixOpen: s.setMatrixOpen, select: s.select, setViewMode: s.setViewMode })))
  const { totals, leader, cells } = useMatrix()
  const [collapsed, setCollapsed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const ready = status === 'ready' && !!synthesis && !!plan
  const wasReady = useRef(ready)
  const [justRevealed, setJustRevealed] = useState(false)
  // Narrow centre column → one card at a time ("slides") with dots; wide → three cards side by side.
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null)
  const [narrow, setNarrow] = useState(false)
  const [slide, setSlide] = useState(0)
  const touched = useRef(false)
  useEffect(() => {
    const el = panelEl
    if (!el) return
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 760))
    ro.observe(el)
    return () => ro.disconnect()
  }, [panelEl])
  useEffect(() => {
    if (ready && !wasReady.current) {
      setJustRevealed(true); setCollapsed(false); setSlide(0); touched.current = false
      // Auto-advance once through the slides on first reveal; any click stops it.
      const t1 = setTimeout(() => { if (!touched.current) setSlide(1) }, 4000)
      const t2 = setTimeout(() => { if (!touched.current) setSlide(2) }, 8000)
      wasReady.current = ready
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    wasReady.current = ready
  }, [ready])

  if (!plan) return null
  const live = !mock && !replay && !!runId
  const update = async () => {
    if (!runId) return
    setUpdating(true)
    try { await synthesize(runId, { weights }) } catch { /* the brief node shows the error in Detailed */ } finally { setUpdating(false) }
  }

  const label = (id: string | undefined) => plan.options.find((o) => o.id === id)?.label ?? ''
  const ranked = [...totals].sort((a, b) => a.rank - b.rank).slice(0, 4)
  // DECISION: when the weighted totals are within 0.3, the option that scores higher on what the person said matters
  // MOST wins, so the pick always follows their strongest stated priority (computed in code, not by a model).
  let bestId = leader?.optionId
  let decidedBy: string | null = null
  const second = ranked.find((t) => t.optionId !== leader?.optionId)
  if (leader?.point != null && second?.point != null && Math.abs(leader.point - second.point) < 0.3) {
    const top = [...plan.criteria].sort((a, b) => effectiveWeight(b, weights) - effectiveWeight(a, weights))[0]
    const sc = (id: string) => cells.find((c) => c.optionId === id && c.criterionId === top?.id)?.score ?? null
    const a = sc(leader.optionId), b = sc(second.optionId)
    if (top && a != null && b != null && b > a) { bestId = second.optionId; decidedBy = top.label }
    else if (top && a != null && b != null && a > b) decidedBy = top.label
  }
  const leadLabel = bestId ? label(bestId) : ''
  const runnerUp = ranked.find((t) => t.optionId !== leader?.optionId && t.tooClose)
  const close = false && !!leader?.tooClose && !!runnerUp   // always name one clear best fit
  const headline = !leader ? 'Not enough scores yet'
    : close ? `Close call: ${clip(leadLabel, 4)} or ${clip(label(runnerUp!.optionId), 4)}` : clip(leadLabel, 6)

  const reasonsSrc = synthesis ? (synthesis.reasons.length ? synthesis.reasons.map((r) => r.text) : synthesis.conditions) : []
  const reasons = reasonsSrc.slice(0, 2).map((r) => clip(r, 10))
  const ifs = (synthesis?.conditions ?? []).map(splitIf).filter((x): x is { care: string; pick: string } => !!x).slice(0, 3)
    .map(({ care, pick }) => ({ care: clip(care, 4), pick: clip(pick, 4) }))
  const go = (i: number) => { touched.current = true; setSlide(i) }

  const openEvidence = () => { setViewMode('detailed'); select(nodeId.recommendation) }

  if (collapsed) {
    return (
      <section aria-label="Your summary" className="sm-bar">
        <button type="button" className="sm-bar-btn" onClick={() => setCollapsed(false)}>
          <b>Your summary</b>
          {ready && leadLabel ? <span>· Best fit: {clip(leadLabel, 6)}</span> : <span className="sm-muted">· not ready yet</span>}
          <ChevronUp className="!size-4" />
        </button>
      </section>
    )
  }

  return (
    <section ref={setPanelEl} aria-label="Your summary" className={`sm-panel${justRevealed ? ' sm-reveal' : ''}`}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) setJustRevealed(false) }}>
      <header className="sm-head">
        <h2>Your summary</h2>
        {ready && stale ? (
          <span className="sm-chip">New info
            <button type="button" disabled={updating || !live} onClick={update}
              title={live ? 'Update the summary' : 'Not available on a replay or demo'}>
              <RefreshCw className={`!size-3 ${updating ? 'ui-spin' : ''}`} />Update
            </button>
          </span>
        ) : null}
        <div className="flex-1" />
        <button type="button" className="ui-btn sm" onClick={() => setMatrixOpen(true)} title="Toggle with M">
          <Table2 />See the full comparison
        </button>
        <button type="button" className="ui-btn sm" onClick={() => setCollapsed(true)} aria-label="Hide summary"><ChevronDown /></button>
      </header>

      {!ready ? (
        <div className="sm-wait">
          <p>{status === 'running' ? 'Writing your summary…' : 'Your summary will appear here when the research is done'}</p>
          <div className="sm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={agents.total} aria-valuenow={agents.done}>
            <span style={{ width: `${agents.total ? (agents.done / agents.total) * 100 : 0}%` }} />
          </div>
          <span className="sm-muted ui-num">{agents.done}/{agents.total} helpers done</span>
        </div>
      ) : (
        <>
          <div className={`sm-cards${narrow ? ' sm-slides' : ''}`}>
            {(() => {
              const cards = [
            <article key="best" className="sm-card" style={{ animationDelay: '0ms' }}>
              <h3>Best fit for you</h3>
              <p className="sm-key">{headline}</p>
              {decidedBy ? <p className="text-[12.5px] text-crux-text-secondary">Close on totals, so it follows what matters most to you: <b>{decidedBy}</b></p> : null}
              <ul className="sm-bars">
                {ranked.map((t, i) => (
                  <li key={t.optionId} data-lead={t.optionId === bestId}>
                    <span className="sm-bar-label" title={label(t.optionId)}>{clip(label(t.optionId), 4)}</span>
                    <span className="sm-track"><span style={{ width: `${t.point != null ? (t.point / 5) * 100 : 0}%`, animationDelay: `${200 + i * 120}ms` }} /></span>
                    <span className="sm-val ui-num">{t.point != null ? t.point.toFixed(1) : '–'}</span>
                  </li>
                ))}
              </ul>
            </article>,
            <article key="why" className="sm-card" style={{ animationDelay: narrow ? '0ms' : '250ms' }}>
              <h3>Why</h3>
              <ul className="sm-list">{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </article>,
            ...(ifs.length > 0 ? [
              <article key="ifs" className="sm-card" style={{ animationDelay: narrow ? '0ms' : '500ms' }}>
                <h3>If you care most about…</h3>
                <ul className="sm-ifs">{ifs.map((x, i) => <li key={i}><span>{x.care}</span><em>→</em><b>{x.pick}</b></li>)}</ul>
              </article>] : []),
              ]
              if (!narrow) return cards
              const i = Math.min(slide, cards.length - 1)
              return (
                <>
                  {cards[i]}
                  <nav className="sm-nav" aria-label="Summary steps">
                    <button type="button" aria-label="Previous" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft className="!size-4" /></button>
                    {cards.map((c, j) => <button key={c.key} type="button" className="sm-dot" data-on={j === i} aria-label={`Step ${j + 1}`} onClick={() => go(j)} />)}
                    <button type="button" aria-label="Next" disabled={i === cards.length - 1} onClick={() => go(i + 1)}><ChevronRight className="!size-4" /></button>
                  </nav>
                </>
              )
            })()}
          </div>
          <footer className="sm-foot">
            <span>From your answers and {sourceCount} checked sources.</span>
            <button type="button" onClick={() => setMatrixOpen(true)}>Change what matters</button>
            <button type="button" onClick={openEvidence}>See the evidence</button>
          </footer>
        </>
      )}
    </section>
  )
}
