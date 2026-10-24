import { CircleX, GitCompareArrows, TriangleAlert, Info } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { Finding } from '@shared/index'
import { nodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { pct } from '@/lib/format'
import { selectQuestionLabel } from '@/store/selectors'
import { CitationChip } from '../common/CitationChip'

/** Explanation for the code-run citation check (§4.4 copy for the two failures). */
export function CheckNote({ finding }: { finding: Finding }) {
  const c = finding.checks
  if (!c.sourceRetrieved) {
    return <div className="ui-note bad"><CircleX />This source id was never retrieved by this agent. The citation is invalid.</div>
  }
  if (c.quote === 'not_found') {
    return <div className="ui-note warn"><TriangleAlert />The cited page doesn't contain this sentence. Treat as unverified — the model may have paraphrased or misread.</div>
  }
  // DECISION: §4.4 has no copy for partial / no-quote; these are plain, neutral explanations.
  if (c.quote === 'partial') {
    return <div className="ui-note neutral"><Info />Close match: {pct(c.quoteMatchRatio)} of the quote's phrases appear in the source.</div>
  }
  if (c.quote === 'no_quote') {
    return <div className="ui-note neutral"><Info />No verbatim quote was given, so this claim can't be checked against the source.</div>
  }
  return null
}

/** "Disagrees with Q3: …" boxes for every contradiction involving this finding. */
export function ContradictionBoxes({ findingId }: { findingId: string }) {
  const select = useCrux((s) => s.select)
  const rows = useCrux(useShallow((s) => s.contradictions
    .filter((x) => x.findingIds.includes(findingId))
    .map((x) => {
      const other = x.findingIds[0] === findingId ? x.findingIds[1] : x.findingIds[0]
      const qid = s.findings[other]?.questionId
      return { id: x.id, other, label: qid ? selectQuestionLabel(s, qid) : 'another branch', explanation: x.explanation }
    })))
  if (rows.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.id} className="ui-note bad">
          <GitCompareArrows />
          <span className="min-w-0 flex-1">
            <b className="font-medium">Disagrees with {r.label}:</b> {r.explanation}{' '}
            <button type="button" className="ui-link !text-crux-bad underline underline-offset-2" onClick={() => select(nodeId.finding(r.other))}>Show</button>
          </span>
        </div>
      ))}
    </div>
  )
}

export function FindingCard({ finding, n }: { finding: Finding; n: number }) {
  const select = useCrux((s) => s.select)
  const selected = useCrux((s) => s.selectedNodeId === nodeId.finding(finding.id))
  return (
    <article className={`rounded-[8px] border p-3 ${!finding.checks.supported ? 'border-crux-warn-border' : 'border-crux-border'} ${selected ? '!border-crux-accent' : ''}`}>
      <div className="ui-label">Finding {n}{finding.stale ? <span className="ui-tag neutral !normal-case">Superseded</span> : null}</div>
      <p className="mt-1.5 text-[13px] leading-[19px] font-medium text-crux-text">{finding.claim}</p>
      {finding.quote ? <blockquote className="ui-quote mt-2">“{finding.quote}”</blockquote> : null}
      <div className="mt-2 flex items-center gap-2">
        <CitationChip finding={finding} onClick={() => select(nodeId.finding(finding.id))} />
        <span className="text-[12px] text-crux-text-tertiary">{finding.confidence[0].toUpperCase() + finding.confidence.slice(1)} confidence</span>
      </div>
      {finding.checks.quote !== 'verified' || !finding.checks.sourceRetrieved ? <div className="mt-2"><CheckNote finding={finding} /></div> : null}
      <div className="mt-2 empty:hidden"><ContradictionBoxes findingId={finding.id} /></div>
    </article>
  )
}
