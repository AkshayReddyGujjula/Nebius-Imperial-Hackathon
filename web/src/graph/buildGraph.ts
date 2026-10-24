import type { Edge, Node } from '@xyflow/react'
import { nodeId, type Contradiction } from '@shared/index'
import type { AgentView } from '../store/types'
import type { LayoutResult } from './layout'

export type CruxNodeData = { refId: string | null }
export type CruxNode = Node<CruxNodeData>
export type ContradictionEdgeData = { contradictionId: string; findingA: string }

export interface EdgeInput {
  layout: LayoutResult
  agents: Record<string, AgentView>
  agentByQuestion: Record<string, string>
  blindSpotStatus: string | null
  synthesisReady: boolean
  contradictions: Contradiction[]
  detailed: boolean
  selectedNodeId: string | null
}

export function buildNodes(layout: LayoutResult): CruxNode[] {
  return layout.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: n.x, y: n.y },
    width: n.w,
    height: n.h,
    style: { width: n.w, height: n.h },
    data: { refId: n.refId },
    draggable: false,
    connectable: false,
  }))
}

/** Parent of each node in the tree (decision for column heads, the previous node otherwise). */
function parentMap(layout: LayoutResult): Map<string, string> {
  const parents = new Map<string, string>()
  for (const col of layout.columns) {
    col.forEach((id, i) => parents.set(id, i === 0 ? nodeId.decision : col[i - 1]))
  }
  return parents
}

export function buildEdges(input: EdgeInput): Edge[] {
  const { layout, agents, agentByQuestion, blindSpotStatus, synthesisReady, contradictions, detailed, selectedNodeId } = input
  const parents = parentMap(layout)

  // Edges on the selected node's path, keyed "source>target".
  const onPath = new Set<string>()
  for (let cur = selectedNodeId; cur && parents.has(cur); ) {
    const p = parents.get(cur)!
    onPath.add(`${p}>${cur}`)
    cur = p
  }

  const headQueued = (headId: string): boolean => {
    if (headId === nodeId.blindspot) return blindSpotStatus === 'open'
    const status = agents[agentByQuestion[headId.slice(2)]]?.status
    return !status || status === 'queued'
  }
  // The decision → question edge flows while that question's agent is searching, reading, thinking or writing.
  const WORKING = new Set(['searching', 'reading', 'thinking', 'writing'])
  const headWorking = (headId: string): boolean => {
    if (headId === nodeId.blindspot) return false
    const status = agents[agentByQuestion[headId.slice(2)]]?.status
    return !!status && WORKING.has(status)
  }

  const edges: Edge[] = []
  const tree = (source: string, target: string, type: 'smoothstep' | 'straight' | 'bus', dashed: boolean, working = false): Edge => ({
    id: `e:${source}>${target}`,
    source, target, type,
    sourceHandle: 'b', targetHandle: 't',
    className: onPath.has(`${source}>${target}`) ? 'edge-active' : working ? 'edge-working' : dashed ? 'edge-queued' : 'edge-solid',
    selectable: false,
    focusable: false,
  })

  for (const col of layout.columns) {
    if (col.length === 0) continue
    edges.push(tree(nodeId.decision, col[0], 'smoothstep', headQueued(col[0]), headWorking(col[0])))
    for (let i = 1; i < col.length; i++) edges.push(tree(col[i - 1], col[i], 'straight', false))
    edges.push(tree(col[col.length - 1], nodeId.recommendation, 'bus', !synthesisReady))
  }

  if (detailed) {
    const colOf = new Map<string, number>()
    layout.columns.forEach((col, i) => col.forEach((id) => colOf.set(id, i)))
    for (const c of contradictions) {
      let [a, b] = c.findingIds.map((id) => nodeId.finding(id))
      if (!colOf.has(a) || !colOf.has(b)) continue
      if (colOf.get(a)! > colOf.get(b)!) [a, b] = [b, a]
      // DECISION: two findings in the same column connect right-to-right so the line does not cross the cards.
      const sameColumn = colOf.get(a) === colOf.get(b)
      edges.push({
        id: `x:${c.id}`,
        type: 'contradiction',
        source: a, target: b,
        sourceHandle: 'r', targetHandle: sameColumn ? 'rt' : 'l',
        data: { contradictionId: c.id, findingA: a } satisfies ContradictionEdgeData,
        selectable: false,
        focusable: false,
        zIndex: 1,
      })
    }
  }
  return edges
}
