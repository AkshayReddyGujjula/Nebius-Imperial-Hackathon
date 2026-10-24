import { GitCompareArrows } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cellKey } from '@shared/matrix'
import { nodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { optionLetter } from '@/lib/format'
import { CitationChip } from '../common/CitationChip'
import { OriginTag, Pips } from '../matrix/MatrixTable'
import { useMatrix } from '../matrix/useMatrix'
import { Header, Sec } from './parts'
import { REPLAY_NOTE, ReplayNote } from './actions'

export function CellView({ cellKeyStr, onClose }: { cellKeyStr: string; onClose: () => void }) {
  const plan = useCrux((s) => s.plan)
  const findings = useCrux((s) => s.findings)
  const override = useCrux((s) => s.overrides[cellKeyStr])
  const setOverride = useCrux((s) => s.setOverride)
  const select = useCrux((s) => s.select)
  const replay = useCrux((s) => s.replay)
  const { cells } = useMatrix()
  const cell = cells.find((c) => cellKey(c.optionId, c.criterionId) === cellKeyStr)
  const contradicted = useCrux(useShallow((s) => (cell?.findingIds ?? []).filter((id) => s.contradictions.some((x) => x.findingIds.includes(id)))))
  if (!plan || !cell) return null
  const oi = plan.options.findIndex((o) => o.id === cell.optionId)
  const option = plan.options[oi]
  const criterion = plan.criteria.find((c) => c.id === cell.criterionId)
  const supporting = cell.findingIds.map((id) => findings[id]).filter(Boolean)

  return (
    <>
      <Header kind="Matrix cell" onClose={onClose} />
      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
        <Sec>
          <p className="text-[14px] leading-5 font-medium">{optionLetter(oi)} · {option?.label} <span className="text-crux-text-tertiary">×</span> {criterion?.label}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="ui-num text-[28px] leading-8 font-semibold">{cell.score === null ? '–' : Number.isInteger(cell.score) ? cell.score : cell.score.toFixed(1)}</span>
            <Pips score={cell.score} />
            <OriginTag origin={cell.origin} />
          </div>
          {cell.score === null ? <p className="mt-1 text-[12px] text-crux-text-tertiary">No evidence yet. Unknown cells are left out of the total, never counted as 0.</p> : null}
        </Sec>
        {cell.origin !== 'none' ? (
          <Sec title="Justification">
            <p className="text-[13px] leading-[19px] text-crux-text-secondary">
              {cell.origin === 'user' && cell.proposalCount > 0 ? 'Set by you. The agents proposed a different score from the findings below.' : cell.rationale}
            </p>
            {cell.proposalCount > 1 ? <p className="mt-1 text-[12px] text-crux-text-tertiary">Average of {cell.proposalCount} agent proposals.</p> : null}
          </Sec>
        ) : null}
        {supporting.length ? (
          <Sec title={`Supporting findings · ${supporting.length}`}>
            <div className="flex flex-col gap-3">
              {supporting.map((f) => (
                <div key={f.id}>
                  <p className="text-[13px] leading-[19px]">{f.claim}</p>
                  {f.quote ? <blockquote className="ui-quote mt-1.5 !text-[12.5px]">“{f.quote}”</blockquote> : null}
                  <div className="mt-1.5"><CitationChip finding={f} onClick={() => select(nodeId.finding(f.id))} /></div>
                </div>
              ))}
            </div>
          </Sec>
        ) : null}
        {contradicted.length ? (
          <Sec>
            <div className="ui-note bad"><GitCompareArrows />Another agent disagrees with {contradicted.length === 1 ? 'a supporting finding' : `${contradicted.length} supporting findings`}. Treat this score with care.</div>
          </Sec>
        ) : null}
        <Sec title="Your score">
          <div className="flex items-center gap-2">
            <div className="ui-seg flex-1" role="radiogroup" aria-label="Your score">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={override === n} data-on={override === n} disabled={replay} title={replay ? REPLAY_NOTE : undefined} onClick={() => setOverride(cellKeyStr, n)}>{n}</button>
              ))}
            </div>
            {override !== undefined ? <button type="button" className="ui-btn sm" disabled={replay} onClick={() => setOverride(cellKeyStr, null)}>Clear</button> : null}
          </div>
          <p className="mt-2 text-[12px] leading-4 text-crux-text-tertiary">Changing it marks the cell You and re-ranks the totals at once.</p>
          <div className="mt-1"><ReplayNote /></div>
        </Sec>
      </div>
    </>
  )
}
