import type { Plan } from '@shared/index'
import type { CruxStore } from '../store/types'

/** "Q{n}" where n is the 1-based position in plan.questions (§12.2). */
export function qLabel(plan: Plan | null, questionId: string): string {
  const i = plan?.questions.findIndex((q) => q.id === questionId) ?? -1
  return i >= 0 ? `Q${i + 1}` : ''
}

/** Labels of the questions whose findings contradict this question's findings. */
export function disagreesWith(s: CruxStore, questionId: string): string[] {
  const out = new Set<string>()
  for (const c of s.contradictions) {
    const [a, b] = c.findingIds.map((id) => s.findings[id]?.questionId)
    if (a === questionId && b && b !== questionId) out.add(qLabel(s.plan, b))
    if (b === questionId && a && a !== questionId) out.add(qLabel(s.plan, a))
  }
  return [...out].filter(Boolean).sort()
}

/** Stop pointer events inside a node from selecting it or panning the canvas. */
export const stop = (e: { stopPropagation(): void }) => e.stopPropagation()

// ---------- agent identity ----------

const MODEL_NAMES: [RegExp, string, string][] = [
  [/deepseek/i, 'DeepSeek V4.1 Flash', 'DeepSeek'],
  [/nemotron/i, 'Nemotron 3.5', 'Nemotron'],
  [/minimax/i, 'MiniMax M3.1', 'MiniMax'],
  [/tavily/i, 'Tavily', 'Tavily'],
]

/** Display name for a model id; falls back to the id without its vendor prefix. */
export function modelName(id: string | null | undefined, short = false): string {
  if (!id) return ''
  for (const [re, full, brief] of MODEL_NAMES) if (re.test(id)) return short ? brief : full
  return id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id
}

/** 1-based agent number from its id ("a3" → 3). */
export function agentNumber(agentId: string | null | undefined): number {
  const n = Number(/(\d+)$/.exec(agentId ?? '')?.[1])
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** Stable colour slot 1..6 by agent number (dig-deeper agents continue at 5, 6, then wrap). */
export const agentSlot = (agentId: string | null | undefined) => ((agentNumber(agentId) - 1) % 6) + 1
const AGENT_FALLBACK = ['#3E5C76', '#8B5E3C', '#56704F', '#7A4A5C', '#5E6B7A', '#9A7B3B']
export const slotColor = (slot: number) => `var(--dl-agent-${slot}, ${AGENT_FALLBACK[slot - 1]})`
export const agentColor = (agentId: string | null | undefined) => slotColor(agentSlot(agentId))
export const agentSoft = (agentId: string | null | undefined) =>
  `var(--dl-agent-${agentSlot(agentId)}-soft, color-mix(in srgb, ${agentColor(agentId)} 12%, transparent))`
