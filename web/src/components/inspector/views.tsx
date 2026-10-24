import type { ReactNode } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { BlindSpotKind } from '@shared/index'
import { nodeId } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { selectQuestionLabel, selectRecommendationStale } from '@/store/selectors'
import { optionLetter } from '@/lib/format'
import { CitationChip } from '../common/CitationChip'
import { CheckNote, ContradictionBoxes } from './FindingCard'
import { Header, List, RawReasoning, Sec } from './parts'

// ---------- helpers ----------

/** Lightweight client copy of server normalizeForMatch, returning words only. */
function matchWords(s: string): string[] {
  return s.normalize('NFKC').toLowerCase()
    .replace(/\[\s*\.\.\.\s*\]|\.\.\.|…/g, ' ')
    .replace(/[^\p{L}\p{N}%$£€\s]/gu, ' ')
    .split(/\s+/).filter(Boolean)
}
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Finds the quote in the source text: full quote first, then its first 6 words. */
function locateQuote(content: string, quote: string): [number, number] | null {
  const words = matchWords(quote)
  if (words.length < 3) return null
  const sep = '[^\\p{L}\\p{N}%$£€]+'
  const tryRe = (ws: string[]) => {
    try { return new RegExp(ws.map(esc).join(sep), 'iu').exec(content) } catch { return null }
  }
  const full = words.length <= 80 ? tryRe(words) : null
  if (full) return [full.index, full.index + full[0].length]
  const head = tryRe(words.slice(0, 6))
  if (head) return [head.index, Math.min(content.length, head.index + Math.max(head[0].length, quote.length))]
  return null
}

const BLIND_KIND: Record<BlindSpotKind, string> = {
  missing_option: 'Missing option', unstated_assumption: 'Unstated assumption',
  missing_criterion: 'Missing criterion', personal_unknown: 'Something only you know',
}

// ---------- Decision ----------

