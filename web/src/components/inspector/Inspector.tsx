import { useState, type ReactNode } from 'react'
import { parseNodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { dismissBlindSpot } from '@/lib/api'
import { CellView } from './CellView'
import { QuestionView } from './QuestionView'
import { BlindSpotView, DecisionView, FindingView, RecommendationView } from './views'

function BlindSpotActions() {
  const bs = useCrux((s) => s.plan?.blindSpot ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!bs || bs.status !== 'open') return null
  const dismiss = async () => {
    const s = useCrux.getState()
    // DECISION: same as BlindSpotNode — the mock run has no server, so Dismiss updates the store directly.
    if (s.mock || !s.runId) {
      if (s.plan?.blindSpot) useCrux.setState({ plan: { ...s.plan, blindSpot: { ...s.plan.blindSpot, status: 'dismissed' } }, selectedNodeId: null })
      return
    }
    setBusy(true); setError(null)
    try { await dismissBlindSpot(s.runId) } catch (e) { setError(e instanceof Error ? e.message : 'Dismiss failed') } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" className="ui-btn" disabled={busy} onClick={dismiss}>Dismiss</button>
      </div>
      {error ? <p className="text-[12px] text-crux-warn">{error}</p> : null}
    </div>
  )
}

export function Inspector() {
  const selectedNodeId = useCrux((s) => s.selectedNodeId)
  const selectedCellKey = useCrux((s) => s.selectedCellKey)
  const select = useCrux((s) => s.select)
  const selectCell = useCrux((s) => s.selectCell)
  const close = () => { select(null); selectCell(null) }

  let view: ReactNode = null
  if (selectedCellKey) {
    view = <CellView cellKeyStr={selectedCellKey} onClose={close} />
  } else if (selectedNodeId) {
    let parsed: ReturnType<typeof parseNodeId> | null = null
    try { parsed = parseNodeId(selectedNodeId) } catch { parsed = null }
    if (parsed?.kind === 'decision') view = <DecisionView onClose={close} />
    else if (parsed?.kind === 'question' && parsed.ref) view = <QuestionView questionId={parsed.ref} onClose={close} />
    else if (parsed?.kind === 'finding' && parsed.ref) view = <FindingView findingId={parsed.ref} onClose={close} />
    else if (parsed?.kind === 'blindspot') view = <BlindSpotView onClose={close} actions={<BlindSpotActions />} />
    else if (parsed?.kind === 'recommendation') view = <RecommendationView onClose={close} />
  }
  if (!view) return null

  return (
    <aside aria-label="Inspector"
      className="ui-insp-enter absolute inset-y-0 right-0 z-20 flex w-[380px] flex-col border-l border-crux-border bg-crux-surface shadow-pop">
      {view}
    </aside>
  )
}


