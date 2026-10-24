import { describe, expect, it } from "vitest";
import { buildCells, cellKey, computeTotals } from "@shared/matrix";
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

  it("excludes an unknown score from the point and uses 1/5 for the uncertainty bounds", () => {
    const cells = buildCells(options, criteria, [
      proposal("o1", "c1", 4), proposal("o2", "c1", 2), proposal("o2", "c2", 3),
    ], {});
    expect(cells.find((c) => c.optionId === "o1" && c.criterionId === "c2"))
      .toMatchObject({ score: null, origin: "none" });
    expect(computeTotals(options, criteria, cells, {})[0])
      .toMatchObject({ point: 4, min: 2.5, max: 4.5, knownCount: 1, unknownCount: 1 });
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
      { optionId: "o3", point: 5, rank: 1 },
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
});
