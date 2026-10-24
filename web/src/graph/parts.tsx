import { Handle, Position } from '@xyflow/react'
import { BadgeCheck, CircleX, Loader, Quote, TriangleAlert } from 'lucide-react'
import type { AgentStatus, Effort, Finding, Source } from '@shared/index'
import { agentColor, agentNumber } from './helpers'

/** Hidden handles every node carries (§13.1 step 6). */
export function Handles() {
  return (
    <>
      <Handle id="t" type="target" position={Position.Top} className="cx-handle" isConnectable={false} />
      <Handle id="b" type="source" position={Position.Bottom} className="cx-handle" isConnectable={false} />
      <Handle id="l" type="target" position={Position.Left} className="cx-handle" isConnectable={false} />
      <Handle id="r" type="source" position={Position.Right} className="cx-handle" isConnectable={false} />
      <Handle id="rt" type="target" position={Position.Right} className="cx-handle" isConnectable={false} />
    </>
  )
}

export type DotTone = 'queued' | 'active' | 'done' | 'failed'

export function dotTone(status: AgentStatus | null | undefined): DotTone {
  if (!status || status === 'queued') return 'queued'
  if (status === 'done') return 'done'
  if (status === 'failed' || status === 'timeout') return 'failed'
  return 'active'
}

const STATUS_WORD: Record<AgentStatus, string> = {
  queued: 'Queued', searching: 'Searching', reading: 'Reading', thinking: 'Thinking',
  writing: 'Writing', done: 'Done', failed: 'Failed', timeout: 'Timed out',
}

export function statusWord(status: AgentStatus | null | undefined, sourcesRead = 0): string {
  if (!status) return 'Queued'
  if (status === 'reading' && sourcesRead > 0) return `Reading ${sourcesRead}`
  return STATUS_WORD[status]
}

export function StatusDot({ tone, label }: { tone: DotTone; label: string }) {
  return (
    <span className={`cx-st cx-st-${tone}`}>
      <span className="cx-dot" />
      {label}
    </span>
  )
}

const EFFORT_FILLED: Record<Effort, number> = { low: 1, high: 2, max: 3 }
const EFFORT_WORD: Record<Effort, string> = { low: 'Low', high: 'High', max: 'Max' }

export function EffortBadge({ effort }: { effort: Effort }) {
  const filled = EFFORT_FILLED[effort]
  return (
    <span className="cx-eff" aria-label={`${EFFORT_WORD[effort]} effort`}>
      <i>
        {[0, 1, 2].map((i) => <s key={i} className={i < filled ? 'on' : undefined} />)}
      </i>
      {EFFORT_WORD[effort]}
    </span>
  )
}

/** Citation chip: domain + quote-check state (§11.1). `pending` while the source isn't known yet. */
export function CitationChip({ finding, source }: { finding: Finding; source: Source | undefined }) {
  const domain = source?.domain ?? finding.sourceId
  const { sourceRetrieved, quote } = finding.checks
  if (!sourceRetrieved) {
    return <span className="cx-cite cx-cite-bad" title="Source not retrieved"><CircleX /><span className="cx-cite-d">{domain}</span><em>not retrieved</em></span>
  }
  if (!source) return <span className="cx-cite cx-cite-pend"><Loader className="cx-spin" />verifying…</span>
  if (quote === 'verified') return <span className="cx-cite cx-cite-ok" title="Quote checked"><BadgeCheck /><span className="cx-cite-d">{domain}</span></span>
  if (quote === 'partial') {
    return <span className="cx-cite cx-cite-ok" title="Quote is a close match"><BadgeCheck /><span className="cx-cite-d">{domain}</span><em>close match</em></span>
  }
  if (quote === 'not_found') {
    return <span className="cx-cite cx-cite-warn" title="Quote not found in source"><TriangleAlert /><span className="cx-cite-d">{domain}</span></span>
  }
  return <span className="cx-cite" title="No quote given"><Quote className="cx-muted-icon" /><span className="cx-cite-d">{domain}</span><em>no quote</em></span>
}

/** Small numbered agent badge: rounded square filled with the agent colour, white digit. */
export function AgentBadge({ agentId, size = 16 }: { agentId: string; size?: number }) {
  return (
    <span className="cx-abadge" aria-hidden style={{ width: size, height: size, background: agentColor(agentId) }}>
      {agentNumber(agentId)}
    </span>
  )
}
