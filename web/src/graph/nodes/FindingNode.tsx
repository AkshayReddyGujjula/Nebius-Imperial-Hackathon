import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { motion, useReducedMotion } from 'motion/react'
import { BadgeCheck, GitCompareArrows, TriangleAlert } from 'lucide-react'
import { useCrux } from '../../store/runStore'
import type { CruxNode } from '../buildGraph'
import { agentColor } from '../helpers'
import { CitationChip } from '../parts'
import { NodeShell } from './NodeShell'
import '../activity.css'

function FindingNodeImpl({ id, data }: NodeProps<CruxNode>) {
  const fid = data.refId ?? ''
  const finding = useCrux((s) => s.findings[fid])
  const source = useCrux((s) => (finding ? s.sources[finding.sourceId] : undefined))
  const contradicted = useCrux((s) => s.contradictions.some((c) => c.findingIds.includes(fid)))
  const reduce = useReducedMotion()
  if (!finding) return null

  const unsupported = !finding.checks.supported
  const verified = finding.checks.sourceRetrieved && (finding.checks.quote === 'verified' || finding.checks.quote === 'partial')
  const cls = unsupported ? 'is-warn' : ''
  return (
    <NodeShell id={id} className={cls} dim={finding.stale} label={finding.claim} accent={agentColor(finding.agentId)} pop>
      <motion.span
        className={`ax-stamp ${verified ? 'ax-stamp-ok' : 'ax-stamp-warn'}`}
        initial={reduce ? false : { opacity: 0, scale: 1.8, rotate: -14 }}
        animate={{ opacity: 0.9, scale: 1, rotate: -4 }}
        transition={{ delay: reduce ? 0 : 0.35, duration: 0.3, ease: [0.2, 0, 0, 1] }}
        title={verified ? 'Quote found in the source' : 'Quote could not be verified'}
      >
        {verified ? <BadgeCheck /> : <TriangleAlert />}
        {verified ? 'Verified' : 'Unverified'}
      </motion.span>
      <div className="cx-body cx-body-strong cx-clamp-3 ax-claim-pad">
        <span className="ax-fid">{finding.id}</span>{finding.claim}
      </div>
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
