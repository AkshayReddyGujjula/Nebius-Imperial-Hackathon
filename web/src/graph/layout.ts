import { nodeId, type Finding, type NodeKind, type Plan, type Question } from '@shared/index'
import type { ViewMode } from '../store/types'

export const AUDITOR_ID = 'auditor'
export const MEMORY_ID = 'memory'
export const QUOTECHECK_ID = 'quotecheck'

export const L = {
  colW: 232, colGap: 16, rowGap: 12,
  decisionH: 148, decisionMinW: 480, decisionMaxW: 760, topGap: 64,
  questionH: { simple: 188, detailed: 156 },
  blindspotH: { simple: 188, detailed: 156 },
  findingH: 112,
  auditorH: 132,
  memoryW: 220, memoryH: 150, memoryGap: 40,
  quoteW: 420, quoteH: 76,
  recGap: 56, recH: { simple: 240, detailed: 280 },
} as const

export interface LaidNode {
  id: string
  kind: NodeKind | 'auditor' | 'memory' | 'quotecheck'
  refId: string | null
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutInput {
  plan: Plan | null
  findings: Record<string, Finding>
  viewMode: ViewMode
}

export interface LayoutResult {
  nodes: LaidNode[]
  /** Node ids per column, top to bottom (head first). */
  columns: string[][]
  totalW: number
}

/** Numeric part of an id such as "q12" or "F3", for stable ordering. */
export const idNum = (id: string): number => Number(id.replace(/\D+/g, '')) || 0
const byIdNum = (a: { id: string }, b: { id: string }) => idNum(a.id) - idNum(b.id) || a.id.localeCompare(b.id)

/** Column key a question belongs to: a root question id, or "blindspot". Null when orphaned. */
function rootOf(q: Question, plan: Plan, findings: Record<string, Finding>): string | null {
  const questions = new Map(plan.questions.map((x) => [x.id, x]))
  let cur: Question | undefined = q
  for (let guard = 0; cur && guard < 32; guard++) {
    const p = cur.parentNodeId
    if (p === null) return cur.id
    if (p === nodeId.blindspot) return 'blindspot'
    if (p.startsWith('q:')) cur = questions.get(p.slice(2))
    else if (p.startsWith('f:')) cur = questions.get(findings[p.slice(2)]?.questionId ?? '')
    else return null
  }
  return null
}

export function layoutGraph({ plan, findings, viewMode }: LayoutInput): LayoutResult {
  if (!plan) {
    const w = L.decisionMinW
    return {
      nodes: [{ id: nodeId.decision, kind: 'decision', refId: null, x: 0, y: 0, w, h: L.decisionH }],
      columns: [],
      totalW: w,
    }
  }

  const detailed = viewMode === 'detailed'
  const findingsByQ = new Map<string, Finding[]>()
  for (const f of Object.values(findings)) {
    const list = findingsByQ.get(f.questionId) ?? []
    list.push(f)
    findingsByQ.set(f.questionId, list)
  }
  for (const list of findingsByQ.values()) list.sort(byIdNum)

  const questions = [...plan.questions].sort(byIdNum)
  const roots = questions.filter((q) => q.parentNodeId === null)
  const bs = plan.blindSpot && plan.blindSpot.status !== 'dismissed' ? plan.blindSpot : null

  // DECISION: the blind-spot research question is not drawn as its own card; the blind-spot card
  // carries its status and answer, and its findings stack directly under it. Deeper descendants
  // (dig-deeper on those findings) still stack as question cards.
  const descendants = new Map<string, Question[]>()
  for (const q of questions) {
    if (q.parentNodeId === null || (bs && q.id === bs.questionId)) continue
    const root = rootOf(q, plan, findings)
    if (!root || (root === 'blindspot' && !bs)) continue
    const list = descendants.get(root) ?? []
    list.push(q)
    descendants.set(root, list)
  }

  type Item = { id: string; kind: NodeKind; refId: string | null; h: number }
  const qH = L.questionH[viewMode]
  const findingItems = (questionId: string | null): Item[] =>
    detailed && questionId
      ? (findingsByQ.get(questionId) ?? []).map((f) => ({ id: nodeId.finding(f.id), kind: 'finding', refId: f.id, h: L.findingH }))
      : []
  const questionBlock = (q: Question): Item[] => [
    { id: nodeId.question(q.id), kind: 'question', refId: q.id, h: qH },
    ...findingItems(q.id),
  ]

  const colItems: Item[][] = roots.map((q) => [
    ...questionBlock(q),
    ...(descendants.get(q.id) ?? []).flatMap(questionBlock),
  ])
  if (bs) {
    colItems.push([
      { id: nodeId.blindspot, kind: 'blindspot', refId: bs.id, h: L.blindspotH[viewMode] },
      ...findingItems(bs.questionId),
      ...(descendants.get('blindspot') ?? []).flatMap(questionBlock),
    ])
  }

  const n = colItems.length
  const totalW = n > 0 ? n * L.colW + (n - 1) * L.colGap : L.decisionMinW
  const nodes: LaidNode[] = []
  const decisionW = Math.min(Math.max(totalW, L.decisionMinW), L.decisionMaxW)
  nodes.push({ id: nodeId.decision, kind: 'decision', refId: null, x: (totalW - decisionW) / 2, y: 0, w: decisionW, h: L.decisionH })

  let bottom: number = L.decisionH
  colItems.forEach((items, i) => {
    const x = i * (L.colW + L.colGap)
    let y = L.decisionH + L.topGap
    for (const it of items) {
      nodes.push({ ...it, x, y, w: L.colW })
      y += it.h + L.rowGap
      bottom = Math.max(bottom, y - L.rowGap)
    }
  })

  // DECISION: centre the recommendation like the decision so it stays aligned when totalW < decisionMinW.
  const recW = Math.max(totalW, L.decisionMinW)
  // DECISION: the contradiction auditor sits between the findings and the recommendation, same width.
  // DECISION: findings → code quote check → auditor → brief, so each hand-off is its own visible edge.
  const qcY = bottom + L.recGap
  nodes.push({ id: QUOTECHECK_ID, kind: 'quotecheck', refId: null, x: (totalW - L.quoteW) / 2, y: qcY, w: L.quoteW, h: L.quoteH })
  const audY = qcY + L.quoteH + L.recGap
  nodes.push({ id: AUDITOR_ID, kind: 'auditor', refId: null, x: (totalW - recW) / 2, y: audY, w: recW, h: L.auditorH })
  nodes.push({
    id: nodeId.recommendation, kind: 'recommendation', refId: null,
    x: (totalW - recW) / 2, y: audY + L.auditorH + L.recGap, w: recW, h: L.recH[viewMode],
  })

  // DECISION: shared memory sits left of the agents row; dashed edges fan out to every agent and the brief.
  nodes.push({
    id: MEMORY_ID, kind: 'memory', refId: null,
    x: Math.min(0, (totalW - recW) / 2) - L.memoryGap - L.memoryW, y: L.decisionH + L.topGap, w: L.memoryW, h: L.memoryH,
  })

  return { nodes, columns: colItems.map((items) => items.map((it) => it.id)), totalW }
}
