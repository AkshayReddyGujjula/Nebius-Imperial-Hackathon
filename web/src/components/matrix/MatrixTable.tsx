import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowUpDown, Scale } from 'lucide-react'
import { motion } from 'motion/react'
import { useShallow } from 'zustand/react/shallow'
import { cellKey, effectiveWeight, type MatrixCell } from '@shared/matrix'
import { useCrux } from '@/store/runStore'
import { optionLetter } from '@/lib/format'
import { CitationChip } from '../common/CitationChip'
import { useMatrix } from './useMatrix'
import { smallestRankFlip } from './whatIf'
import './matrix.css'

export function Pips({ score }: { score: number | null }) {
  return (
    <span className="ui-pips" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <s key={i} className={score === null ? undefined : score >= i ? 'f' : score >= i - 0.5 ? 'h' : undefined} />
      ))}
    </span>
  )
}

export function OriginTag({ origin }: { origin: MatrixCell['origin'] }) {
  if (origin === 'ai') return <span className="ui-tag ai" title="Proposed by a research agent from a cited source">from research</span>
  if (origin === 'user') return <span className="ui-tag you" title="You set this score">your score</span>
  return null
}

const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function Cell({ cell, detailed, selected }: { cell: MatrixCell; detailed: boolean; selected: boolean }) {
  const selectCell = useCrux((s) => s.selectCell)
  const finding = useCrux((s) => (cell.findingIds[0] ? s.findings[cell.findingIds[0]] : undefined))
  const key = cellKey(cell.optionId, cell.criterionId)
  const pending = useCrux((s) => s.phase === 'planning' || s.phase === 'researching')
  return (
    <td
      className="cell" data-sel={selected} data-unknown={cell.score === null}
      style={{ '--fit': cell.score === null ? 0 : (cell.score - 1) / 4 } as CSSProperties}
      onClick={() => selectCell(key)}
    >
      {cell.score === null ? (
        <div>
          <div className="text-[14px] font-semibold text-crux-text-quaternary">–</div>
          {pending ? <span className="ui-skel-cell mt-1" aria-label="Score pending" /> : <div className="text-[12px] text-crux-text-tertiary" title="No cited source scored this yet — it is left out of the overall fit, never counted as 0">Unknown · no evidence yet</div>}
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-2" title={`Fit score ${fmtScore(cell.score)} out of 5 (1 = poor fit, 5 = great fit)`}>
            <span className="ui-num text-[14px] font-semibold">{fmtScore(cell.score)}<span className="text-[11px] font-normal text-crux-text-tertiary">/5</span></span>
            <Pips score={cell.score} />
            <OriginTag origin={cell.origin} />
          </div>
          {cell.rationale ? <p className="mx-why mt-1 text-[12px] leading-4 text-crux-text-secondary" title={cell.rationale}>{cell.rationale}</p> : null}
          {finding ? <div className={`mt-1.5 ${detailed ? '' : 'mx-src'}`}><CitationChip finding={finding} /></div> : null}
        </div>
      )}
    </td>
  )
}

function WeightStepper({ criterionId, base, share }: { criterionId: string; base: number; share: number }) {
  const w = useCrux((s) => s.weights[criterionId] ?? base)
  const setWeight = useCrux((s) => s.setWeight)
  return (
    <div className="mt-1 text-[11px] font-normal text-crux-text-tertiary" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between gap-2 whitespace-nowrap"><span>Matters to you</span><span className="ui-num">{Math.round(share * 100)}% of fit</span></div>
      <div className="mx-w">
        <input
          type="range" min={0} max={10} step={1} value={w} aria-label="How much this matters to you, 0 to 10"
          onChange={(e) => setWeight(criterionId, Number(e.target.value))}
        />
        <b data-changed={w !== base} title={w !== base ? `Orchestrator suggested ${base}` : 'Weight 0–10'}>{w}<span className="font-normal text-crux-text-tertiary">/10</span></b>
      </div>
      <div className="mx-share" title={`${Math.round(share * 100)}% of the overall fit`}><span style={{ width: `${share * 100}%` }} /></div>
    </div>
  )
}

