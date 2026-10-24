import { nodeId, type CruxEvent, type Effort } from '@shared/index'
import type { RunData } from '@/store/types'
import { clip, fmtMs, fmtTokens, fmtUsd } from '@/lib/format'

/** Who produced a card. `kind` picks the avatar glyph and colour. */
export type ActorKind = 'planner' | 'agent' | 'auditor' | 'narrator' | 'writer' | 'memory' | 'check' | 'system' | 'you'
export interface FeedActor { kind: ActorKind; label: string; model: string | null; index: number | null }

export type FeedTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad'
/** 0 = background chatter, 1 = progress, 2 = a result, 3 = needs your attention (pinned until seen). */
export type FeedPriority = 0 | 1 | 2 | 3

export interface FeedItem {
  id: string
  ts: number
  actor: FeedActor
  title: string
  body: string | null
  quote: string | null
  mono: boolean                     // body is a query / code-ish
  chips: { label: string; tone: FeedTone }[]
  tone: FeedTone
  priority: FeedPriority
  nodeId: string | null
}

/** "deepseek-ai/DeepSeek-V4.1-Flash-1017" → "DeepSeek V4.1 Flash"; "nvidia/Nemotron-3_5-Lightning" → "Nemotron 3.5 Lightning". */
export function modelName(model: string | null | undefined): string | null {
  if (!model) return null
  let m = model.includes('/') ? model.slice(model.lastIndexOf('/') + 1) : model
  m = m.replace(/-\d{3,}$/, '').replace(/(\d)_(\d)/g, '$1.$2').replace(/[-_]+/g, ' ')
  return m.trim()
}

