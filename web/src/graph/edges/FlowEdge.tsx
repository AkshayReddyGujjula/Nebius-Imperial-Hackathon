import { memo, useEffect, useRef } from 'react'
import { BaseEdge, getSmoothStepPath, getStraightPath, type Edge, type EdgeProps } from '@xyflow/react'

export interface FlowEdgeData extends Record<string, unknown> {
  /** Path shape: smoothstep (default), straight, or a bus that turns just above the target. */
  shape?: 'smooth' | 'straight' | 'bus'
  /** Text carried by the travelling packet; dot only when empty. */
  packet?: string | null
  /** 'loop' repeats while the hand-off is live; 'once' plays when packetKey changes. */
  packetMode?: 'loop' | 'once'
  packetKey?: string | number
  /** Packet colour (CSS). */
  tone?: string
  /** Seconds for one trip. */
  dur?: number
}

type FlowEdgeType = Edge<FlowEdgeData, 'flow'>

const CHAR_W = 6.8

/** A tree edge that can carry a small labelled "packet" from source to target (agent hand-offs). */
function FlowEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, data }: EdgeProps<FlowEdgeType>) {
  const shape = data?.shape ?? 'smooth'
  const [path] = shape === 'straight'
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getSmoothStepPath({
        sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 6,
        ...(shape === 'bus' ? { centerY: targetY - 24 } : {}),
      })
  const packet = data?.packet
  const mode = data?.packetMode ?? 'once'
  const show = packet !== undefined

  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      {show && (
        <Packet
          key={mode === 'once' ? `${data?.packetKey ?? ''}` : 'loop'}
          path={path}
          label={packet ?? ''}
          loop={mode === 'loop'}
          tone={data?.tone ?? 'var(--crux-accent)'}
          dur={data?.dur ?? (mode === 'loop' ? 2.4 : 1.6)}
        />
      )}
    </>
  )
}

function Packet({ path, label, loop, tone, dur }: { path: string; label: string; loop: boolean; tone: string; dur: number }) {
  const ref = useRef<SVGAnimateMotionElement>(null)
  const gRef = useRef<SVGGElement>(null)
  // DECISION: SMIL begin="0s" is relative to document load, so a packet mounted mid-run would already be
  // finished; start it explicitly on mount instead.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    try { el.beginElement(); if (gRef.current) gRef.current.style.opacity = '1' } catch { /* jsdom has no SMIL */ }
    if (loop) return
    const t = window.setTimeout(() => { if (gRef.current) gRef.current.style.opacity = '0' }, dur * 1000 + 600)
    return () => window.clearTimeout(t)
  }, [loop, dur])
  const w = label ? Math.ceil(label.length * CHAR_W) + 14 : 0
  return (
    <g ref={gRef} className="cx-packet" pointerEvents="none" style={{ opacity: 0 }}>
      <animateMotion ref={ref} begin="indefinite" dur={`${dur}s`} path={path} fill="freeze" repeatCount={loop ? 'indefinite' : '1'} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
      <circle r={4} fill={tone} stroke="var(--crux-surface)" strokeWidth={1.5} />
      {label && (
        <g transform="translate(9 -9)">
          <rect x={0} y={-9} width={w} height={18} rx={9} fill="var(--crux-surface)" stroke={tone} strokeWidth={1} />
          <text x={7} y={4} className="cx-packet-t" fill="var(--crux-text)">{label}</text>
        </g>
      )}
    </g>
  )
}

export const FlowEdge = memo(FlowEdgeImpl)
