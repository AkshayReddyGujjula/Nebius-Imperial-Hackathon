import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Minus, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useShallow } from 'zustand/react/shallow'
import { cellKey, effectiveWeight, type MatrixCell } from '@shared/matrix'
import { useCrux } from '@/store/runStore'
import { optionLetter } from '@/lib/format'
import { CitationChip } from '../common/CitationChip'
import { useMatrix } from './useMatrix'

export function Pips({ score }: { score: number | null }) {
  return (
    <span className="cx-pips" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <s key={i} className={score === null ? undefined : score >= i ? 'f' : score >= i - 0.5 ? 'h' : undefined} />
      ))}
    </span>
  )
}

export function OriginTag({ origin }: { origin: MatrixCell['origin'] }) {
  if (origin === 'ai') return <span className="cx-tag ai">AI</span>
  if (origin === 'user') return <span className="cx-tag you">You</span>
  return null
}

const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function Cell({ cell, detailed, selected }: { cell: MatrixCell; detailed: boolean; selected: boolean }) {
  const selectCell = useCrux((s) => s.selectCell)
  const finding = useCrux((s) => (cell.findingIds[0] ? s.findings[cell.findingIds[0]] : undefined))
  const key = cellKey(cell.optionId, cell.criterionId)
  return (
    <td className="cell" data-sel={selected} onClick={() => selectCell(key)}>
      {cell.score === null ? (
        <div>
          <div className="text-[14px] font-semibold text-crux-text-quaternary">–</div>
          <div className="text-[12px] text-crux-text-tertiary">No evidence yet</div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <span className="cx-num w-6 text-[14px] font-semibold">{fmtScore(cell.score)}</span>
            <Pips score={cell.score} />
            <OriginTag origin={cell.origin} />
          </div>
          {detailed ? (
            <>
              {cell.rationale ? <p className="cx-clamp-2 mt-1 text-[12px] leading-4 text-crux-text-tertiary">{cell.rationale}</p> : null}
              {finding ? <div className="mt-1.5"><CitationChip finding={finding} /></div> : null}
            </>
          ) : null}
        </div>
      )}
    </td>
  )
}

function WeightStepper({ criterionId, base }: { criterionId: string; base: number }) {
  const w = useCrux((s) => s.weights[criterionId] ?? base)
  const setWeight = useCrux((s) => s.setWeight)
  return (
    <span className="cx-wt" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Lower weight" disabled={w <= 0} onClick={() => setWeight(criterionId, w - 1)}><Minus /></button>
      <b data-changed={w !== base} title={w !== base ? `Orchestrator suggested ${base}` : 'Weight 0–10'}>{w}</b>
      <button type="button" aria-label="Raise weight" disabled={w >= 10} onClick={() => setWeight(criterionId, w + 1)}><Plus /></button>
    </span>
  )
}

function RerankNote({ leaderId }: { leaderId: string | null }) {
  const { lastRerank, plan } = useCrux(useShallow((s) => ({ lastRerank: s.lastRerank, plan: s.plan })))
  const prevLeader = useRef<string | null>(leaderId)
  const handled = useRef<number | null>(null)
  const [note, setNote] = useState<{ text: string; ts: number } | null>(null)

  useEffect(() => {
    if (lastRerank && lastRerank.ts !== handled.current && plan) {
      handled.current = lastRerank.ts
      const crit = plan.criteria.find((c) => c.id === lastRerank.criterionId)
      const i = plan.options.findIndex((o) => o.id === leaderId)
      if (crit && i >= 0) {
        const verb = prevLeader.current === leaderId ? 'stays first' : 'moves to first'
        setNote({
          text: `Re-ranked just now: you changed ${crit.label} weight ${lastRerank.from} → ${lastRerank.to}. ${optionLetter(i)} · ${plan.options[i].label} ${verb}.`,
          ts: lastRerank.ts,
        })
      }
    }
    prevLeader.current = leaderId
  }, [lastRerank, leaderId, plan])

  useEffect(() => {
    if (!note) return
    const t = window.setTimeout(() => setNote(null), 6000)
    return () => window.clearTimeout(t)
  }, [note])

  if (!note) return null
  return (
    <div className="crux-node-enter flex items-center gap-2 text-[12px] text-crux-text-secondary">
      <ArrowUpDown className="!size-3.5 text-crux-accent" />{note.text}
    </div>
  )
}