/** Drops markdown emphasis / bullets so bodies read as plain text. */
const plain = (t: string) => t.replace(/\*\*|__|`/g, '').replace(/(^|\s)[-*] /g, '$1').replace(/\s+/g, ' ').trim()

const EFFORTS: Effort[] = ['low', 'high', 'max']

type Models = { orchestrator: string; agent: string; summary: string; audit: string }

/** Pure: turns the raw event log into feed cards (oldest first). */
export function buildFeed(log: CruxEvent[], s: Pick<RunData, 'agents' | 'plan' | 'findings' | 'chat' | 'sources'>): FeedItem[] {
  let models: Models | null = null
  const out: FeedItem[] = []
  const narratorAt = new Map<string, number>()   // actorId → index of its latest narrator card (replaced in place)
  const agentIndex = (id: string) => {
    const n = Number(id.replace(/^\D+/, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const agentActor = (agentId: string): FeedActor => {
    const i = agentIndex(agentId)
    return { kind: 'agent', label: i ? `Agent ${i}` : agentId, model: modelName(s.agents[agentId]?.model ?? models?.agent), index: i }
  }
  const actorFor = (actorId: string | null | undefined): FeedActor => {
    if (!actorId || actorId === 'orchestrator') return { kind: 'planner', label: 'Planner', model: modelName(models?.orchestrator), index: null }
    if (actorId === 'auditor') return { kind: 'auditor', label: 'Auditor', model: modelName(models?.audit), index: null }
    if (/^a\d+/.test(actorId)) return agentActor(actorId)
    return { kind: 'system', label: actorId, model: null, index: null }
  }
  const qText = (questionId: string) => s.plan?.questions.find((q) => q.id === questionId)?.text ?? questionId
  const qNode = (agentId: string) => {
    const a = s.agents[agentId]
    return a ? nodeId.question(a.questionId) : null
  }
  const push = (e: CruxEvent, n: number, it: Omit<FeedItem, 'id' | 'ts' | 'chips' | 'quote' | 'mono'> & Partial<Pick<FeedItem, 'chips' | 'quote' | 'mono'>>) => {
    out.push({ id: `fd-${e.seq}-${n}`, ts: e.ts, chips: [], quote: null, mono: false, ...it, body: it.body ? plain(it.body) : null })
  }
  const lastChatId = s.chat.length ? s.chat[s.chat.length - 1].id : null

  for (const e of log) {
    switch (e.type) {
      case 'run.started':
        models = e.models
        push(e, 0, { actor: actorFor('orchestrator'), title: e.replay ? 'Replaying a recorded run' : 'Reading your decision',
          body: clip(e.decision, 140), tone: 'neutral', priority: 1, nodeId: nodeId.decision })
        break
      case 'reasoning.summary': {
        const target = e.actorId === 'orchestrator' ? 'Planner' : e.actorId === 'auditor' ? 'Auditor' : actorFor(e.actorId).label
        const item: FeedItem = {
          id: `fd-nar-${e.actorId}`, ts: e.ts, chips: [], quote: null, mono: false,
          actor: { kind: 'narrator', label: 'Status', model: modelName(models?.summary) ?? 'Nemotron', index: null },
          title: `${target} is thinking`, body: e.text, tone: 'neutral', priority: 0,
          nodeId: /^a\d+/.test(e.actorId) ? qNode(e.actorId) : e.actorId === 'orchestrator' ? nodeId.decision : null,
        }
        const at = narratorAt.get(e.actorId)
        if (at !== undefined) out.splice(at, 1)
        for (const [k, v] of narratorAt) if (at !== undefined && v > at) narratorAt.set(k, v - 1)
        narratorAt.set(e.actorId, out.length)
        out.push(item)
        break
      }
      case 'plan.ready': {
        const p = e.plan
        const efforts = EFFORTS.map((ef) => [ef, p.questions.filter((q) => q.effort === ef).length] as const).filter(([, n]) => n > 0)
        push(e, 0, { actor: actorFor('orchestrator'), title: 'Plan ready',
          body: `${p.options.length} options · ${p.criteria.length} criteria · ${p.questions.length} research questions, all in parallel`,
          chips: [
            ...efforts.map(([ef, n]) => ({ label: `${n}× ${ef} effort`, tone: (ef === 'max' ? 'accent' : 'neutral') as FeedTone })),
            { label: `${fmtMs(e.usage.ms)} · ${fmtTokens(e.usage.reasoningTokens)} reasoning tok`, tone: 'neutral' },
          ],
          tone: 'accent', priority: 2, nodeId: nodeId.decision })
        if (p.blindSpot && p.blindSpot.status === 'open')
          push(e, 1, { actor: actorFor('orchestrator'), title: 'Blind spot: something you didn’t mention',
            body: p.blindSpot.text, quote: p.blindSpot.quote, tone: 'warn',
            // Pinned only while it is still open: once answered, dismissed or researched it drops to the stream.
            priority: (s.plan?.blindSpot?.status ?? 'open') === 'open' ? 3 : 2, nodeId: nodeId.blindspot })
        break
      }
      case 'agent.spawned': {
        const q = s.plan?.questions.find((x) => x.id === e.agent.questionId)
        push(e, 0, { actor: agentActor(e.agent.id), title: `Started: ${clip(qText(e.agent.questionId), 90)}`,
          body: q?.effortReason ? `Why ${e.agent.effort} effort: ${q.effortReason}` : null,
          chips: [{ label: `${e.agent.effort} effort`, tone: e.agent.effort === 'max' ? 'accent' : 'neutral' },
            ...(e.agent.extraRounds ? [{ label: `+${e.agent.extraRounds} search rounds`, tone: 'neutral' as FeedTone }] : [])],
          tone: 'neutral', priority: 1, nodeId: nodeId.question(e.agent.questionId) })
        break
      }
      case 'search.started':
        push(e, 0, { actor: agentActor(e.agentId), title: `Searching the web · round ${e.round + 1}`, body: e.query, mono: true,
          tone: 'neutral', priority: 0, nodeId: qNode(e.agentId) })
        break
      case 'search.done': {
        if (e.error) {
          push(e, 0, { actor: agentActor(e.agentId), title: 'A search failed', body: e.error, tone: 'warn', priority: 1, nodeId: qNode(e.agentId) })
          break
        }
        const domains = [...new Set(e.sources.map((x) => x.domain))].slice(0, 4)
        push(e, 0, { actor: agentActor(e.agentId), title: `Read ${e.sources.length} source${e.sources.length === 1 ? '' : 's'}`,
          body: domains.length ? domains.join(' · ') : null,
          chips: [{ label: fmtMs(e.ms), tone: 'neutral' }],
          tone: 'neutral', priority: 0, nodeId: qNode(e.agentId) })
        break
      }
      case 'finding.added': {
        const f = e.finding
        const src = e.source ?? s.sources[f.sourceId]
        const q = f.checks.quote
        const chip: { label: string; tone: FeedTone } = q === 'verified' ? { label: '✓ Quote verified', tone: 'ok' }
          : q === 'partial' ? { label: '≈ Partial match', tone: 'ok' }
          : q === 'not_found' ? { label: '✕ Quote not found', tone: 'warn' } : { label: 'No quote', tone: 'warn' }
        push(e, 0, { actor: agentActor(f.agentId), title: `Finding ${f.id}`, body: f.claim,
          quote: f.quote ? clip(f.quote, 180) : null,
          chips: [chip, ...(src ? [{ label: src.domain, tone: 'neutral' as FeedTone }] : []), { label: `${f.confidence} confidence`, tone: 'neutral' }],
          tone: f.checks.supported ? 'ok' : 'warn', priority: 1, nodeId: nodeId.finding(f.id) })
        if (!f.checks.supported)
          push(e, 1, { actor: { kind: 'check', label: 'Quote check', model: 'code', index: null },
            title: `${f.id}: ${!f.checks.sourceRetrieved ? 'cited a source the agent never read' : 'quote isn’t in the source'}`,
            body: `Match ${Math.round(f.checks.quoteMatchRatio * 100)}% — this finding is shown, but flagged. Don’t lean on it.`,
            tone: 'warn', priority: 3, nodeId: nodeId.finding(f.id) })
        break
      }
      case 'agent.done': {
        const a = s.agents[e.agentId]
        const fs = (a?.findingIds ?? []).map((id) => s.findings[id]).filter(Boolean)
        const ok = fs.filter((f) => f.checks.supported).length
        if (e.status === 'done')
          push(e, 0, { actor: agentActor(e.agentId), title: `Finished · ${fs.length} finding${fs.length === 1 ? '' : 's'}`,
            body: e.answer ? clip(e.answer, 160) : null,
            chips: [{ label: `${ok}/${fs.length} quotes verified`, tone: ok === fs.length ? 'ok' : 'warn' },
              { label: fmtMs(e.usage.ms), tone: 'neutral' },
              { label: `${fmtTokens(e.usage.inputTokens + e.usage.outputTokens)} tok`, tone: 'neutral' },
              { label: fmtUsd(e.usage.costUsd), tone: 'neutral' }],
            tone: 'ok', priority: 2, nodeId: qNode(e.agentId) })
        else
          push(e, 0, { actor: agentActor(e.agentId), title: e.status === 'timeout' ? 'Timed out' : 'Failed', body: e.error,
            tone: 'bad', priority: 3, nodeId: qNode(e.agentId) })
        break
      }
      case 'question.added':
        push(e, 0, { actor: actorFor('orchestrator'), title: e.question.origin === 'blindspot' ? 'Researching your blind spot' : 'Digging deeper',
          body: e.question.text, tone: 'accent', priority: 1, nodeId: nodeId.question(e.question.id) })
        break
      case 'blindspot.updated':
        if (e.blindSpot.status === 'answered')
          push(e, 0, { actor: actorFor('orchestrator'), title: 'Blind spot answered', body: e.blindSpot.answer, tone: 'ok', priority: 2, nodeId: nodeId.blindspot })
        break
      case 'fact.added':
        push(e, 0, { actor: { kind: 'memory', label: 'Memory', model: 'user.md', index: null }, title: 'Noted a fact about you',
          body: e.fact.text, tone: 'accent', priority: 1, nodeId: nodeId.decision })
        break
      case 'contradictions.ready': {
        if (e.error) { push(e, 0, { actor: actorFor('auditor'), title: 'Audit failed', body: e.error, tone: 'bad', priority: 1, nodeId: null }); break }
        if (!e.contradictions.length) {
          push(e, 0, { actor: actorFor('auditor'), title: 'Audit done · no contradictions', body: 'A different model family read every finding side by side.', tone: 'ok', priority: 1, nodeId: null })
          break
        }
        e.contradictions.forEach((x, i) => push(e, i, { actor: actorFor('auditor'),
          title: `${x.severity === 'direct' ? 'Contradiction' : 'Tension'}: ${x.findingIds[0]} vs ${x.findingIds[1]}`,
          body: x.explanation, tone: 'bad', priority: 3, nodeId: nodeId.finding(x.findingIds[0]) }))
        break
      }
      case 'synthesis.started':
        push(e, 0, { actor: { kind: 'writer', label: 'Writer', model: modelName(models?.orchestrator), index: null },
          title: e.version > 1 ? 'Updating the decision brief' : 'Writing the decision brief', body: null, tone: 'neutral', priority: 1, nodeId: nodeId.recommendation })
        break
      case 'synthesis.ready':
        push(e, 0, { actor: { kind: 'writer', label: 'Writer', model: modelName(models?.orchestrator), index: null },
          title: e.synthesis.version > 1 ? `Decision brief v${e.synthesis.version} ready` : 'Decision brief ready',
          body: clip(e.synthesis.summary, 180),
          chips: [{ label: `${e.synthesis.cruxes.length} cruxes`, tone: 'accent' }, { label: `${e.synthesis.conditions.length} if-then conditions`, tone: 'neutral' }],
          tone: 'ok', priority: 3, nodeId: nodeId.recommendation })
        break
      case 'synthesis.failed':
        push(e, 0, { actor: { kind: 'writer', label: 'Writer', model: modelName(models?.orchestrator), index: null }, title: 'Couldn’t write the brief',
          body: e.error, tone: 'bad', priority: 3, nodeId: nodeId.recommendation })
        break
      case 'memory.updated':
        if (e.changes.length)
          push(e, 0, { actor: { kind: 'memory', label: 'Memory', model: 'user.md', index: null }, title: 'Updated from your answer',
            body: e.changes.join(' · '), tone: 'accent', priority: 2, nodeId: null })
        break
      case 'chat.message':
        if (e.role === 'assistant' && e.id === lastChatId && e.suggestions.length)
          push(e, 0, { actor: { kind: 'you', label: 'For you', model: null, index: null }, title: 'A question is waiting for you',
            body: e.text, tone: 'accent', priority: 3, nodeId: null })
        break
      case 'notice': {
        const retry = /\b(503|429|retry|retrying)\b/i.test(e.message)
        push(e, 0, { actor: { kind: 'system', label: retry ? 'Nebius' : 'Notice', model: null, index: null },
          title: retry ? 'Busy — retrying automatically' : e.level === 'error' ? 'Error' : 'Notice', body: e.message,
          tone: e.level === 'error' ? 'bad' : e.level === 'warn' || retry ? 'warn' : 'neutral',
          priority: e.level === 'error' ? 3 : 1, nodeId: null })
        break
      }
      case 'run.error':
        push(e, 0, { actor: { kind: 'system', label: 'Run', model: null, index: null }, title: e.fatal ? 'Run stopped' : 'Something went wrong',
          body: e.message, tone: 'bad', priority: 3, nodeId: null })
        break
      default:
        break
    }
  }
  return out
}
