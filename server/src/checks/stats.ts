import type { ModelStats, RunStats } from "@shared/index";
import type { RunState } from "../runs/types";

/**
 * §10.4. `endAt` is the time the run reached `done` (RunManager tracks it), so wallMs freezes once done.
 * DECISION: RunState has no doneAt field (frozen contract), so the caller passes it in.
 */
export function computeStats(state: RunState, endAt: number | null = null, now = Date.now()): RunStats {
  const wallMs = Math.max(0, (state.phase === "done" && endAt != null ? endAt : now) - state.createdAt);

  const questionOrigin = new Map((state.plan?.questions ?? []).map((q) => [q.id, q.origin] as const));
  const planAgents = [...state.agents.values()].filter((a) => (questionOrigin.get(a.info.questionId) ?? "plan") === "plan");
  let agentPhaseWallMs = 0;
  let agentMsSum = 0;
  if (planAgents.length > 0) {
    const start = Math.min(...planAgents.map((a) => a.startedAt));
    const end = Math.max(...planAgents.map((a) => a.endedAt ?? now));
    agentPhaseWallMs = Math.max(0, end - start);
    agentMsSum = planAgents.reduce((sum, a) => sum + Math.max(0, (a.endedAt ?? now) - a.startedAt), 0);
  }
  const speedup = agentPhaseWallMs > 0 ? agentMsSum / agentPhaseWallMs : 1;

  let inputTokens = 0, outputTokens = 0, reasoningTokens = 0, costUsd = 0;
  const byModel: Record<string, ModelStats> = {};
  for (const { usage } of state.usages) {
    inputTokens += usage.inputTokens;
    outputTokens += usage.outputTokens;
    reasoningTokens += usage.reasoningTokens;
    costUsd += usage.costUsd;
    const m = (byModel[usage.model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, costUsd: 0 });
    m.calls += 1;
    m.inputTokens += usage.inputTokens;
    m.outputTokens += usage.outputTokens;
    m.reasoningTokens += usage.reasoningTokens;
    m.costUsd += usage.costUsd;
  }

  let quoteVerified = 0, quotePartial = 0, quoteNotFound = 0, noQuote = 0, sourceNotRetrieved = 0;
  for (const f of state.findings.values()) {
    switch (f.checks.quote) {
      case "verified": quoteVerified++; break;
      case "partial": quotePartial++; break;
      case "not_found": quoteNotFound++; break;
      case "no_quote": noQuote++; break;
    }
    if (!f.checks.sourceRetrieved) sourceNotRetrieved++;
  }

  return {
    wallMs, agentPhaseWallMs, agentMsSum, speedup,
    llmCalls: state.usages.length,
    tavilySearches: state.tavily.searches,
    tavilyCredits: state.tavily.credits,
    inputTokens, outputTokens, reasoningTokens, costUsd, byModel,
    findings: state.findings.size,
    quoteVerified, quotePartial, quoteNotFound, noQuote, sourceNotRetrieved,
    contradictions: state.contradictions.length,
    jsonRepairs: state.jsonRepairs,
    fingerprint: state.fingerprint,
  };
}
