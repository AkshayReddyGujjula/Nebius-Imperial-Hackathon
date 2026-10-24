import type { ReactNode } from 'react'
import { parseNodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { BlindSpotActions, FindingActions, LadderCard, QuestionActions, UpdateRecommendation } from './actions'
import { CellView } from './CellView'
import { QuestionView } from './QuestionView'
import { BlindSpotView, DecisionView, FindingView, RecommendationView } from './views'

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
    else if (parsed?.kind === 'question' && parsed.ref) view = <QuestionView questionId={parsed.ref} onClose={close} actions={<><QuestionActions questionId={parsed.ref} /><LadderCard questionId={parsed.ref} /></>} />
    else if (parsed?.kind === 'finding' && parsed.ref) view = <FindingView findingId={parsed.ref} onClose={close} actions={<FindingActions findingId={parsed.ref} />} />
    else if (parsed?.kind === 'blindspot') view = <BlindSpotView onClose={close} actions={<BlindSpotActions />} />
    else if (parsed?.kind === 'recommendation') view = <RecommendationView onClose={close} actions={<UpdateRecommendation />} />
  }
  if (!view) return null

  return (
    <aside aria-label="Inspector"
      className="ui-insp-enter absolute inset-y-0 right-0 z-20 flex w-[380px] flex-col border-l border-crux-border bg-crux-surface shadow-pop">
      {view}
    </aside>
  )
}


