import { computeTotals, effectiveWeight, type MatrixCell } from '@shared/matrix'
import type { Criterion, Option } from '@shared/types'

export interface RankFlip {
  criterionId: string
  /** Signed change to that criterion's weight (e.g. +3 = "mattered 3 points more"). */
  delta: number
  from: number
  to: number
  /** The option that would become #1. */
  newLeaderId: string
}

const leaderOf = (options: Option[], criteria: Criterion[], cells: MatrixCell[], weights: Record<string, number>) =>
  computeTotals(options, criteria, cells, weights).find((t) => t.rank === 1 && t.point !== null)?.optionId ?? null

/**
 * Smallest single-weight change (0–10 scale) that would put a different option first.
 * Pure arithmetic over the same `computeTotals` the matrix uses — no model involved.
 * Ties on |delta| prefer raising a weight over lowering one, then criterion order.
 */
export function smallestRankFlip(
  options: Option[], criteria: Criterion[], cells: MatrixCell[], weights: Record<string, number>,
): RankFlip | null {
  const leader = leaderOf(options, criteria, cells, weights)
  if (!leader || options.length < 2) return null
  let best = null as RankFlip | null
  for (const c of criteria) {
    const from = effectiveWeight(c, weights)
    for (let step = 1; step <= 10; step++) {
      if (best && step > Math.abs(best.delta)) break
      for (const delta of [step, -step]) {
        const to = from + delta
        if (to < 0 || to > 10) continue
        const next = leaderOf(options, criteria, cells, { ...weights, [c.id]: to })
        if (next && next !== leader && (!best || step < Math.abs(best.delta) || (step === Math.abs(best.delta) && delta > 0 && best.delta < 0))) {
          best = { criterionId: c.id, delta, from, to, newLeaderId: next }
        }
      }
      if (best && Math.abs(best.delta) === step) break
    }
  }
  return best
}