export function MatrixTable() {
  const { plan, detailed, selectedCellKey, weights } = useCrux(useShallow((s) => ({
    plan: s.plan, detailed: s.viewMode === 'detailed', selectedCellKey: s.selectedCellKey, weights: s.weights,
  })))
  const { cells, totals, leader } = useMatrix()
  const byKey = useMemo(() => new Map(cells.map((c) => [cellKey(c.optionId, c.criterionId), c])), [cells])
  if (!plan) return null
  const rows = [...totals].sort((a, b) => a.rank - b.rank)
  const letterOf = (id: string) => optionLetter(plan.options.findIndex((o) => o.id === id))
  const anyUnknown = totals.some((t) => t.unknownCount > 0)
  const sumW = plan.criteria.reduce((s, c) => s + effectiveWeight(c, weights), 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="cx-scroll min-h-0 flex-1 overflow-auto border-t border-crux-border">
        <table className="cx-mx">
          <thead>
            <tr>
              <th className="w-[200px] min-w-[180px]">Option</th>
              {plan.criteria.map((c) => (
                <th key={c.id} className="min-w-[136px]">
                  <div className="cx-clamp-2 text-[12px] leading-4 font-medium text-crux-text" title={c.description}>{c.label}</div>
                  <WeightStepper criterionId={c.id} base={c.weight} />
                </th>
              ))}
              <th className="min-w-[132px]">Weighted total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const o = plan.options.find((x) => x.id === t.optionId)
              if (!o) return null
              const isLead = leader?.optionId === t.optionId && t.point !== null
              return (
                <motion.tr key={t.optionId} layout="position" transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}>
                  <td>
                    <div className="flex items-start gap-2">
                      <span className={`cx-rank ${t.rank === 1 && t.point !== null ? 'one' : ''}`}>{t.rank}</span>
                      <div className="min-w-0">
                        <div className="text-[13px] leading-5 font-medium">{letterOf(o.id)} · {o.label}</div>
                        {o.origin === 'ai' ? <span className="text-[11px] text-crux-text-tertiary">AI-suggested</span> : null}
                      </div>
                    </div>
                  </td>
                  {plan.criteria.map((c) => {
                    const k = cellKey(o.id, c.id)
                    const cell = byKey.get(k)
                    return cell ? <Cell key={c.id} cell={cell} detailed={detailed} selected={selectedCellKey === k} /> : <td key={c.id} />
                  })}
                  <td className="bg-crux-hover">
                    <div className={`cx-num text-[15px] font-semibold ${isLead ? 'text-crux-accent-text' : ''}`}>
                      {t.point === null ? '–' : t.point.toFixed(2)}
                    </div>
                    <div className={`cx-tbar ${isLead ? 'one' : ''}`}>
                      <span style={{ width: `${t.point === null ? 0 : ((t.point - 1) / 4) * 100}%` }} />
                    </div>
                    {t.unknownCount > 0 && t.min !== null && t.max !== null ? (
                      <div className="cx-num mt-1 text-[11px] text-crux-text-tertiary" title="Range if the unknown cells scored 1 or 5">
                        {t.min.toFixed(2)}–{t.max.toFixed(2)}
                      </div>
                    ) : null}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-none flex-col gap-1.5 border-t border-crux-border px-4 py-2.5">
        <RerankNote leaderId={leader?.point != null ? leader.optionId : null} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-crux-text-tertiary">
          {detailed ? <span>Weighted total = Σ(weight × score) / Σ weight · computed in code{sumW === 0 ? ' · all weights are 0' : ''}</span> : null}
          <span className="flex items-center gap-1.5"><span className="cx-tag ai">AI</span>proposed from cited findings</span>
          <span className="flex items-center gap-1.5"><span className="cx-tag you">You</span>set by you</span>
          {anyUnknown ? <span>Ranges show totals if unknown cells scored 1 to 5</span> : null}
        </div>
      </div>
    </div>
  )
}
