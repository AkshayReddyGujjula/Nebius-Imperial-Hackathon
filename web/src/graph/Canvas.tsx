import { useCallback, useEffect, useMemo } from 'react'
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
import './canvas.css'

const nodeTypes: NodeTypes = {
  decision: DecisionNode,
  question: QuestionNode,
  finding: FindingNode,
  blindspot: BlindSpotNode,
  recommendation: RecommendationNode,
}
const edgeTypes: EdgeTypes = { contradiction: ContradictionEdge }
const defaultEdgeOptions = { style: { strokeWidth: 1.25 } }
const FIT = { padding: 0.12, duration: 400, maxZoom: 1 } as const

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
  })))
  const userMovedViewport = useCrux((s) => s.userMovedViewport)
  const { select, selectCell, setUserMovedViewport } = useCrux(useShallow((s) => ({
    select: s.select, selectCell: s.selectCell, setUserMovedViewport: s.setUserMovedViewport,
  })))
  const flow = useReactFlow()

  const layout = useMemo(() => layoutGraph({ plan, findings, viewMode }), [plan, findings, viewMode])
  const nodes = useMemo(() => buildNodes(layout), [layout])
  const edges = useMemo(
    () => buildEdges({ layout, detailed: viewMode === 'detailed', ...edgeState }),
    [layout, viewMode, edgeState],
  )

  // Refit whenever the set of nodes or the mode changes, unless the user has moved the view.
  const nodeKey = useMemo(() => nodes.map((n) => n.id).sort().join('|'), [nodes])
  useEffect(() => {
    if (userMovedViewport) return
    const raf = requestAnimationFrame(() => { void flow.fitView(FIT) })
    return () => cancelAnimationFrame(raf)
  }, [nodeKey, viewMode, userMovedViewport, flow])

  const onMoveStart: OnMoveStart = useCallback((event) => {
    if (event) setUserMovedViewport(true)
  }, [setUserMovedViewport])
  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => select(node.id), [select])
  const onPaneClick = useCallback(() => { select(null); selectCell(null) }, [select, selectCell])
  const fit = useCallback(() => {
    setUserMovedViewport(false)
    void flow.fitView(FIT)
  }, [flow, setUserMovedViewport])

  return (
    <div className="cx-canvas" data-crux-canvas>
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
        proOptions={{ hideAttribution: true }}
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
