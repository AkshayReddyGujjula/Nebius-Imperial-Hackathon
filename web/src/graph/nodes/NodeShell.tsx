import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useCrux } from '../../store/runStore'
import { Handles } from '../parts'

interface Props {
  id: string
  className?: string
  children: ReactNode
  label?: string
  /** Stale/superseded: rendered at 50% opacity (motion owns the inline opacity, so it goes here). */
  dim?: boolean
  /** CSS colour for a 2 px top hairline (agent identity). */
  accent?: string
}

/** Common node frame: entry motion, selection ring, hidden handles. */
export function NodeShell({ id, className = '', children, label, dim = false, accent }: Props) {
  const selected = useCrux((s) => s.selectedNodeId === id)
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: dim ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={`cx-node ${className}${selected ? ' is-selected' : ''}`}
      aria-label={label}
      aria-selected={selected}
    >
      <Handles />
      {accent ? <span className="cx-hair" style={{ background: accent }} aria-hidden /> : null}
      {children}
    </motion.div>
  )
}
