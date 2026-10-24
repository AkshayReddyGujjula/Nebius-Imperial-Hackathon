import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { FileText } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '../../store/runStore'
import type { CruxNode } from '../buildGraph'
import { NodeShell } from './NodeShell'

/** user.md — the shared memory every agent and the brief writer read. Pulses when it changes. */
function MemoryNodeImpl({ id }: NodeProps<CruxNode>) {
  const { seq, changes, lines } = useCrux(useShallow((s) => ({
    seq: s.memorySeq,
    changes: s.memoryChanges,
    lines: s.memory.split('\n').filter((l) => l.trim().startsWith('- ')).length,
  })))
  return (
    <NodeShell id={id} className="cx-node-memory" label="Shared memory user.md">
      {seq > 0 && (
        <motion.span
          key={seq}
          className="cx-mem-pulse"
          initial={{ opacity: 0.9, scale: 1 }}
          animate={{ opacity: 0, scale: 1.08 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          aria-hidden
        />
      )}
      <div className="cx-k">
        <FileText />
        user.md
        <span className="cx-byline cx-ellipsis">· shared memory</span>
      </div>
      <div className="cx-body cx-mem-body nowheel">
        {seq === 0 ? (
          <span className="cx-muted">Fills in as you talk. Every agent reads it.</span>
        ) : (
          <>
            <motion.div key={seq} initial={{ backgroundColor: 'var(--crux-ok-soft, #E6F0E8)' }} animate={{ backgroundColor: 'rgba(0,0,0,0)' }} transition={{ duration: 2.4 }} className="cx-mem-change">
              {changes.slice(0, 2).map((c, i) => <div key={i}>+ {c}</div>)}
            </motion.div>
          </>
        )}
      </div>
      <div className="cx-foot cx-meta-mono">
        {seq > 0 ? `${lines} notes · read by all` : 'empty'}
      </div>
    </NodeShell>
  )
}

export const MemoryNode = memo(MemoryNodeImpl)
