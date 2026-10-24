import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { GitCompareArrows } from 'lucide-react'
import { useCrux } from '../../store/runStore'
import type { CruxNode } from '../buildGraph'
import { agentColor } from '../helpers'
import { CitationChip } from '../parts'
import { NodeShell } from './NodeShell'

function FindingNodeImpl({ id, data }: NodeProps<CruxNode>) {
  const fid = data.refId ?? ''
  const finding = useCrux((s) => s.findings[fid])
  const source = useCrux((s) => (finding ? s.sources[finding.sourceId] : undefined))
  const contradicted = useCrux((s) => s.contradictions.some((c) => c.findingIds.includes(fid)))
  if (!finding) return null

  const unsupported = !finding.checks.supported
  const cls = unsupported ? 'is-warn' : ''
  return (
    <NodeShell id={id} className={cls} dim={finding.stale} label={finding.claim} accent={agentColor(finding.agentId)}>
      <div className="cx-body cx-body-strong cx-clamp-3">{finding.claim}</div>
      <div className="cx-foot">
        <CitationChip finding={finding} source={source} />
        {contradicted && (
          <span className="cx-flag cx-flag-bad" title="Flagged by MiniMax M3.1 (auditor)"><GitCompareArrows />Contradiction</span>
        )}
      </div>
    </NodeShell>
  )
}

export const FindingNode = memo(FindingNodeImpl)
