import type { CruxEvent, EventOf, Question } from '@shared/index'
import { nodeId, parseNodeId } from '@shared/ids'
import { fmtMs } from '@/lib/format'
import type { ActivityItem, ActivityTone, AgentView, ReasoningView, RunData, UiState } from './types'

export type ReducerState = RunData & UiState
export type ReducerPatch = Partial<RunData & UiState>

const RAW_LIMIT = 30_000
const SUMMARY_LIMIT = 20

// ---------- label helpers (shared with selectors) ----------

export function qIndex(s: Pick<RunData, 'plan'>, questionId: string): number {
  return s.plan ? s.plan.questions.findIndex((q) => q.id === questionId) : -1
}
export function qLabel(s: Pick<RunData, 'plan'>, questionId: string): string {
  const i = qIndex(s, questionId)
  return i >= 0 ? `Q${i + 1}` : 'Q?'
}
export function qShort(s: Pick<RunData, 'plan'>, questionId: string): string {
  const q = s.plan?.questions.find((x) => x.id === questionId)
  const t = q?.text ?? ''
  return t.length > 48 ? `${t.slice(0, 47).trimEnd()}…` : t
}
export function prettyModel(model: string): string {
  return model.includes('/') ? model.slice(model.lastIndexOf('/') + 1) : model
}

function item(
  e: CruxEvent, n: number, tone: ActivityTone, simple: string | null, title: string,
  detail: string | null = null, actorId: string | null = null, node: string | null = null,
): ActivityItem {
  return { id: `act-${e.seq}-${n}`, ts: e.ts, actorId, tone, simple, title, detail, nodeId: node }
}

function patchAgent(s: ReducerState, agentId: string, patch: (a: AgentView) => Partial<AgentView>): Record<string, AgentView> | null {
  const a = s.agents[agentId]
  if (!a) return null
  return { ...s.agents, [agentId]: { ...a, ...patch(a) } }
}

function questionNode(s: ReducerState, agentId: string): string | null {
  const a = s.agents[agentId]
  return a ? nodeId.question(a.questionId) : null
}

function upsertQuestion(qs: Question[], q: Question): Question[] {
  const i = qs.findIndex((x) => x.id === q.id)
  if (i < 0) return [...qs, q]
  const next = qs.slice(); next[i] = q; return next
}

// ---------- reducer ----------

/** Pure: returns the state patch for one event, or null when the event is ignored. */
export function reduce(s: ReducerState, e: CruxEvent): ReducerPatch | null {
  if (e.seq <= s.lastSeq) return null
  if (s.runId !== null && e.runId !== s.runId) return null

  const p = apply(s, e)
  const acts = p.acts
  delete p.acts
  const out: ReducerPatch = { ...p, lastSeq: e.seq }
  if (s.runId === null) out.runId = e.runId
  if (acts && acts.length) out.activity = [...(p.activity ?? s.activity), ...acts]
  return out
}

type Patch = ReducerPatch & { acts?: ActivityItem[] }

