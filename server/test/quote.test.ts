import { describe, expect, it } from "vitest";
import { checkFinding, checkQuote } from "../src/checks/quote";
import type { RunContext } from "../src/runs/types";

describe("citation checks", () => {
  it("verifies curly quotes with different capitalisation", () => {
    expect(checkQuote("“SLEEP IMPROVES MEMORY consolidation.”", "Sleep improves memory consolidation."))
      .toEqual({ result: "verified", ratio: 1 });
  });

  it("verifies two source sentences joined with an ellipsis", () => {
    const source = "Sleep improves memory consolidation. Rest also helps attention. Practice strengthens long term recall.";
    expect(checkQuote("Sleep improves memory consolidation ... Practice strengthens long term recall.", source))
      .toEqual({ result: "verified", ratio: 1 });
  });

  it("does not verify a full paraphrase", () => {
    expect(checkQuote("Getting sufficient rest makes remembering information easier.", "Sleep improves memory consolidation."))
      .toEqual({ result: "not_found", ratio: 0 });
  });

  it("partially matches a twenty-word quote with one changed word", () => {
    const source = "Regular sleep supports memory attention learning planning reasoning judgement focus recall creativity wellbeing motivation accuracy concentration patience resilience productivity performance";
    const quote = source.replace("judgement", "decisions");
    expect(quote.split(" ")).toHaveLength(20);
    const checked = checkQuote(quote, source);
    expect(checked.result).toBe("partial");
    expect(checked.ratio).toBeGreaterThanOrEqual(0.6);
    expect(checked.ratio).toBeLessThan(1);
  });

  it("reports an empty quote or at most three words as no quote", () => {
    for (const quote of ["", "   ", "Sleep", "Sleep improves", "Sleep improves memory"]) {
      expect(checkQuote(quote, "Sleep improves memory consolidation."))
        .toEqual({ result: "no_quote", ratio: 0 });
    }
  });

  it("does not support a finding citing a source this agent never saw", () => {
    const quote = "Sleep improves memory consolidation.";
    const ctx = {
      state: {
        agents: new Map([["a1", { shownSourceIds: new Set(["s1"]) }]]),
        sources: new Map([["s2", { content: quote }]]),
      },
    } as unknown as RunContext;

    expect(checkFinding(ctx, "a1", { sourceId: "s2", quote })).toEqual({
      sourceRetrieved: false,
      quote: "verified",
      quoteMatchRatio: 1,
      supported: false,
    });
  });
});
