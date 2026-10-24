import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useCrux } from '../../store/runStore'
import { Handles } from '../parts'

interface Props {
  id: string
  className?: string
  children: ReactNode
  label?: string
}

/** Common node frame: entry motion, selection ring, hidden handles. */
export function NodeShell({ id, className = '', children, label }: Props) {
  const selected = useCrux((s) => s.selectedNodeId === id)
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={`cx-node ${className}${selected ? ' is-selected' : ''}`}
      aria-label={label}
      aria-selected={selected}
    >
      <Handles />
      {children}
    </motion.div>
  )
}
