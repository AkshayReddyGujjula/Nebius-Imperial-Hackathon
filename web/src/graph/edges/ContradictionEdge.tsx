import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react'
import { GitCompareArrows } from 'lucide-react'
import { useCrux } from '../../store/runStore'
import type { ContradictionEdgeData } from '../buildGraph'

type ContradictionEdgeType = Edge<ContradictionEdgeData, 'contradiction'>

function ContradictionEdgeImpl(props: EdgeProps<ContradictionEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const select = useCrux((s) => s.select)
  // DECISION: the label is icon-only; columns are 16 px apart, so a worded pill would cover card text.
  // Both finding cards already carry a worded "Contradiction" flag.
  const sameSide = sourcePosition === targetPosition
  // DECISION: findings stacked in one column bow out to the right instead of using a flat bezier.
  const [path, labelX, labelY] = sameSide
    ? (() => {
        const bow = 11
        const mx = Math.max(sourceX, targetX) + bow
        const d = `M ${sourceX} ${sourceY} C ${mx} ${sourceY}, ${mx} ${targetY}, ${targetX} ${targetY}`
        return [d, Math.max(sourceX, targetX) + 8, (sourceY + targetY) / 2] as const
      })()
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  return (
    <>
      <BaseEdge id={id} path={path} className="cx-contra-path" style={{ stroke: 'var(--crux-contradiction)', strokeDasharray: '3 3', strokeWidth: 1.25 }} />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="cx-contra nodrag nopan"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          aria-label="Contradiction"
          title="Contradiction: these findings disagree"
          onClick={(e) => { e.stopPropagation(); if (data) select(data.findingA) }}
        >
          <GitCompareArrows />
        </button>
      </EdgeLabelRenderer>
    </>
  )
}

export const ContradictionEdge = memo(ContradictionEdgeImpl)
