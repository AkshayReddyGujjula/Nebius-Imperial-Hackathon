import type { Criterion, Option, ScoreProposal } from "./types";

export type CellOrigin = "ai" | "user" | "none";
export interface MatrixCell {
  optionId: string;
  criterionId: string;
  score: number | null;          // null = unknown (never treated as 0)
  origin: CellOrigin;
  rationale: string;
  findingIds: string[];
  proposalCount: number;
}
export interface OptionTotal {
  optionId: string;
  point: number | null;          // (Σ_known(w·s) + Σ_unknown(w·3)) / Σ(w); null when nothing is known
  min: number | null;            // unknown cells counted as 1
  max: number | null;            // unknown cells counted as 5
  knownCount: number;
  unknownCount: number;
  rank: number;                  // 1 = best; options with point === null rank last
  tooClose: boolean;             // within 0.15 of the leader, or ranges overlap while unknowns exist
}

export const cellKey = (optionId: string, criterionId: string) => `${optionId}|${criterionId}`;

export function effectiveWeight(c: Criterion, weights: Record<string, number>): number {
  const w = weights[c.id] ?? c.weight;
  return Math.max(0, Math.min(10, Math.round(w)));
}

export function buildCells(
  options: Option[], criteria: Criterion[], proposals: ScoreProposal[], overrides: Record<string, number>,
): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const o of options) {
    for (const c of criteria) {
      const key = cellKey(o.id, c.id);
      const ps = proposals.filter((p) => p.optionId === o.id && p.criterionId === c.id);
      const findingIds = [...new Set(ps.flatMap((p) => p.findingIds))];
      if (overrides[key] !== undefined) {
        cells.push({ optionId: o.id, criterionId: c.id, score: overrides[key], origin: "user",
          rationale: "Set by you.", findingIds, proposalCount: ps.length });
      } else if (ps.length > 0) {
        const mean = ps.reduce((s, p) => s + p.score, 0) / ps.length;
        cells.push({ optionId: o.id, criterionId: c.id, score: Math.round(mean * 2) / 2, origin: "ai",
          rationale: ps[ps.length - 1].rationale, findingIds, proposalCount: ps.length });
      } else {
        cells.push({ optionId: o.id, criterionId: c.id, score: null, origin: "none",
          rationale: "", findingIds: [], proposalCount: 0 });
      }
    }
  }
  return cells;
}

export function computeTotals(
  options: Option[], criteria: Criterion[], cells: MatrixCell[], weights: Record<string, number>,
): OptionTotal[] {
  const totalW = criteria.reduce((s, c) => s + effectiveWeight(c, weights), 0);
  const rows: OptionTotal[] = options.map((o) => {
    let knownSum = 0, knownW = 0, unknownW = 0, knownCount = 0, unknownCount = 0;
    for (const c of criteria) {
      const w = effectiveWeight(c, weights);
      const cell = cells.find((x) => x.optionId === o.id && x.criterionId === c.id);
      if (cell && cell.score !== null) { knownSum += w * cell.score; knownW += w; knownCount++; }
      else { unknownW += w; unknownCount++; }
    }
    return {
      optionId: o.id,
      // DECISION: unknown cells count as a neutral 3, so an option is never flattered by its unresearched weak spots.
      point: knownW > 0 && totalW > 0 ? (knownSum + unknownW * 3) / totalW : null,
      min: totalW > 0 ? (knownSum + unknownW * 1) / totalW : null,
      max: totalW > 0 ? (knownSum + unknownW * 5) / totalW : null,
      knownCount, unknownCount, rank: 0, tooClose: false,
    };
  });
  const sorted = [...rows].sort((a, b) => (b.point ?? -Infinity) - (a.point ?? -Infinity));
  sorted.forEach((r, i) => { r.rank = i + 1; });
  const leader = sorted[0];
  if (leader && leader.point !== null) {
    for (const r of sorted.slice(1)) {
      if (r.point === null) continue;
      const closeByPoint = leader.point - r.point < 0.15;
      const overlap = (leader.unknownCount + r.unknownCount) > 0 &&
        leader.min !== null && r.max !== null && r.max > leader.min;
      r.tooClose = closeByPoint || overlap;
    }
    leader.tooClose = sorted.slice(1).some((r) => r.tooClose);
  }
  return rows;
}

export interface BestFit {
  bestId: string | null;
  runnerUpId: string | null;
  margin: number;                // |best.point − runnerUp.point|, 0 when there is no runner-up
  decidedBy: string | null;      // label of the top-weighted criterion that settled a close call
  flipLabel: string | null;      // label of a criterion that, at weight 10, would make a different option win
}

/** Best fit without the flip analysis: totals, then a close call (< 0.3) goes to whoever scores higher on the top-weighted criterion. */
function pickCore(options: Option[], criteria: Criterion[], cells: MatrixCell[], weights: Record<string, number>) {
  const ranked = computeTotals(options, criteria, cells, weights).filter((t) => t.point !== null).sort((a, b) => a.rank - b.rank);
  const leader = ranked[0], second = ranked[1];
  let bestId = leader?.optionId ?? null, runnerUpId = second?.optionId ?? null, decidedBy: string | null = null;
  const margin = leader && second ? Math.abs(leader.point! - second.point!) : 0;
  if (leader && second && margin < 0.3) {
    const top = [...criteria].sort((a, b) => effectiveWeight(b, weights) - effectiveWeight(a, weights))[0];
    const sc = (id: string) => cells.find((c) => c.optionId === id && c.criterionId === top?.id)?.score ?? null;
    const a = sc(leader.optionId), b = sc(second.optionId);
    if (top && a != null && b != null && b > a) { bestId = second.optionId; runnerUpId = leader.optionId; decidedBy = top.label; }
    else if (top && a != null && b != null && a > b) decidedBy = top.label;
  }
  return { bestId, runnerUpId, margin, decidedBy };
}

/** The one best fit the summary shows and the chat names — shared so the UI and the server always agree. */
export function pickBestFit(
  plan: { options: Option[]; criteria: Criterion[] }, cells: MatrixCell[], weights: Record<string, number>,
): BestFit {
  const core = pickCore(plan.options, plan.criteria, cells, weights);
  let flipLabel: string | null = null;
  if (core.bestId) {
    const byWeight = [...plan.criteria].sort((a, b) => effectiveWeight(b, weights) - effectiveWeight(a, weights));
    for (const c of byWeight) {
      if (effectiveWeight(c, weights) >= 10) continue;
      const alt = pickCore(plan.options, plan.criteria, cells, { ...weights, [c.id]: 10 });
      if (alt.bestId && alt.bestId !== core.bestId) { flipLabel = c.label; break; }
    }
  }
  return { ...core, flipLabel };
}
