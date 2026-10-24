import { ChevronDown, ChevronUp, Table2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '@/store/runStore'
import { optionLetter } from '@/lib/format'
import { MatrixTable } from './MatrixTable'
import { useMatrix } from './useMatrix'

export function MatrixDrawer() {
  const { plan, open, detailed } = useCrux(useShallow((s) => ({ plan: s.plan, open: s.matrixOpen, detailed: s.viewMode === 'detailed' })))
  const setMatrixOpen = useCrux((s) => s.setMatrixOpen)
  const { cells, leader } = useMatrix()
  if (!plan) return null

  const o = plan.options.length
  const c = plan.criteria.length
  const k = cells.filter((x) => x.proposalCount > 0).length
  const li = leader ? plan.options.findIndex((x) => x.id === leader.optionId) : -1
  const leadOpt = li >= 0 ? plan.options[li] : null

  return (
    <section aria-label="Trade-off matrix"
      className="flex flex-none flex-col border-t border-crux-border-strong bg-crux-surface shadow-[0_-8px_24px_rgba(24,24,27,.05)]"
      style={{ height: open ? 'min(440px, 55%)' : 48 }}>
      <div className="flex h-12 flex-none items-center gap-3 px-4">
        <button type="button" className="flex items-center gap-2 text-[13px] font-semibold" onClick={() => setMatrixOpen(!open)}>
          <Table2 className="!size-4 text-crux-text-secondary" />Trade-off matrix
        </button>
        {detailed ? (
          <span className="cx-num truncate text-[12px] text-crux-text-tertiary">
            {o} options × {c} criteria · {k} of {o * c} scores proposed
          </span>
        ) : null}
        <div className="flex-1" />
        {leadOpt && leader?.point != null ? (
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-crux-text-secondary">
            Leading:
            <b className="truncate font-semibold text-crux-text">{optionLetter(li)} · {leadOpt.label}</b>
            {detailed ? <span className="cx-num font-medium text-crux-accent-text">{leader.point.toFixed(2)}</span> : null}
            {leader.tooClose ? <span className="cx-pill warn">too close to call</span> : null}
          </span>
        ) : (
          <span className="text-[13px] text-crux-text-tertiary">Scores appear as research comes in</span>
        )}
        <button type="button" className="cx-btn sm" onClick={() => setMatrixOpen(!open)} title="Toggle with M">
          {open ? <><ChevronDown />Close</> : <><ChevronUp />Open</>}
        </button>
      </div>
      {open ? <MatrixTable /> : null}
    </section>
  )
}
