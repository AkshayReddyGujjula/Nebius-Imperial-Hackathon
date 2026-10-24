import { BadgeCheck, CircleX, Loader, Quote, TriangleAlert } from 'lucide-react'
import type { Finding } from '@shared/index'
import { domainOf } from '@shared/ids'
import { useCrux } from '@/store/runStore'
import { cn } from '@/lib/utils'

export type CiteState = 'verified' | 'partial' | 'not_found' | 'no_quote' | 'not_retrieved' | 'pending'

export function citeState(f: Finding | null | undefined): CiteState {
  if (!f) return 'pending'
  if (!f.checks.sourceRetrieved) return 'not_retrieved'
  return f.checks.quote
}

/** Domain in mono + an icon for the result of the code-run citation check (§11.1). */
export function CitationChip({ finding, onClick, className }: { finding: Finding | null | undefined; onClick?: () => void; className?: string }) {
  const source = useCrux((s) => (finding ? s.sources[finding.sourceId] : undefined))
  const state = citeState(finding)
  const domain = source?.domain ?? (source?.url ? domainOf(source.url) : finding ? finding.sourceId : 'source')
  const tone = state === 'verified' || state === 'partial' ? 'ok'
    : state === 'not_found' ? 'warn' : state === 'not_retrieved' ? 'bad' : 'muted'
  const title = {
    verified: 'Quote found in the source', partial: 'Close match in the source',
    not_found: 'Quote not found in the source', no_quote: 'No quote given',
    not_retrieved: 'Source was never retrieved', pending: 'Checking…',
  }[state]
  const body = (
    <>
      {state === 'verified' || state === 'partial' ? <BadgeCheck /> : null}
      {state === 'not_found' ? <TriangleAlert /> : null}
      {state === 'not_retrieved' ? <CircleX /> : null}
      {state === 'no_quote' ? <Quote /> : null}
      {state === 'pending' ? <Loader className="cx-spin" /> : null}
      <span>{domain}</span>
      {state === 'partial' ? <small>close match</small> : null}
      {state === 'no_quote' ? <small>no quote</small> : null}
    </>
  )
  if (onClick) {
    return (
      <button type="button" title={title} className={cn('cx-cite', tone, className)}
        onClick={(e) => { e.stopPropagation(); onClick() }}>{body}</button>
    )
  }
  return <span title={title} className={cn('cx-cite', tone, className)}>{body}</span>
}