export function DecisionView({ onClose }: { onClose: () => void }) {
  const { decision, plan, detailed } = useCrux(useShallow((s) => ({ decision: s.decision, plan: s.plan, detailed: s.viewMode === 'detailed' })))
  return (
    <>
      <Header kind="Decision" onClose={onClose} />
      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
        <Sec title="In your words"><blockquote className="ui-quote !text-[14px] !leading-5 !text-crux-text">{decision}</blockquote></Sec>
        {plan ? (
          <>
            <Sec title="What you told us">
              <ul className="flex flex-col gap-2">
                {plan.facts.map((f) => (
                  <li key={f.id} className="text-[13px] leading-[19px]">
                    <span className="text-crux-text">{f.text}</span>
                    {f.origin !== 'user' ? <span className="ui-tag neutral ml-1.5">{f.origin === 'blindspot_answer' ? 'Your answer' : 'Added later'}</span> : null}
                    {f.quote ? <span className="block text-[12px] leading-4 text-crux-text-tertiary italic">“{f.quote}”</span> : null}
                  </li>
                ))}
              </ul>
            </Sec>
            <Sec title="Options">
              <ul className="flex flex-col gap-2.5">
                {plan.options.map((o, i) => (
                  <li key={o.id} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2">
                    <span className="ui-rank">{optionLetter(i)}</span>
                    <div>
                      <div className="flex items-center gap-2 text-[13px] leading-5 font-medium">{o.label}{o.origin === 'ai' ? <span className="ui-tag ai">AI-suggested</span> : null}</div>
                      <p className="text-[12px] leading-4 text-crux-text-tertiary">{o.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Sec>
            <Sec title="Criteria">
              <ul className="flex flex-col gap-2.5">
                {plan.criteria.map((c) => (
                  <li key={c.id}>
                    <div className="flex items-baseline gap-2 text-[13px] leading-5"><span className="flex-1 font-medium">{c.label}</span><span className="ui-num text-crux-text-secondary">{c.weight}/10</span></div>
                    <p className="text-[12px] leading-4 text-crux-text-tertiary">{c.weightReason}</p>
                  </li>
                ))}
              </ul>
            </Sec>
          </>
        ) : (
          <Sec><p className="text-[13px] text-crux-text-tertiary">Planning — facts, options and criteria appear here shortly.</p></Sec>
        )}
        {detailed ? <Sec><RawReasoning actorId="orchestrator" label="orchestrator" /></Sec> : null}
      </div>
    </>
  )
}

// ---------- Finding ----------

export function FindingView({ findingId, onClose, actions }: { findingId: string; onClose: () => void; actions?: ReactNode }) {
  const finding = useCrux((s) => s.findings[findingId])
  const source = useCrux((s) => (finding ? s.sources[finding.sourceId] : undefined))
  const label = useCrux((s) => (finding ? selectQuestionLabel(s, finding.questionId) : ''))
  const select = useCrux((s) => s.select)
  if (!finding) return null
  const content = source?.content?.slice(0, 4000) ?? ''
  const at = content && finding.quote ? locateQuote(content, finding.quote) : null

  return (
    <>
      <Header kind={`Finding · ${label}`} onClose={onClose} />
      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
        <Sec>
          <p className="text-[15px] leading-[22px] font-medium">{finding.claim}</p>
          <div className="mt-2 flex items-center gap-2">
            <CitationChip finding={finding} />
            <button type="button" className="ui-link text-[12px]" onClick={() => select(nodeId.question(finding.questionId))}>Open {label}</button>
          </div>
          {actions ? <div className="mt-3">{actions}</div> : null}
        </Sec>
        <Sec title="Check"><div className="flex flex-col gap-2">
          {finding.checks.supported && finding.checks.quote === 'verified'
            ? <div className="ui-note neutral !text-crux-ok"><Check />Quote found word for word in the cited source.</div>
            : <CheckNote finding={finding} />}
          <ContradictionBoxes findingId={finding.id} />
        </div></Sec>
        <Sec title="Source excerpt">
          {content && at ? (
            <div className="ui-excerpt ui-scroll" ref={(el) => { el?.querySelector('mark')?.scrollIntoView({ block: 'center' }) }}>
              {content.slice(0, at[0])}<mark>{content.slice(at[0], at[1])}</mark>{content.slice(at[1])}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {finding.quote ? <blockquote className="ui-quote">“{finding.quote}”</blockquote> : null}
              {content ? (
                <>
                  {finding.checks.quote !== 'not_found' && finding.checks.sourceRetrieved ? null : <CheckNote finding={finding} />}
                  <div className="ui-excerpt ui-scroll">{content}</div>
                </>
              ) : <p className="text-[12px] text-crux-text-tertiary">No source text available for this citation.</p>}
            </div>
          )}
          {source ? (
            <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 flex items-start gap-2 text-[12px] leading-4 hover:text-crux-accent-text">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-crux-text">{source.title}</span>
                <span className="ui-mono block truncate text-[11px] text-crux-text-tertiary">{source.url}</span>
              </span>
              <ExternalLink className="!size-3.5 flex-none text-crux-text-quaternary" />
            </a>
          ) : null}
        </Sec>
      </div>
    </>
  )
}

// ---------- Blind spot ----------

export function BlindSpotView({ onClose, actions }: { onClose: () => void; actions?: ReactNode }) {
  const bs = useCrux((s) => s.plan?.blindSpot ?? null)
  if (!bs) return null
  return (
    <>
      <Header kind="Blind spot" onClose={onClose} />
      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
        <Sec>
          <span className="ui-tag neutral">{BLIND_KIND[bs.kind]}</span>
          <p className="mt-2 text-[12px] text-crux-text-tertiary">You may be overlooking:</p>
          <p className="mt-0.5 text-[15px] leading-[22px] font-medium">{bs.text}</p>
          <p className="mt-2 text-[13px] leading-[19px] text-crux-text-secondary">{bs.reason}</p>
          {bs.quote ? <p className="mt-2 text-[12px] leading-4 text-crux-text-tertiary">You said: <span className="italic">“{bs.quote}”</span></p> : null}
          {bs.status === 'answered' && bs.answer ? (
            <div className="mt-3 flex items-start gap-2 text-[13px] leading-[19px] text-crux-text-secondary"><Check className="mt-0.5 flex-none text-crux-ok" />{bs.answer}</div>
          ) : null}
          {bs.status === 'dismissed' ? <p className="mt-3 text-[12px] text-crux-text-tertiary">Dismissed.</p> : null}
        </Sec>
        {actions ? <Sec>{actions}</Sec> : null}
      </div>
    </>
  )
}

// ---------- Recommendation ----------

export function RecommendationView({ onClose, actions }: { onClose: () => void; actions?: ReactNode }) {
  const { syn, status, detailed, plan } = useCrux(useShallow((s) => ({ syn: s.synthesis, status: s.synthesisStatus, detailed: s.viewMode === 'detailed', plan: s.plan })))
  const stale = useCrux(useShallow((s) => { const r = selectRecommendationStale(s); return { stale: r.stale, reasons: r.reasons.join(' · ') } }))
  const findings = useCrux((s) => s.findings)
  const select = useCrux((s) => s.select)
  const optIdx = syn?.optionId && plan ? plan.options.findIndex((o) => o.id === syn.optionId) : -1

  return (
    <>
      <Header kind="Recommendation" onClose={onClose} />
      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto">
        {!syn ? (
          <Sec><p className="text-[13px] text-crux-text-tertiary">
            {status === 'running' ? 'Writing your recommendation…' : status === 'failed' ? "Couldn't write the recommendation." : 'The recommendation is written once the research finishes.'}
          </p></Sec>
        ) : (
          <>
            {stale.stale ? (
              <div className="border-b border-crux-warn-border bg-crux-warn-soft px-4 py-2.5 text-[12.5px] leading-[18px] text-crux-warn">
                New information since this was written. <span className="text-crux-warn/80">({stale.reasons})</span>
                {actions ? <div className="mt-2">{actions}</div> : null}
              </div>
            ) : null}
            <Sec>
              <h2 className="text-[17px] leading-6 font-semibold">{syn.recommendation}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="ui-pill capitalize">{syn.confidence} confidence</span>
                {optIdx >= 0 && plan ? <span className="ui-pill">Option {optionLetter(optIdx)} · {plan.options[optIdx].label}</span> : <span className="ui-pill">Hybrid of the options</span>}
              </div>
              <p className="mt-3 text-[14px] leading-5 text-crux-text-secondary">{syn.summary}</p>
            </Sec>
            {syn.conditions.length ? <Sec title="Conditions"><List items={syn.conditions} /></Sec> : null}
            {syn.reasons.length ? (
              <Sec title="Why">
                <ol className="flex flex-col gap-2.5">
                  {syn.reasons.map((r, i) => (
                    <li key={i} className="text-[13px] leading-[19px]">
                      {r.text}
                      {r.findingIds.length ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {r.findingIds.map((fid) => findings[fid] ? (
                            <CitationChip key={fid} finding={findings[fid]} onClick={() => select(nodeId.finding(fid))} />
                          ) : <span key={fid} className="ui-tag neutral">{fid}</span>)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </Sec>
            ) : null}
            {syn.cruxes.length ? <Sec title="What it hinges on"><List items={syn.cruxes} /></Sec> : null}
            {syn.nextSteps.length ? <Sec title="Next steps"><List items={syn.nextSteps} /></Sec> : null}
            {syn.uncertainties.length ? <Sec title="Uncertainties"><List items={syn.uncertainties} /></Sec> : null}
            <Sec>
              <p className="text-[12px] text-crux-text-tertiary">
                Based on your weights at {new Date(syn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {detailed && plan ? ` · ${plan.criteria.map((c) => `${c.label} ${syn.basedOnWeights[c.id] ?? c.weight}`).join(', ')}` : ''}
              </p>
            </Sec>
          </>
        )}
        {detailed ? <Sec><RawReasoning actorId="orchestrator" label="orchestrator" /></Sec> : null}
      </div>
    </>
  )
}
