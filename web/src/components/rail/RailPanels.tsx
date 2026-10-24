import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { nodeId } from '@shared/index'
import { useCrux } from '@/store/runStore'
import { selectAgentRows, selectModelRoles, type AgentRow, type ModelRole, type RoleStatus } from '@/store/selectors'
import { fmtClock } from '@/lib/format'
import { agentColor, agentNumber, modelName } from '@/graph/helpers'
import { AgentBadge } from '@/graph/parts'
import './rail.css'

const ROLE_LABEL: Record<ModelRole['key'], (n: number) => [string, string]> = {
  planner: () => ['Planner', 'DeepSeek V4.1 Flash (max)'],
  agents: (n) => [n > 0 ? `Research agents ×${n}` : 'Research agents', 'DeepSeek V4.1 Flash'],
  narrator: () => ['Narrator', 'Nemotron 3.5'],
  auditor: () => ['Auditor', 'MiniMax M3.1'],
  search: () => ['Search', 'Tavily'],
  memory: () => ['Memory', 'user.md · shared by all agents'],
}
const ROLE_WORD: Record<RoleStatus, string> = { idle: 'Idle', working: 'Working', done: 'Done' }

function RoleDot({ status }: { status: RoleStatus }) {
  return <span key={status} className={`dl-rdot dl-rdot-${status} dl-fade`} aria-label={ROLE_WORD[status]} title={ROLE_WORD[status]} />
}

/** "Models at work": one compact row per role with a live status dot. */
export function ModelsPanel() {
  const key = useCrux((s) => selectModelRoles(s).map((r) => `${r.key}:${r.status}:${r.count}`).join('|'))
  const roles = useMemo(() => key.split('|').map((p) => {
    const [k, status, count] = p.split(':')
    return { key: k as ModelRole['key'], status: status as RoleStatus, count: Number(count) }
  }), [key])
  return (
    <section className="dl-panel" aria-label="Models at work">
      <div className="dl-h">Models at work</div>
      <ul className="dl-roles">
        {roles.map((r) => {
          const [role, model] = ROLE_LABEL[r.key](r.count)
          return (
            <li key={r.key} className="dl-role">
              <RoleDot status={r.status} />
              <span className="dl-role-n">{role}</span>
              <span className="dl-role-m" title={model}>{model}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const STATUS_WORD: Record<string, string> = {
  queued: 'Queued', searching: 'Searching', reading: 'Reading', thinking: 'Thinking',
  writing: 'Writing', done: 'Done', failed: 'Failed', timeout: 'Failed',
}
const EFFORT_WORD = { low: 'Low', high: 'High', max: 'Max' } as const

function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

/** Agents list: one row per research agent; clicking selects that question on the canvas. */
export function AgentsList() {
  const running = useCrux((s) => s.phase !== 'done' && s.phase !== 'error' && s.phase !== 'idle')
  const now = useTick(running)
  const deps = useCrux(useShallow((s) => [s.agents, s.plan, s.doneTs] as const))
  const rows = useMemo(() => {
    const s = useCrux.getState()
    return selectAgentRows(s, now)
  }, [deps, now])
  const selected = useCrux((s) => s.selectedNodeId)
  const select = useCrux((s) => s.select)
  if (rows.length === 0) return null
  return (
    <section className="dl-panel" aria-label="Agents">
      <div className="dl-h">Agents</div>
      <ul className="dl-agents">
        {rows.map((r) => (
          <AgentRowView key={r.agentId} row={r} selected={selected === nodeId.question(r.questionId)}
            onClick={() => select(nodeId.question(r.questionId))} />
        ))}
      </ul>
    </section>
  )
}

function AgentRowView({ row: r, selected, onClick }: { row: AgentRow; selected: boolean; onClick: () => void }) {
  const done = r.status === 'done'
  const failed = r.status === 'failed' || r.status === 'timeout'
  const pct = done || failed ? 100 : Math.min(100, Math.round((r.searches / Math.max(1, r.budget)) * 100))
  const word = STATUS_WORD[r.status] ?? r.status
  return (
    <li className="dl-enter">
      <button type="button" className={`dl-agent${selected ? ' is-on' : ''}`} onClick={onClick}
        title={`Agent ${agentNumber(r.agentId)} · ${modelName(r.model || 'deepseek')} · ${EFFORT_WORD[r.effort]} effort\n${r.question}`}>
        <span className="dl-agent-top">
          <AgentBadge agentId={r.agentId} />
          <span className="dl-agent-n">Agent {agentNumber(r.agentId)}</span>
          <span className="dl-eff">{EFFORT_WORD[r.effort]}</span>
          <span key={word} className={`dl-st dl-fade${failed ? ' is-bad' : done ? ' is-ok' : r.status === 'queued' ? '' : ' is-work'}`}>{word}</span>
        </span>
        <span className="dl-agent-q">{r.question}</span>
        <span className="dl-agent-meta">
          {r.searches}/{r.budget} searches · {r.sourcesRead} read · {r.findings} finding{r.findings === 1 ? '' : 's'}
          <span className="dl-time">{r.elapsedMs > 0 ? fmtClock(r.elapsedMs) : ''}</span>
        </span>
        <span className="dl-bar" aria-hidden>
          <span style={{ width: `${pct}%`, background: failed ? 'var(--crux-bad, #A33B2B)' : agentColor(r.agentId) }} />
        </span>
      </button>
    </li>
  )
}

/** Who did a feed item: label + colour. */
export function actorTag(actorId: string | null): { label: string; color: string } | null {
  if (!actorId) return null
  if (actorId === 'orchestrator') return { label: 'Planner', color: 'var(--crux-accent, #1F4D3A)' }
  if (actorId === 'auditor') return { label: 'Auditor', color: 'var(--dl-frame-text, #1C1B17)' }
  if (/^a\d+$/.test(actorId)) return { label: `Agent ${agentNumber(actorId)}`, color: agentColor(actorId) }
  return null
}
