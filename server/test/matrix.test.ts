import { describe, expect, it } from "vitest";
import { buildCells, cellKey, computeTotals, pickBestFit } from "@shared/matrix";
import type { Criterion, Option, ScoreProposal } from "@shared/types";

const options: Option[] = [
  { id: "o1", label: "Attend", description: "", origin: "user" },
  { id: "o2", label: "Revise", description: "", origin: "user" },
];
const criteria: Criterion[] = [
  { id: "c1", label: "Exam performance", description: "", weight: 5, weightReason: "" },
  { id: "c2", label: "Career value", description: "", weight: 5, weightReason: "" },
];
const proposal = (optionId: string, criterionId: string, score: number): ScoreProposal => ({
  optionId, criterionId, score, rationale: "Supported by research", findingIds: ["F1"], agentId: "a1",
});

describe("trade-off matrix", () => {
  it("averages fully known scores with equal weights for two options and two criteria", () => {
    const cells = buildCells(options, criteria, [
      proposal("o1", "c1", 2), proposal("o1", "c2", 5),
      proposal("o2", "c1", 5), proposal("o2", "c2", 3),
    ], {});
    const rows = computeTotals(options, criteria, cells, {});
    expect(rows[0]).toMatchObject({ point: 3.5, min: 3.5, max: 3.5, knownCount: 2, unknownCount: 0 });
    expect(rows[1]).toMatchObject({ point: 4, min: 4, max: 4, knownCount: 2, unknownCount: 0 });
  });

  it("counts an unknown score as a neutral 3 in the point and uses 1/5 for the uncertainty bounds", () => {
    const cells = buildCells(options, criteria, [
      proposal("o1", "c1", 4), proposal("o2", "c1", 2), proposal("o2", "c2", 3),
    ], {});
    expect(cells.find((c) => c.optionId === "o1" && c.criterionId === "c2"))
      .toMatchObject({ score: null, origin: "none" });
    expect(computeTotals(options, criteria, cells, {})[0])
      .toMatchObject({ point: 3.5, min: 2.5, max: 4.5, knownCount: 1, unknownCount: 1 });
  });

  it("ignores a criterion whose weight is zero", () => {
    const cells = buildCells(options, criteria, [
      proposal("o1", "c1", 2), proposal("o1", "c2", 5), proposal("o2", "c1", 4),
    ], {});
    const rows = computeTotals(options, criteria, cells, { c2: 0 });
    expect(rows[0]).toMatchObject({ point: 2, min: 2, max: 2, rank: 2, tooClose: false });
    expect(rows[1]).toMatchObject({ point: 4, min: 4, max: 4, rank: 1, tooClose: false });
  });

  it("assigns ranks from one to n and places null points last", () => {
    const threeOptions: Option[] = [...options, { id: "o3", label: "Hybrid", description: "", origin: "ai" }];
    const cells = buildCells(threeOptions, criteria, [proposal("o1", "c1", 3), proposal("o3", "c1", 5)], {});
    const rows = computeTotals(threeOptions, criteria, cells, {});
    expect(rows.map(({ optionId, point, rank }) => ({ optionId, point, rank }))).toEqual([
      { optionId: "o1", point: 3, rank: 2 },
      { optionId: "o2", point: null, rank: 3 },
      { optionId: "o3", point: 4, rank: 1 },
    ]);
  });

  it("marks both options too close when their known points differ by less than 0.15", () => {
    const cells = buildCells(options, criteria, [
      proposal("o1", "c1", 4), proposal("o1", "c2", 4),
      proposal("o2", "c1", 4), proposal("o2", "c2", 3),
    ], {});
    const rows = computeTotals(options, criteria, cells, { c1: 9, c2: 1 });
    expect(rows[0]).toMatchObject({ point: 4, tooClose: true });
    expect(rows[1]).toMatchObject({ point: 3.9, tooClose: true });
    expect(rows.every((r) => r.unknownCount === 0)).toBe(true);
  });

  it("replaces an AI score with the user override while retaining its evidence", () => {
    const proposals = [proposal("o1", "c1", 2)];
    expect(buildCells(options, criteria, proposals, {})[0]).toMatchObject({ score: 2, origin: "ai" });
    expect(buildCells(options, criteria, proposals, { [cellKey("o1", "c1")]: 5 })[0]).toEqual({
      optionId: "o1", criterionId: "c1", score: 5, origin: "user", rationale: "Set by you.",
      findingIds: ["F1"], proposalCount: 1,
    });
  });

  it("does not let an unknown cell flatter an option", () => {
    const crit: Criterion[] = [
      { id: "c1", label: "Exam performance", description: "", weight: 6, weightReason: "" },
      { id: "c2", label: "Wellbeing", description: "", weight: 10, weightReason: "" },
    ];
    // A: exam 4, Wellbeing unknown. B: exam 4, Wellbeing 2. Old maths ignored A's gap: A = 4 vs B = 2.75.
    const cells = buildCells(options, crit, [proposal("o1", "c1", 4), proposal("o2", "c1", 4), proposal("o2", "c2", 2)], {});
    const rows = computeTotals(options, crit, cells, {});
    expect(cells.find((c) => c.optionId === "o1" && c.criterionId === "c2")?.score).toBeNull();   // still shown as "?"
    expect(rows[0].point).toBeCloseTo((6 * 4 + 10 * 3) / 16);   // 3.375: the unknown counts as a neutral 3, not as A's best cell
    expect(rows[1].point).toBeCloseTo(2.75);
    // A wins only on the old maths when B is strong on Wellbeing: A exam 5 + unknown vs B exam 4 + Wellbeing 4.
    const flip = buildCells(options, crit, [proposal("o1", "c1", 5), proposal("o2", "c1", 4), proposal("o2", "c2", 4)], {});
    const r2 = computeTotals(options, crit, flip, {});
    expect(r2[0].point).toBeCloseTo(3.75);
    expect(r2[1].point).toBeCloseTo(4);
    expect(r2[1].rank).toBe(1);
  });
});

describe("pickBestFit", () => {
  const crit: Criterion[] = [
    { id: "c1", label: "Exam performance", description: "", weight: 9, weightReason: "" },
    { id: "c2", label: "Career value", description: "", weight: 8, weightReason: "" },
  ];
  const plan = { options, criteria: crit };

  it("lets the top-weighted criterion settle a close call", () => {
    // o1 = (9*2 + 8*5)/17 = 3.41, o2 = (9*4 + 8*3)/17 = 3.53 → close; o2 is also better on exam.
    const cells = buildCells(options, crit, [proposal("o1", "c1", 4), proposal("o1", "c2", 3), proposal("o2", "c1", 3), proposal("o2", "c2", 4.5)], {});
    const fit = pickBestFit(plan, cells, {});
    expect(fit.bestId).toBe("o1");
    expect(fit.runnerUpId).toBe("o2");
    expect(fit.decidedBy).toBe("Exam performance");
  });

  it("names the criterion that would flip the pick", () => {
    const cells = buildCells(options, crit, [proposal("o1", "c1", 5), proposal("o1", "c2", 1), proposal("o2", "c1", 3), proposal("o2", "c2", 5)], {});
    const fit = pickBestFit(plan, cells, { c1: 9, c2: 2 });
    expect(fit.bestId).toBe("o1");
    expect(fit.decidedBy).toBeNull();
    expect(fit.flipLabel).toBe("Career value");
  });

  it("returns nulls when nothing is scored", () => {
    expect(pickBestFit(plan, buildCells(options, crit, [], {}), {})).toEqual({ bestId: null, runnerUpId: null, margin: 0, decidedBy: null, flipLabel: null });
  });
});
