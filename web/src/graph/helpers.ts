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
