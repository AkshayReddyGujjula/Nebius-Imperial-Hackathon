import type { Edge, Node } from '@xyflow/react'
import { nodeId, type Contradiction, type Finding } from '@shared/index'
import type { AgentView } from '../store/types'
import { AUDITOR_ID, MEMORY_ID, QUOTECHECK_ID, type LayoutResult } from './layout'
import type { FlowEdgeData } from './edges/FlowEdge'
import { agentColor } from './helpers'

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
  /** Optional hand-off state (packets on edges). */
  findings?: Record<string, Finding>
  phase?: string
  contradictionsStatus?: string
  synthesisStatus?: string
  memorySeq?: number
  memoryChange?: string | null
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

  const { findings = {}, phase = 'idle', contradictionsStatus = 'idle', synthesisStatus = 'idle', memorySeq = 0, memoryChange = null } = input
  const edges: Edge[] = []
  const tree = (
    source: string, target: string, shape: FlowEdgeData['shape'], dashed: boolean, working = false, data: Partial<FlowEdgeData> = {},
  ): Edge => ({
    id: `e:${source}>${target}`,
    source, target, type: 'flow',
    sourceHandle: 'b', targetHandle: 't',
    className: onPath.has(`${source}>${target}`) ? 'edge-active' : working ? 'edge-working' : dashed ? 'edge-queued' : 'edge-solid',
    data: { shape, ...data },
    selectable: false,
    focusable: false,
  })

  const allFindings = Object.values(findings)
  const anyWorking = Object.values(agents).some((a) => WORKING.has(a.status))
  const checking = contradictionsStatus === 'idle' && phase === 'checking'
  const writing = synthesisStatus === 'running'
  const verified = allFindings.filter((f) => f.checks.quote === 'verified' || f.checks.quote === 'partial').length
  const middleCol = Math.floor((layout.columns.length - 1) / 2)

  layout.columns.forEach((col, ci) => {
    if (col.length === 0) return
    const agentId = agentByQuestion[col[0].slice(2)]
    const agent = agents[agentId]
    const color = agentColor(agentId)
    // Planner → agent: a packet carries the brief (agent + effort) the moment the agent spawns.
    const head = tree(nodeId.decision, col[0], 'smooth', headQueued(col[0]), headWorking(col[0]), agent
      ? { packet: `${agent.id.toUpperCase()} · ${agent.effort}`, packetKey: agent.startedAt, tone: color }
      : {})
    // A working agent's edge flows in that agent's colour (quiet earth tone); the dash animation stays in CSS.
    if (head.className === 'edge-working') head.style = { stroke: color }
    edges.push(head)
    for (let i = 1; i < col.length; i++) {
      const fid = col[i].startsWith('f:') ? col[i].slice(2) : null
      edges.push(tree(col[i - 1], col[i], 'straight', false, false, fid ? { packet: fid, packetKey: fid, tone: agentColor(findings[fid]?.agentId) } : {}))
    }
    // Findings → quote check: dots while agents write findings; one labelled packet (middle column) keeps it legible.
    const bus = tree(col[col.length - 1], QUOTECHECK_ID, 'bus', !synthesisReady && allFindings.length === 0, anyWorking && agent?.status !== 'done',
      anyWorking && allFindings.length > 0
        ? { packet: ci === middleCol ? `checking ${allFindings.length} quote${allFindings.length === 1 ? '' : 's'}` : '', packetMode: 'loop', tone: color, dur: 2.8 }
        : {})
    if (bus.className === 'edge-working') bus.style = { stroke: color }
    edges.push(bus)
  })
  if (layout.columns.length > 0) {
    edges.push(tree(QUOTECHECK_ID, AUDITOR_ID, 'straight', allFindings.length === 0, checking,
      checking || contradictionsStatus === 'ready' ? { packet: `${verified} verified`, packetMode: checking ? 'loop' : 'once', packetKey: verified } : {}))
    const tensions = contradictions.length
    edges.push(tree(AUDITOR_ID, nodeId.recommendation, 'straight', !synthesisReady, writing,
      contradictionsStatus === 'ready'
        ? { packet: tensions ? `${tensions} tension${tensions === 1 ? '' : 's'}` : 'no tensions', packetMode: writing ? 'loop' : 'once', packetKey: `${tensions}:${synthesisStatus}`, tone: tensions ? 'var(--crux-contradiction)' : undefined }
        : {}))

    // Shared memory (user.md) → every agent + the brief writer. Each update sends a packet down every edge.
    const memData = (label: string): Partial<FlowEdgeData> =>
      memorySeq > 0 ? { packet: label, packetKey: memorySeq, tone: 'var(--crux-ok)', dur: 1.8 } : {}
    const change = memoryChange ? `+ ${memoryChange.length > 34 ? memoryChange.slice(0, 33) + '…' : memoryChange}` : ''
    layout.columns.forEach((col, ci) => {
      if (col.length === 0) return
      edges.push({
        ...tree(MEMORY_ID, col[0], 'smooth', false, false, memData(ci === 0 ? change : '')),
        id: `m:${col[0]}`, sourceHandle: 'r', targetHandle: ci === 0 ? 'l' : 't', className: 'edge-memory',
      })
    })
    edges.push({
      ...tree(MEMORY_ID, nodeId.recommendation, 'smooth', false, false, memData(change)),
      id: 'm:rec', sourceHandle: 'b', targetHandle: 'l', className: 'edge-memory',
    })
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