function apply(s: ReducerState, e: CruxEvent): Patch {
  switch (e.type) {
    case 'run.started':
      return {
        decision: e.decision, inputMode: e.inputMode, replay: e.replay, startedTs: e.ts, phase: 'planning',
        acts: [item(e, 0, 'neutral', 'Understanding your decision…', 'Run started',
          `orchestrator: ${prettyModel(e.models.orchestrator)} · max`, 'orchestrator', nodeId.decision)],
      }

    case 'run.phase': {
      const out: Patch = { phase: e.phase }
      if (e.phase === 'done') out.doneTs = e.ts
      const n = s.plan?.questions.length ?? Object.keys(s.agents).length
      const copy: Partial<Record<typeof e.phase, [string, string, ActivityTone]>> = {
        researching: [`Researching ${n} questions at once`, 'Research started', 'neutral'],
        checking: ['Double-checking the evidence', 'Checking citations and contradictions', 'neutral'],
        synthesizing: ['Writing your recommendation…', 'Synthesis started', 'neutral'],
        done: [`Done in ${fmtMs(e.ts - (s.startedTs ?? e.ts))}`, 'Run finished', 'ok'],
      }
      const c = copy[e.phase]
      if (c) out.acts = [item(e, 0, c[2], c[0], c[1], null, null, e.phase === 'done' ? nodeId.recommendation : null)]
      return out
    }

    case 'reasoning.chunk': {
      const prev: ReasoningView = s.reasoning[e.actorId] ?? { raw: '', summary: null, summaries: [] }
      let raw = prev.raw + e.text
      if (raw.length > RAW_LIMIT) raw = raw.slice(raw.length - RAW_LIMIT)
      return { reasoning: { ...s.reasoning, [e.actorId]: { ...prev, raw } } }
    }

    case 'reasoning.summary': {
      const prev: ReasoningView = s.reasoning[e.actorId] ?? { raw: '', summary: null, summaries: [] }
      const summaries = [...prev.summaries, { ts: e.ts, text: e.text }].slice(-SUMMARY_LIMIT)
      return { reasoning: { ...s.reasoning, [e.actorId]: { ...prev, summary: e.text, summaries } } }
    }

    case 'plan.ready': {
      const { plan, usage } = e
      const weights: Record<string, number> = {}
      for (const c of plan.criteria) weights[c.id] = c.weight
      const factSeq = { ...s.factSeq }
      for (const f of plan.facts) factSeq[f.id] = e.seq
      return {
        plan, weights, overrides: {}, factSeq,
        acts: [item(e, 0, 'neutral',
          `Planned ${plan.questions.length} questions, ${plan.options.length} options and ${plan.criteria.length} criteria`,
          'Orchestrator planned the tree',
          `${prettyModel(usage.model)} · max · ${fmtMs(usage.ms)} · ${usage.reasoningTokens} reasoning tok`,
          'orchestrator', nodeId.decision)],
      }
    }

    case 'agent.spawned': {
      const a = e.agent
      const view: AgentView = {
        ...a, status: 'queued', round: 0, sourcesRead: 0, note: null, answer: '', gaps: [], usage: null,
        error: null, endedAt: null, searchIds: [], findingIds: [],
      }
      const q = s.plan?.questions.find((x) => x.id === a.questionId)
      return {
        agents: { ...s.agents, [a.id]: view },
        agentByQuestion: { ...s.agentByQuestion, [a.questionId]: a.id },
        acts: [item(e, 0, 'neutral', null, `Spawned ${qLabel(s, a.questionId)}`,
          `${a.effort} effort · ${q?.effortReason ?? ''}`.replace(/ · $/, ''), a.id, nodeId.question(a.questionId))],
      }
    }

    case 'agent.status': {
      const agents = patchAgent(s, e.agentId, () => ({ status: e.status, round: e.round, sourcesRead: e.sourcesRead, note: e.note }))
      return agents ? { agents } : {}
    }

    case 'search.started': {
      const searches = {
        ...s.searches,
        [e.searchId]: { id: e.searchId, agentId: e.agentId, round: e.round, query: e.query, status: 'running' as const,
          sources: [], ms: 0, error: null, ts: e.ts },
      }
      const agents = patchAgent(s, e.agentId, (a) => ({ searchIds: [...a.searchIds, e.searchId] }))
      const qid = s.agents[e.agentId]?.questionId
      return {
        searches, ...(agents ? { agents } : {}),
        acts: [item(e, 0, 'neutral', null, `${qid ? qLabel(s, qid) : e.agentId} search`, `"${e.query}"`,
          e.agentId, questionNode(s, e.agentId))],
      }
    }

    case 'search.done': {
      const prev = s.searches[e.searchId]
      const searches = {
        ...s.searches,
        [e.searchId]: {
          ...(prev ?? { id: e.searchId, agentId: e.agentId, round: 0, query: '', ts: e.ts }),
          status: e.error ? 'failed' as const : 'done' as const, sources: e.sources, ms: e.ms, error: e.error,
        },
      }
      const out: Patch = { searches }
      if (e.error) {
        const qid = s.agents[e.agentId]?.questionId ?? ''
        out.acts = [item(e, 0, 'warn', `A search failed for ${qShort(s, qid)}`, `${qLabel(s, qid)} search failed`,
          e.error, e.agentId, questionNode(s, e.agentId))]
      }
      return out
    }

    case 'finding.added': {
      const f = e.finding
      const out: Patch = {
        findings: { ...s.findings, [f.id]: f },
        findingSeq: { ...s.findingSeq, [f.id]: e.seq },
      }
      if (e.source) out.sources = { ...s.sources, [e.source.id]: e.source }
      const agents = patchAgent(s, f.agentId, (a) => ({
        findingIds: a.findingIds.includes(f.id) ? a.findingIds : [...a.findingIds, f.id],
      }))
      if (agents) out.agents = agents
      if (!f.checks.supported) {
        const why = !f.checks.sourceRetrieved ? 'source not retrieved' : 'quote not found'
        out.acts = [item(e, 0, 'warn', "One quote couldn't be verified", `${qLabel(s, f.questionId)}: ${why}`,
          f.claim, f.agentId, nodeId.finding(f.id))]
      }
      return out
    }

    case 'scores.proposed':
      return { proposals: [...s.proposals, ...e.proposals] }

    case 'agent.done': {
      const agents = patchAgent(s, e.agentId, () => ({
        status: e.status, answer: e.answer, gaps: e.gaps, usage: e.usage, error: e.error, endedAt: e.ts,
      }))
      if (!agents) return {}
      const a = agents[e.agentId]
      const fs = a.findingIds.map((id) => s.findings[id]).filter(Boolean)
      const k = fs.length
      const verified = fs.filter((f) => f.checks.supported).length
      const node = nodeId.question(a.questionId)
      const acts = e.status === 'done'
        ? [item(e, 0, 'ok', `Found ${k} findings on ${qShort(s, a.questionId)}`, `${qLabel(s, a.questionId)} finished`,
          `${k} findings · ${verified}/${k} quotes verified · ${fmtMs(e.usage.ms)}`, e.agentId, node)]
        : [item(e, 0, 'bad', `Couldn't finish: ${qShort(s, a.questionId)}`,
          `${qLabel(s, a.questionId)} ${e.status === 'timeout' ? 'timed out' : 'failed'}`, e.error, e.agentId, node)]
      return { agents, acts }
    }

    case 'question.added': {
      if (!s.plan) return {}
      const plan = { ...s.plan, questions: upsertQuestion(s.plan.questions, e.question) }
      const blind = e.question.origin === 'blindspot'
      const t = e.question.text.length > 48 ? `${e.question.text.slice(0, 47).trimEnd()}…` : e.question.text
      return {
        plan,
        acts: [item(e, 0, 'accent', blind ? 'Researching your blind spot' : `Digging deeper: ${t}`,
          blind ? 'Blind spot research started' : 'Dig deeper started', e.question.text, null, nodeId.question(e.question.id))],
      }
    }

    case 'blindspot.updated': {
      if (!s.plan) return {}
      const out: Patch = { plan: { ...s.plan, blindSpot: e.blindSpot } }
      if (e.blindSpot.status === 'answered' && e.blindSpot.questionId)
        out.acts = [item(e, 0, 'ok', 'Blind spot researched', 'Blind spot researched', e.blindSpot.answer, null, nodeId.blindspot)]
      return out
    }

    case 'fact.added': {
      const factSeq = { ...s.factSeq, [e.fact.id]: e.seq }
      const acts = [item(e, 0, 'accent', `Noted: ${e.fact.text}`, 'Fact added', e.fact.text, null, nodeId.decision)]
      if (!s.plan) return { factSeq, acts }
      const facts = s.plan.facts.some((f) => f.id === e.fact.id)
        ? s.plan.facts.map((f) => (f.id === e.fact.id ? e.fact : f))
        : [...s.plan.facts, e.fact]
      return { plan: { ...s.plan, facts }, factSeq, acts }
    }

    case 'contradictions.ready': {
      const n = e.contradictions.length
      const out: Patch = { contradictions: e.contradictions, contradictionsStatus: e.error ? 'failed' : 'ready' }
      if (n > 0) {
        const first = s.findings[e.contradictions[0].findingIds[0]]
        out.acts = [item(e, 0, 'warn', `Agents disagree on ${n} point${n === 1 ? '' : 's'}`,
          `Auditor found ${n} contradiction${n === 1 ? '' : 's'}`, prettyModel(e.usage?.model ?? e.contradictions[0].model),
          'auditor', first ? nodeId.finding(first.id) : null)]
      }
      return out
    }

    case 'synthesis.started':
      return { synthesisStatus: 'running' }

    case 'synthesis.ready':
      return {
        synthesis: e.synthesis, synthesisSeq: e.seq, synthesisStatus: 'ready',
        acts: [item(e, 0, 'ok', 'Recommendation ready', 'Recommendation ready', e.synthesis.recommendation,
          'orchestrator', nodeId.recommendation)],
      }

    case 'synthesis.failed':
      return {
        synthesisStatus: 'failed',
        acts: [item(e, 0, 'bad', "Couldn't write the recommendation", 'Synthesis failed', e.error, 'orchestrator', nodeId.recommendation)],
      }

    case 'stats.updated':
      return { stats: e.stats }

    case 'ladder.started':
      return { ladders: { ...s.ladders, [e.ladderId]: { id: e.ladderId, questionId: e.questionId, arms: s.ladders[e.ladderId]?.arms ?? {} } } }

    case 'ladder.arm': {
      const prev = s.ladders[e.ladderId] ?? { id: e.ladderId, questionId: '', arms: {} }
      return { ladders: { ...s.ladders, [e.ladderId]: { ...prev, arms: { ...prev.arms, [e.arm.effort]: e.arm } } } }
    }

    case 'plan.updated': {
      const weights = { ...s.weights }
      for (const c of e.plan.criteria) if (weights[c.id] === undefined) weights[c.id] = c.weight
      const factSeq = { ...s.factSeq }
      for (const f of e.plan.facts) if (factSeq[f.id] === undefined) factSeq[f.id] = e.seq
      return {
        plan: e.plan, weights, factSeq,
        acts: [item(e, 0, 'accent', `Updated the plan: ${e.reason}`, 'Plan updated', e.reason, 'orchestrator', nodeId.decision)],
      }
    }

    case 'nodes.stale': return applyStale(s, e)

    case 'notice': {
      const tone: ActivityTone = e.level === 'error' ? 'bad' : e.level === 'warn' ? 'warn' : 'neutral'
      return {
        notices: [...s.notices, { id: `n-${e.seq}`, level: e.level, message: e.message, ts: e.ts }],
        acts: [item(e, 0, tone, null, e.message)],
      }
    }

    case 'run.error': {
      const out: Patch = { acts: [item(e, 0, 'bad', `Something went wrong: ${e.message}`, 'Run error', e.message)] }
      if (e.fatal) { out.fatalError = e.message; out.phase = 'error' }
      return out
    }

    default: {
      const _never: never = e
      void _never
      return {}
    }
  }
}

function applyStale(s: ReducerState, e: EventOf<'nodes.stale'>): Patch {
  const qids = new Set<string>(), fids = new Set<string>()
  for (const id of e.nodeIds) {
    try {
      const { kind, ref } = parseNodeId(id)
      if (kind === 'question' && ref) qids.add(ref)
      if (kind === 'finding' && ref) fids.add(ref)
    } catch { /* unknown node id */ }
  }
  const out: Patch = {}
  if (s.plan && qids.size) out.plan = { ...s.plan, questions: s.plan.questions.map((q) => (qids.has(q.id) ? { ...q, stale: true } : q)) }
  if (fids.size) {
    const findings = { ...s.findings }
    for (const id of fids) if (findings[id]) findings[id] = { ...findings[id], stale: true }
    out.findings = findings
  }
  return out
}
