import type { FindingChecks, QuoteCheck } from "@shared/index";
import type { RunContext } from "../runs/types";

export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")                                   // turns "…" into "..."
    .toLowerCase()
    .replace(/\[\s*\.\.\.\s*\]|\.\.\./g, " … ")     // any ellipsis form → a single "…" marker
    .replace(/[^\p{L}\p{N}%$£€…\s]/gu, " ")         // drop punctuation, quotes, dashes
    .replace(/\s+/g, " ")
    .trim();
}

export function checkQuote(quote: string, sourceText: string): { result: QuoteCheck; ratio: number } {
  const q = normalizeForMatch(quote);
  const words = q.replace(/…/g, " ").split(" ").filter(Boolean);
  if (words.length < 4) return { result: "no_quote", ratio: 0 };
  const src = normalizeForMatch(sourceText).replace(/…/g, " ").replace(/\s+/g, " ");
  const segments = q.split("…").map((s) => s.trim()).filter((s) => s.split(" ").length >= 3);
  if (segments.length > 0 && segments.every((seg) => src.includes(seg))) return { result: "verified", ratio: 1 };
  const K = 4;
  const srcWords = src.split(" ");
  const grams = new Set<string>();
  for (let i = 0; i + K <= srcWords.length; i++) grams.add(srcWords.slice(i, i + K).join(" "));
  let hit = 0, total = 0;
  for (let i = 0; i + K <= words.length; i++) { total++; if (grams.has(words.slice(i, i + K).join(" "))) hit++; }
  const ratio = total ? hit / total : 0;
  return { result: ratio >= 0.6 ? "partial" : "not_found", ratio: Math.round(ratio * 100) / 100 };
}

export function checkFinding(ctx: RunContext, agentId: string, f: { quote: string; sourceId: string }): FindingChecks {
  const agent = ctx.state.agents.get(agentId);
  const sourceRetrieved = !!agent?.shownSourceIds.has(f.sourceId);
  const src = ctx.state.sources.get(f.sourceId);
  const q = src ? checkQuote(f.quote, src.content)
                : { result: (f.quote.trim() ? "not_found" : "no_quote") as QuoteCheck, ratio: 0 };
  return { sourceRetrieved, quote: q.result, quoteMatchRatio: q.ratio,
           supported: sourceRetrieved && (q.result === "verified" || q.result === "partial") };
}
