import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '@/store/runStore'
import { fmtClock, fmtTokens, fmtUsd } from '@/lib/format'
import { useNow } from '@/components/useNow'
import { modelName } from './buildFeed'

/** One-line facts per model family: why each model has the job it has. */
function modelFact(model: string): string {
  const m = model.toLowerCase()
  if (m.includes('deepseek')) return 'HLE 36.8 → 63.9 with tools; non-hallucination 33% (AA-Omniscience) — that’s why every quote is checked'
  if (m.includes('minimax')) return 'A different model family, so the contradiction audit is independent'
  if (m.includes('nemotron')) return '~0.3 s per status line — narrates what each agent is doing'
  return 'Open model on Nebius'
}

const ROLE: Record<string, string> = { orchestrator: 'Planner + agents + writer', agent: 'Research agents', audit: 'Auditor', summary: 'Narrator' }

export function FeedStats() {
  const { stats, phase, startedTs, doneTs, agents, feedLog, simple } = useCrux(useShallow((s) => ({
    stats: s.stats, phase: s.phase, startedTs: s.startedTs, doneTs: s.doneTs, agents: s.agents, feedLog: s.feedLog,
    simple: s.viewMode === 'simple',
  })))
  const running = phase !== 'idle' && phase !== 'done' && phase !== 'error'
  const now = useNow(running)
  // Mock runs use a fixed epoch, so prefer the server's wall clock when stats are in.
  const elapsed = stats?.wallMs ?? (startedTs ? (doneTs ?? now) - startedTs : 0)

  const { series, models } = useMemo(() => {
    const series: number[] = []
    let models: Record<string, string> | null = null
    for (const e of feedLog) {
      if (e.type === 'stats.updated') series.push(e.stats.inputTokens + e.stats.outputTokens)
      else if (e.type === 'run.started') models = e.models
    }
    return { series, models }
  }, [feedLog])

  const checked = stats ? stats.quoteVerified + stats.quotePartial : 0
  const total = stats?.findings ?? 0
  const agentList = Object.values(agents)
  const maxMs = Math.max(1, ...agentList.map((a) => a.usage?.ms ?? 0))

  // Group roles by model so the shared DeepSeek appears once.
  const modelRows = useMemo(() => {
    if (!models) return []
    const by = new Map<string, string[]>()
    for (const [role, m] of Object.entries(models)) by.set(m, [...(by.get(m) ?? []), role])
    return [...by.entries()].map(([m, roles]) => ({
      model: m, name: modelName(m) ?? m,
      role: roles.includes('orchestrator') && roles.includes('agent') ? ROLE.orchestrator : roles.map((r) => ROLE[r] ?? r).join(' + '),
    }))
  }, [models])

  // Simple mode: one row of three big numbers, nothing else.
  if (simple) {
    return (
      <section className="dl-feed-section dl-feed-stats is-simple" aria-label="Run stats">
        <div className="dl-feed-kpis is-3">
          <Kpi label="Time" value={startedTs ? fmtClock(elapsed) : '–'} />
          <Kpi label="Cost" value={stats ? fmtUsd(stats.costUsd) : '–'} />
          <Kpi label="Quotes" value={total ? `${checked}/${total}` : '–'} hint="Quotes found word-for-word in the cited source" />
        </div>
      </section>
    )
  }

  return (
    <section className="dl-feed-section dl-feed-stats" aria-label="Benchmarks and run stats">
      <div className="dl-feed-label"><span>Benchmarks &amp; run stats</span>{running ? <span className="dl-feed-pulse">live</span> : null}</div>
      <div className="dl-feed-kpis">
        <Kpi label="Tokens" value={stats ? fmtTokens(stats.inputTokens + stats.outputTokens) : '–'}>
          <Sparkline values={series} />
        </Kpi>
        <Kpi label="Cost" value={stats ? fmtUsd(stats.costUsd) : '–'} />
        <Kpi label="Elapsed" value={startedTs ? fmtClock(elapsed) : '–'} />
        <Kpi label="Parallel" value={stats ? `${stats.speedup.toFixed(1)}×` : '–'} hint="faster than one at a time" />
      </div>
      <div className="dl-feed-meter" title="Quotes found word-for-word in the cited source">
        <div className="dl-feed-meter-row">
          <span>Quotes verified</span>
          <span className="ui-num">{checked}/{total}</span>
        </div>
        <div className="dl-feed-bar"><span className="ok" style={{ width: total ? `${(checked / total) * 100}%` : '0%' }} />
          {stats && total ? <span className="warn" style={{ width: `${((stats.quoteNotFound + stats.noQuote) / total) * 100}%` }} /> : null}
        </div>
      </div>
      {agentList.length ? (
        <div className="dl-feed-agents" aria-label="Time per agent">
          {agentList.map((a) => {
            const done = a.usage !== null
            const ms = a.usage?.ms ?? 0
            return (
              <div key={a.id} className="dl-feed-agent-row">
                <span className="dl-feed-agent-id ui-num">{a.id.toUpperCase()}</span>
                <div className="dl-feed-bar thin">
                  <span className={done ? 'ok' : 'run'} style={{ width: done ? `${Math.max(4, (ms / maxMs) * 100)}%` : '100%' }} />
                </div>
                <span className="dl-feed-agent-v ui-num">{done ? `${(ms / 1000).toFixed(1)} s · ${fmtTokens(a.usage!.inputTokens + a.usage!.outputTokens)}` : a.status}</span>
              </div>
            )
          })}
        </div>
      ) : null}
      {modelRows.length ? (
        <details className="dl-feed-models-wrap" open={typeof window === 'undefined' || window.innerHeight >= 880}>
          <summary>Models in use · {modelRows.length}</summary>
          <ul className="dl-feed-models">
          {modelRows.map((r) => (
            <li key={r.model}>
              <div className="dl-feed-model-name"><span>{r.name}</span><span className="dl-feed-model-role">{r.role}</span></div>
              <p>{modelFact(r.model)}</p>
            </li>
          ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}

function Kpi({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="dl-feed-kpi" title={hint}>
      <div className="l">{label}</div>
      <div className="v ui-num">{value}</div>
      {children}
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values) || 1
  const w = 64, h = 14
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ')
  return (
    <svg className="dl-feed-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  )
}
