import { ChevronDown, ChevronUp, Loader, Table2 } from 'lucide-react'
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
      className="flex flex-none flex-col border-t border-crux-border-strong bg-crux-surface shadow-[0_-1px_0_rgba(28,27,23,.04)]"
      style={{ height: open ? 'min(440px, 55%)' : 48, transition: 'height 220ms var(--crux-ease)' }}>
      <div className="flex h-12 flex-none items-center gap-3 px-4">
        <button type="button" className="flex items-center gap-2 text-[13px] font-semibold" onClick={() => setMatrixOpen(!open)}>
          <Table2 className="!size-4 text-crux-text-secondary" />Trade-off matrix<span className="hidden font-normal text-crux-text-tertiary xl:inline">· how each option fits what matters to you</span>
        </button>
        {detailed ? (
          <span className="ui-num truncate text-[12px] text-crux-text-tertiary">
            {o} options × {c} things you care about · {k} of {o * c} fit scores in
          </span>
        ) : null}
        <div className="flex-1" />
        {leadOpt && leader?.point != null ? (
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-crux-text-secondary">
            <span title="Ranked by your weights, not by Decision Lab" className="cursor-help underline decoration-dotted underline-offset-2">Top for your weights:</span>
            <b className="truncate font-semibold text-crux-text">{optionLetter(li)} · {leadOpt.label}</b>
            {detailed ? <span className="ui-num font-medium text-crux-accent-text">{leader.point.toFixed(2)}</span> : null}
            {leader.tooClose ? <span className="ui-pill warn">too close to call</span> : null}
          </span>
        ) : (
          <span className="ui-num text-[13px] text-crux-text-tertiary">{k ? `${k} of ${o * c} scores in` : "Waiting for the agents' scores…"}</span>
        )}
        <button type="button" className="ui-btn sm" onClick={() => setMatrixOpen(!open)} title="Toggle with M">
          {open ? <><ChevronDown />Close</> : <><ChevronUp />Open</>}
        </button>
      </div>
      {open ? (
        <div className="dl-drawer-open flex min-h-0 flex-1 flex-col">
          {k === 0 ? (
            <div className="ui-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4" aria-busy="true">
              <p className="mb-3 flex items-center gap-2 text-[13px] text-crux-text-secondary">
                <Loader className="ui-spin text-crux-accent" />Waiting for the agents' scores…
                <span className="ui-num text-crux-text-tertiary">0 of {o * c} scores in</span>
              </p>
              <table className="ui-mx">
                <thead><tr><th>Option</th>{plan.criteria.map((cr) => <th key={cr.id}>{cr.label}</th>)}</tr></thead>
                <tbody>
                  {plan.options.map((op, i) => (
                    <tr key={op.id}>
                      <td className="text-[13px] font-medium">{optionLetter(i)} · {op.label}</td>
                      {plan.criteria.map((cr) => <td key={cr.id}><span className="ui-skel-cell" /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              {k < o * c ? (
                <div className="flex items-center gap-2 px-4 pb-2 text-[12px] text-crux-text-tertiary">
                  <span className="ui-num">{k} of {o * c} scores in</span>
                  <span className="dl-inline-progress w-24"><span className="sr-only">loading</span></span>
                </div>
              ) : null}
              <MatrixTable />
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
