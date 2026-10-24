import { buildCells, computeTotals, parseNodeId } from '@shared/index'
import type { AgentStatus, MatrixCell, OptionTotal } from '@shared/index'
import { qIndex, SYNTHESIS_NOTICE_ID } from './reducer'
import type { ActivityTone, RunData, UiState } from './types'

type S = RunData & UiState

// ---------- matrix ----------

type MatrixResult = { cells: MatrixCell[]; totals: OptionTotal[]; leader: OptionTotal | null }
const EMPTY_MATRIX: MatrixResult = { cells: [], totals: [], leader: null }
let memo: { plan: S['plan']; proposals: S['proposals']; overrides: S['overrides']; weights: S['weights']; out: MatrixResult } | null = null

export function selectMatrix(s: S): MatrixResult {
  if (!s.plan) return EMPTY_MATRIX
  if (memo && memo.plan === s.plan && memo.proposals === s.proposals && memo.overrides === s.overrides && memo.weights === s.weights)
    return memo.out
  const { options, criteria } = s.plan
  const cells = buildCells(options, criteria, s.proposals, s.overrides)
  const totals = computeTotals(options, criteria, cells, s.weights)
  const leader = totals.find((t) => t.rank === 1 && t.point !== null) ?? null
  const out = { cells, totals, leader }
  memo = { plan: s.plan, proposals: s.proposals, overrides: s.overrides, weights: s.weights, out }
  return out
}

// ---------- recommendation staleness ----------

export function selectRecommendationStale(s: S): { stale: boolean; reasons: string[] } {
  const syn = s.synthesis
  if (!syn) return { stale: false, reasons: [] }
  const reasons: string[] = []
  const based = syn.basedOnWeights
  const ids = new Set([...Object.keys(based), ...Object.keys(s.weights)])
  for (const id of ids) {
    if ((s.weights[id] ?? null) !== (based[id] ?? null)) { reasons.push('Weights changed'); break }
  }
  const factIds = new Set(syn.basedOnFactIds)
  if ((s.plan?.facts ?? []).some((f) => !factIds.has(f.id))) reasons.push('New information from you')
  if (Object.values(s.findingSeq).some((seq) => seq > s.synthesisSeq)) reasons.push('New findings arrived')
  return { stale: reasons.length > 0, reasons }
}

/** Short reason for the last failed (re)synthesis, or null. Cleared when the next synthesis starts. */
export function selectSynthesisError(s: Pick<S, 'notices'>): string | null {
  const msg = s.notices.find((n) => n.id === SYNTHESIS_NOTICE_ID)?.message
  if (msg === undefined) return null
  const line = msg.split(/\r?\n/)[0].trim() || 'unknown error'
  return line.length > 80 ? `${line.slice(0, 79).trimEnd()}…` : line
}

// ---------- per-question trust ----------

export function selectQuestionTrust(s: S, questionId: string): {
  sources: number; findings: number; verified: number; unverified: number;
  contradictions: number; agentStatus: AgentStatus | null;
} {
  const agent = s.agents[s.agentByQuestion[questionId] ?? '']
  if (!agent) return { sources: 0, findings: 0, verified: 0, unverified: 0, contradictions: 0, agentStatus: null }
  const sourceIds = new Set<string>()
  for (const sid of agent.searchIds) for (const src of s.searches[sid]?.sources ?? []) sourceIds.add(src.id)
  const fs = agent.findingIds.map((id) => s.findings[id]).filter(Boolean)
  const mine = new Set(agent.findingIds)
  return {
    sources: sourceIds.size,
    findings: fs.length,
    verified: fs.filter((f) => f.checks.supported).length,
    unverified: fs.filter((f) => !f.checks.supported).length,
    contradictions: s.contradictions.filter((x) => mine.has(x.findingIds[0]) || mine.has(x.findingIds[1])).length,
    agentStatus: agent.status,
  }
}

// ---------- top bar ----------

const TERMINAL: AgentStatus[] = ['done', 'failed', 'timeout']

export function selectTopStatus(s: S, now: number = Date.now()): { label: string; tone: ActivityTone; elapsedMs: number } {
  const elapsedMs = s.startedTs === null ? 0 : Math.max(0, (s.doneTs ?? now) - s.startedTs)
  switch (s.phase) {
    case 'idle': return { label: '', tone: 'neutral', elapsedMs: 0 }
    case 'planning': return { label: 'Planning', tone: 'accent', elapsedMs }
    case 'researching': {
      const all = Object.values(s.agents)
      const active = all.filter((a) => !TERMINAL.includes(a.status)).length
      return { label: `Researching · ${active} of ${all.length} agents active`, tone: 'accent', elapsedMs }
    }
    case 'checking': return { label: 'Checking', tone: 'accent', elapsedMs }
    case 'synthesizing': return { label: 'Writing recommendation', tone: 'accent', elapsedMs }
    case 'done': return { label: 'Done', tone: 'ok', elapsedMs }
    case 'error': return { label: s.fatalError ? `Error · ${s.fatalError}` : 'Error', tone: 'bad', elapsedMs }
  }
}

// ---------- question labels ----------

export function selectQuestionLabel(s: S, questionId: string, depth = 0): string {
  const q = s.plan?.questions.find((x) => x.id === questionId)
  if (!q) return ''
  if (q.origin === 'blindspot') return 'Blind spot'
  if (q.origin === 'dig_deeper' && q.parentNodeId && depth < 5) {
    let parentQ: string | null = null
    try {
      const { kind, ref } = parseNodeId(q.parentNodeId)
      if (kind === 'question') parentQ = ref
      if (kind === 'finding' && ref) parentQ = s.findings[ref]?.questionId ?? null
    } catch { /* unknown parent */ }
    if (parentQ) {
      const base = selectQuestionLabel(s, parentQ, depth + 1).replace(/ · deeper$/, '')
      return `${base} · deeper`
    }
  }
  return `Q${qIndex(s, questionId) + 1}`
}
