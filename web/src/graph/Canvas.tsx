import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider, useReactFlow,
  type EdgeTypes, type NodeMouseHandler, type NodeTypes, type OnMoveStart,
} from '@xyflow/react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '../store/runStore'
import { buildEdges, buildNodes } from './buildGraph'
import { layoutGraph } from './layout'
import { StatusDot } from './parts'
import { DecisionNode } from './nodes/DecisionNode'
import { QuestionNode } from './nodes/QuestionNode'
import { FindingNode } from './nodes/FindingNode'
import { BlindSpotNode } from './nodes/BlindSpotNode'
import { RecommendationNode } from './nodes/RecommendationNode'
import { ContradictionEdge } from './edges/ContradictionEdge'
import { BusEdge } from './edges/BusEdge'
import { AuditorNode } from './nodes/AuditorNode'
import { MemoryNode } from './nodes/MemoryNode'
import { QuoteCheckNode } from './nodes/QuoteCheckNode'
import { ChatOutNode } from './nodes/ChatOutNode'
import { FlowEdge } from './edges/FlowEdge'
import './canvas.css'

const nodeTypes: NodeTypes = {
  decision: DecisionNode,
  question: QuestionNode,
  finding: FindingNode,
  blindspot: BlindSpotNode,
  recommendation: RecommendationNode,
  auditor: AuditorNode,
  memory: MemoryNode,
  quotecheck: QuoteCheckNode,
  chatout: ChatOutNode,
}
// DECISION: column → recommendation edges use a custom smoothstep ("bus") that turns just above the
// recommendation; the stock smoothstep turns at the midpoint and runs behind finding cards.
// Tree edges are 'flow' edges: same shapes, plus travelling packets on agent hand-offs.
const edgeTypes: EdgeTypes = { contradiction: ContradictionEdge, bus: BusEdge, flow: FlowEdge }
const defaultEdgeOptions = { style: { strokeWidth: 1.25 } }
// Pixel padding: clears the legend overlay at the top and keeps cards as large as possible for a projector.
const FIT_DETAILED = { padding: { top: '56px', right: '24px', bottom: '64px', left: '24px' }, duration: 400, maxZoom: 1 } as const
// Simple mode leaves room for the floating question card at the centre-bottom of the canvas.
const FIT_SIMPLE = { ...FIT_DETAILED, padding: { ...FIT_DETAILED.padding, bottom: '128px' } } as const
let FIT: typeof FIT_DETAILED | typeof FIT_SIMPLE = FIT_DETAILED

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

function CanvasInner() {
  const { plan, findings, viewMode } = useCrux(useShallow((s) => ({ plan: s.plan, findings: s.findings, viewMode: s.viewMode })))
  const edgeState = useCrux(useShallow((s) => ({
    agents: s.agents,
    agentByQuestion: s.agentByQuestion,
    blindSpotStatus: s.plan?.blindSpot?.status ?? null,
    synthesisReady: s.synthesisStatus === 'ready',
    contradictions: s.contradictions,
    selectedNodeId: s.selectedNodeId,
    findings: s.findings,
    phase: s.phase,
    contradictionsStatus: s.contradictionsStatus,
    synthesisStatus: s.synthesisStatus,
    memorySeq: s.memorySeq,
    memoryChange: s.memoryChanges[0] ?? null,
    askSeq: s.chat.filter((m) => m.role === 'assistant').length,
  })))
  const userMovedViewport = useCrux((s) => s.userMovedViewport)
  const { select, selectCell, setUserMovedViewport } = useCrux(useShallow((s) => ({
    select: s.select, selectCell: s.selectCell, setUserMovedViewport: s.setUserMovedViewport,
  })))
  const flow = useReactFlow()
  FIT = viewMode === 'simple' ? FIT_SIMPLE : FIT_DETAILED

  const layout = useMemo(() => layoutGraph({ plan, findings, viewMode }), [plan, findings, viewMode])
  const nodes = useMemo(() => buildNodes(layout), [layout])
  const edges = useMemo(
    () => buildEdges({ layout, detailed: viewMode === 'detailed', ...edgeState }),
    [layout, viewMode, edgeState],
  )

  // Refit whenever node ids, positions or sizes change (the tree grows, Simple/Detailed), unless the user moved the view.
  const fitKey = useMemo(() => nodes.map((n) => `${n.id}:${n.position.x}:${n.position.y}:${n.width}:${n.height}`).join('|'), [nodes])
  useEffect(() => {
    if (userMovedViewport) return
    const raf = requestAnimationFrame(() => { void flow.fitView(FIT) })
    return () => cancelAnimationFrame(raf)
  }, [fitKey, userMovedViewport, flow])

  // DECISION: the pane changes size after mount (the rail and matrix bar appear once a run starts), and the
  // initial fitView prop only fits once against the first size — so refit on every container resize too.
  const paneRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = paneRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!useCrux.getState().userMovedViewport) void flow.fitView({ ...FIT, duration: 0 })
      })
    })
    ro.observe(el)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [flow])

  const onMoveStart: OnMoveStart = useCallback((event) => {
    if (event) setUserMovedViewport(true)
  }, [setUserMovedViewport])
  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => { if (node.type !== 'auditor' && node.type !== 'memory' && node.type !== 'quotecheck' && node.type !== 'chatout') select(node.id) }, [select])
  const onPaneClick = useCallback(() => { select(null); selectCell(null) }, [select, selectCell])
  const fit = useCallback(() => {
    setUserMovedViewport(false)
    void flow.fitView(FIT)
  }, [flow, setUserMovedViewport])

  return (
    <div ref={paneRef} className="cx-canvas" data-crux-canvas>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnDoubleClick={false}
        minZoom={0.3}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: FIT.padding, maxZoom: FIT.maxZoom }}
        onMoveStart={onMoveStart}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#DCDCE0" />
      </ReactFlow>

      <div className="cx-overlay cx-overlay-tl cx-legend" aria-label="Status legend">
        <StatusDot tone="queued" label="Queued" />
        <StatusDot tone="active" label="Searching" />
        <StatusDot tone="active" label="Reading" />
        <StatusDot tone="done" label="Done" />
        <StatusDot tone="failed" label="Failed" />
      </div>
      <div className="cx-overlay cx-overlay-tr">
        <span className="cx-hint">Click any card for details</span>
        <button type="button" className="cx-icon-btn" onClick={fit} aria-label="Fit to view" title="Fit to view">
          <Maximize />
        </button>
      </div>
      <div className="cx-overlay cx-overlay-bl">
        <div className="cx-zoom">
          <button type="button" className="cx-icon-btn" onClick={() => { setUserMovedViewport(true); void flow.zoomOut({ duration: 150 }) }} aria-label="Zoom out" title="Zoom out"><Minus /></button>
          <button type="button" className="cx-icon-btn" onClick={() => { setUserMovedViewport(true); void flow.zoomIn({ duration: 150 }) }} aria-label="Zoom in" title="Zoom in"><Plus /></button>
        </div>
      </div>
    </div>
  )
}
