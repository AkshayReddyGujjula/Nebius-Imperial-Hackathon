import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

/** Column → recommendation edge. Turns just above the recommendation so it never runs behind cards. */
function BusEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style }: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    centerY: targetY - 24, borderRadius: 6,
  })
  return <BaseEdge id={id} path={path} style={style} />
}

export const BusEdge = memo(BusEdgeImpl)
