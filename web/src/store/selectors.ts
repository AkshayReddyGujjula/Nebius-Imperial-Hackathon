import { clip } from '@/lib/format'
import { buildCells, computeTotals, parseNodeId } from '@shared/index'
import type { AgentStatus, Effort, MatrixCell, OptionTotal } from '@shared/index'
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
  return clip(line, 80)
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
  // A finished run shows its own wall time (server stats freeze at the first done), not time since submit.
  const elapsedMs = s.startedTs === null ? 0
    : s.phase === 'done' && s.stats ? s.stats.wallMs
    : Math.max(0, (s.doneTs ?? now) - s.startedTs)
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

// ---------- rail: models at work + agent rows ----------

export type RoleStatus = 'idle' | 'working' | 'done'
export interface ModelRole { key: 'planner' | 'agents' | 'narrator' | 'auditor' | 'search' | 'memory'; status: RoleStatus; count: number }

const WORKING_AGENT: AgentStatus[] = ['searching', 'reading', 'thinking', 'writing']

/** One status per model role for the "Models at work" panel. Primitive-only fields, so useShallow on a mapped string works. */
export function selectModelRoles(s: S): ModelRole[] {
  const agents = Object.values(s.agents)
  const anyWorking = agents.some((a) => WORKING_AGENT.includes(a.status))
  const allDone = agents.length > 0 && agents.every((a) => TERMINAL.includes(a.status))
  const searches = Object.values(s.searches)
  const finished = s.phase === 'done' || s.phase === 'error'
  const st = (working: boolean, done: boolean): RoleStatus => (working ? 'working' : done ? 'done' : 'idle')
  return [
    { key: 'planner', count: 0, status: st(s.phase === 'planning' || s.synthesisStatus === 'running', !!s.plan) },
    { key: 'agents', count: agents.length, status: st(anyWorking, allDone) },
    { key: 'narrator', count: 0, status: st(!finished && (anyWorking || s.phase === 'planning' || s.synthesisStatus === 'running'), Object.keys(s.reasoning).length > 0) },
    { key: 'auditor', count: s.contradictions.length, status: st(s.phase === 'checking', s.contradictionsStatus !== 'idle') },
    { key: 'search', count: searches.length, status: st(searches.some((x) => x.status === 'running'), searches.length > 0) },
    { key: 'memory', count: s.plan?.facts.length ?? 0, status: st(!finished && s.phase !== 'idle' && !s.plan, !!s.plan) },
  ]
}

export interface AgentRow {
  agentId: string; questionId: string; question: string; effort: Effort; model: string; status: AgentStatus;
  searches: number; budget: number; sourcesRead: number; findings: number; elapsedMs: number;
}

/** Searches an agent may run at its effort: seeded queries plus 2 per extra round (server EFFORT profile). */
export function searchBudget(effort: Effort, extraRounds: number): number {
  return (effort === 'max' ? 3 : 2) + 2 * Math.max(0, extraRounds)
}

/** One row per research agent, ordered by agent number. */
export function selectAgentRows(s: S, now: number = Date.now()): AgentRow[] {
  return Object.values(s.agents)
    .map((a) => ({
      agentId: a.id,
      questionId: a.questionId,
      question: s.plan?.questions.find((q) => q.id === a.questionId)?.text ?? '',
      effort: a.effort,
      model: a.model,
      status: a.status,
      searches: a.searchIds.length,
      budget: searchBudget(a.effort, a.extraRounds),
      sourcesRead: a.sourcesRead,
      findings: a.findingIds.length,
      elapsedMs: a.status === 'queued' ? 0 : Math.max(0, (a.endedAt ?? s.doneTs ?? now) - a.startedAt),
    }))
    .sort((x, y) => Number(x.agentId.replace(/\D/g, '')) - Number(y.agentId.replace(/\D/g, '')))
}
