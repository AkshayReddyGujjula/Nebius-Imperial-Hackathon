import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCrux } from '@/store/runStore'
import { selectMatrix } from '@/store/selectors'

/** One slim row of "How this was decided" chips. Renders nothing until a synthesis or best fit exists. */
export function DecisionReceipt() {
  const { synthesis, leader, sources, stats, contradictions, contradictionsStatus, agents, plan, weights, feedLog } = useCrux(useShallow((s) => ({
    synthesis: s.synthesis, leader: selectMatrix(s).leader, sources: s.sources, stats: s.stats,
    contradictions: s.contradictions, contradictionsStatus: s.contradictionsStatus,
    agents: s.agents, plan: s.plan, weights: s.weights, feedLog: s.feedLog,
  })))

  const modelCount = useMemo(() => {
    for (let i = feedLog.length - 1; i >= 0; i--) {
      const e = feedLog[i]
      if (e.type === 'run.started') return new Set(Object.values(e.models)).size
    }
    return 0
  }, [feedLog])

  if (!synthesis && !leader) return null

  // Same maths as the live feed: verified + partial out of all findings.
  const checked = stats ? stats.quoteVerified + stats.quotePartial : 0
  const total = stats?.findings ?? 0
  const sourceCount = Object.keys(sources).length
  const agentCount = Object.keys(agents).length
  const top = plan?.criteria.reduce<{ label: string; w: number } | null>((best, c) => {
    const w = weights[c.id] ?? c.weight
    return !best || w > best.w ? { label: c.label, w } : best
  }, null)

  const chips: { icon: string; text: string; accent?: boolean }[] = []
  if (sourceCount) chips.push({ icon: '🔎', text: `${sourceCount} source${sourceCount === 1 ? '' : 's'} read` })
  if (total) chips.push({ icon: '✓', text: `${checked}/${total} quotes verified`, accent: checked === total })
  if (contradictionsStatus === 'ready') {
    const k = contradictions.length
    chips.push({ icon: '⚖', text: k ? `MiniMax found ${k} conflict${k === 1 ? '' : 's'}` : 'MiniMax found no conflicts' })
  }
  if (top) chips.push({ icon: '🎯', text: `Ranked by your top priority: ${top.label}`, accent: true })
  if (agentCount || modelCount) {
    chips.push({ icon: '⧉', text: [agentCount ? `${agentCount} agent${agentCount === 1 ? '' : 's'}` : null, modelCount ? `${modelCount} model${modelCount === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') })
  }
  if (!chips.length) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="How this was decided">
      <span className="mr-0.5 text-[11px] font-medium tracking-[0.04em] text-crux-text-tertiary uppercase">How this was decided</span>
      {chips.map((c) => (
        <span key={c.text}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] leading-4 whitespace-nowrap ${c.accent
            ? 'border-crux-accent-border bg-crux-accent-soft text-crux-accent-text'
            : 'border-crux-border bg-crux-surface text-crux-text-secondary'}`}>
          <span aria-hidden className="text-[11px]">{c.icon}</span>
          <span className="ui-num">{c.text}</span>
        </span>
      ))}
    </div>
  )
}
