import { useEffect, useRef, useState } from 'react'
import { MODEL_FAMILIES, type ModelFamily } from '@/graph/helpers'
import { ModelBadge } from '@/graph/nodes/ModelBadge'
import '@/graph/nodes/models.css'

const ROWS: { family: ModelFamily; job: string; why: string }[] = [
  { family: 'deepseek', job: 'Planner, 4 research agents, chat, the brief',
    why: 'Strong reasoning at low cost, so every question gets its own agent in parallel.' },
  { family: 'minimax', job: 'Auditor: cross-examines the findings',
    why: 'A different lab from DeepSeek, so it does not share the same blind spots when hunting contradictions.' },
  { family: 'nemotron', job: 'Live one-line status summaries',
    why: 'Very fast and cheap: turns raw reasoning into the short lines you see on each card.' },
]

/** Top-bar chip "3 open models" → popover: which model does which job, and why. */
export function ModelLegend() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="dl-mlegend" ref={ref}>
      <button type="button" className="dl-mlegend-chip" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}
        title="Which open model does which job">
        <span className="dl-mlegend-dots" aria-hidden>
          {ROWS.map((r) => <i key={r.family} style={{ background: MODEL_FAMILIES[r.family].color }} />)}
        </span>
        3 open models
      </button>
      {open && (
        <div className="dl-mlegend-pop" role="dialog" aria-label="Models in this run">
          <div className="dl-mlegend-head">Open models on Nebius · who does what</div>
          {ROWS.map((r) => (
            <div key={r.family} className="dl-mlegend-row">
              <ModelBadge family={r.family} />
              <span className="dl-mlegend-job">{r.job}</span>
              <span className="dl-mlegend-why"><b>{MODEL_FAMILIES[r.family].full}.</b> {r.why}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