function FlipLine({ flip, label, letterOf }: { flip: ReturnType<typeof smallestRankFlip>; label: (id: string) => string; letterOf: (id: string) => string }) {
  if (!flip) {
    return <div className="mx-flip"><Scale className="!size-3.5 text-crux-text-tertiary" />No single weight change (0–10) would change who ranks first.</div>
  }
  const n = Math.abs(flip.delta)
  return (
    <div className="mx-flip" title={`Computed in code: weight ${flip.from} → ${flip.to}`}>
      <Scale className="!size-3.5 text-crux-accent" />
      <span>
        <b>What would change the ranking:</b> if “{label(flip.criterionId)}” mattered <b>{n} point{n === 1 ? '' : 's'} {flip.delta > 0 ? 'more' : 'less'}</b> ({flip.from} → {flip.to}),{' '}
        <b>{letterOf(flip.newLeaderId)} · {label(flip.newLeaderId)}</b> would rank first.
      </span>
    </div>
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
  const flip = smallestRankFlip(plan.options, plan.criteria, cells, weights)
  const labelOf = (id: string) => plan.criteria.find((c) => c.id === id)?.label ?? plan.options.find((o) => o.id === id)?.label ?? id

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="flex-none px-4 pb-2 text-[12.5px] leading-[18px] text-crux-text-secondary">
        <span className="mx-neutral mr-2">Ranked by YOUR weights — not a recommendation</span>
        <b className="font-semibold text-crux-text">How to read this:</b> each cell scores how well an option fits one thing you care about, from <b className="font-semibold">1 (poor)</b> to <b className="font-semibold">5 (great)</b>, proposed by the research agents from cited sources.
        Set how much each thing <b className="font-semibold">matters to you (0–10)</b>; the overall fit and ranking are recalculated in code. It's a lens on your priorities, not a verdict.
      </p>
      <div className="ui-scroll min-h-0 flex-1 overflow-auto border-t border-crux-border">
        <table className="ui-mx">
          <thead>
            <tr>
              <th className="w-[200px] min-w-[180px]">Your options<div className="text-[11px] font-normal text-crux-text-tertiary">ranked by YOUR weights</div></th>
              {plan.criteria.map((c) => (
                <th key={c.id} className="min-w-[136px]">
                  <div className="text-[12px] leading-4 font-medium text-crux-text" title={c.description}>{c.label}</div>
                  <WeightStepper criterionId={c.id} base={c.weight} share={sumW > 0 ? effectiveWeight(c, weights) / sumW : 0} />
                </th>
              ))}
              <th className="min-w-[132px]">Overall fit<div className="text-[11px] font-normal text-crux-text-tertiary">1–5, weighted by what matters to you</div></th>
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
                      <span className={`ui-rank ${t.rank === 1 && t.point !== null ? 'one' : ''}`} title={`Ranked #${t.rank} for your current weights`}>{t.rank}</span>
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
                    <div className={`ui-num text-[15px] font-semibold ${isLead ? 'text-crux-accent-text' : ''}`}>
                      {t.point === null ? '–' : <>{t.point.toFixed(2)}<span className="text-[11px] font-normal text-crux-text-tertiary"> /5</span></>}
                    </div>
                    <div className={`ui-tbar ${isLead ? 'one' : ''}`}>
                      <span style={{ width: `${t.point === null ? 0 : ((t.point - 1) / 4) * 100}%` }} />
                    </div>
                    {t.unknownCount > 0 && t.min !== null && t.max !== null ? (
                      <div className="ui-num mt-1 text-[11px] text-crux-text-tertiary" title="Range if the unknown cells scored 1 or 5">
                        could be {t.min.toFixed(2)}–{t.max.toFixed(2)}
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
        {leader?.point != null ? <FlipLine flip={flip} label={labelOf} letterOf={letterOf} /> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-crux-text-tertiary">
          <span className="mx-legend" title="Cell tint = fit score">Fit
            {[1, 2, 3, 4, 5].map((n) => <i key={n} style={{ background: `color-mix(in srgb, var(--crux-accent) ${((n - 1) / 4) * 24}%, var(--crux-surface))` }} title={`${n}/5`} />)}
            <span>1 poor → 5 great</span>
            <i style={{ background: 'repeating-linear-gradient(135deg, var(--crux-surface) 0 3px, var(--crux-hover) 3px 4px)' }} /> unknown
          </span>
          <span>Overall fit = Σ(matters × fit) / Σ matters · computed in code, not by the AI{sumW === 0 ? ' · all weights are 0' : ''}</span>
          <span className="flex items-center gap-1.5"><span className="ui-tag ai">from research</span>score proposed by an agent from a cited source</span>
          <span className="flex items-center gap-1.5"><span className="ui-tag you">your score</span>set by you</span>
          {anyUnknown ? <span>Ranges show totals if unknown cells scored 1 to 5</span> : null}
        </div>
      </div>
    </div>
  )
}
