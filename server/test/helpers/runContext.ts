import type { CruxEvent, CruxEventBody, Finding } from "@shared/index";
import type { RunContext, RunState } from "../../src/runs/types";

export function finding(id: string, agentId: string, overrides: Partial<Finding> = {}): Finding {
  return {
    id, agentId, questionId: `q${agentId.slice(1)}`, claim: `Claim from ${id}`, quote: `Quote from ${id}`,
    sourceId: "s1", optionIds: [], criterionIds: [], confidence: "medium", stale: false,
    checks: { sourceRetrieved: true, quote: "verified", quoteMatchRatio: 1, supported: true },
    ...overrides,
  };
}

export function runContext(findings: Finding[] = []): { ctx: RunContext; events: CruxEvent[] } {
  const events: CruxEvent[] = [];
  const state: RunState = {
    id: "test-run", decision: "Should I attend the hackathon?", inputMode: "text", replay: false,
    createdAt: Date.now(), phase: "checking", plan: null, agents: new Map(), sources: new Map(),
    sourceIdByUrl: new Map(), findings: new Map(findings.map((f) => [f.id, f])), proposals: [],
    contradictions: [], synthesis: null, usages: [], tavily: { searches: 0, credits: 0 },
    jsonRepairs: 0, fingerprint: null,
    counters: { question: 0, agent: 0, finding: 0, source: 0, fact: 0, contradiction: 0, search: 0, ladder: 0 },
  };
  const ctx: RunContext = {
    state,
    emit(body: CruxEventBody) {
      const event: CruxEvent = { ...body, seq: events.length + 1, ts: Date.now(), runId: state.id };
      events.push(event);
      return event;
    },
    nextId(kind) { return `x${++state.counters[kind]}`; },
    recordUsage(actorId, usage, fingerprint) {
      state.usages.push({ actorId, usage });
      if (fingerprint) state.fingerprint = fingerprint;
    },
    flushStats() {},
  };
  return { ctx, events };
}
