// Runs the full pipeline against the real APIs with an in-memory RunContext and prints one line per event.
// Usage: npx tsx server/scripts/try-run.ts ["decision text"]   (VERBOSE=1 also prints every reasoning.chunk)
import type { CruxEvent, CruxEventBody, Usage } from "@shared/index";
import type { CounterKind, RunContext, RunState } from "../src/runs/types";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

// DECISION: run from the repo root (`npx tsx server/scripts/try-run.ts`) there is no tsconfig in the cwd, so the
// `@shared/*` path alias would not resolve. Register tsx with server/tsconfig.json and import the pipeline dynamically.
register({ tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)) });
const { runPipeline } = await import("../src/pipeline/runPipeline");

const PRIMARY = "I've got a hackathon tomorrow from 10 till 7, and my machine learning exam is the day after. The exam is worth 40% of the module and I'm maybe 70% prepared. The hackathon would be great for my CV and I'd learn a lot, but I really don't want to tank the exam. Should I go?";
const decision = process.argv[2] ?? PRIMARY;
const VERBOSE = process.env.VERBOSE === "1";
const PREFIX: Record<CounterKind, string> = {
  question: "q", agent: "a", finding: "F", source: "s", fact: "f", contradiction: "x", search: "srch", ladder: "L" };

const t0 = Date.now();
const state: RunState = {
  id: "try", decision, inputMode: "text", replay: false, createdAt: t0, phase: "planning", plan: null,
  agents: new Map(), sources: new Map(), sourceIdByUrl: new Map(), findings: new Map(), proposals: [],
  contradictions: [], synthesis: null, usages: [], tavily: { searches: 0, credits: 0 }, jsonRepairs: 0,
  fingerprint: null, counters: { question: 0, agent: 0, finding: 0, source: 0, fact: 0, contradiction: 0, search: 0, ladder: 0 },
};
const log: CruxEvent[] = [];
let chunkChars = 0;
const sec = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
const cut = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1) + "…" : s).replace(/\s+/g, " ");

function describe(e: CruxEventBody): string | null {
  switch (e.type) {
    case "reasoning.chunk": chunkChars += e.text.length; return VERBOSE ? `${e.actorId} +${e.text.length}ch` : null;
    case "reasoning.summary": return `${e.actorId}: ${e.text}`;
    case "run.phase": return e.phase;
    case "run.started": return `models ${Object.values(e.models).join(", ")}`;
    case "plan.ready": return `"${e.plan.title}" facts=${e.plan.facts.length} options=${e.plan.options.map((o) => o.label).join(" | ")} ` +
      `criteria=${e.plan.criteria.map((c) => `${c.label}(${c.weight})`).join(", ")} questions=${e.plan.questions.map((q) => `${q.id}:${q.effort}`).join(",")} ` +
      `blindSpot=${e.plan.blindSpot ? "yes" : "no"} ${e.usage.ms}ms $${e.usage.costUsd.toFixed(4)}`;
    case "agent.spawned": return `${e.agent.id} q=${e.agent.questionId} effort=${e.agent.effort} extraRounds=${e.agent.extraRounds}`;
    case "agent.status": return `${e.agentId} ${e.status} r${e.round} sources=${e.sourcesRead}${e.note ? " " + e.note : ""}`;
    case "search.started": return `${e.agentId} r${e.round} "${e.query}"`;
    case "search.done": return `${e.agentId} ${e.sources.length} results ${e.ms}ms${e.error ? " ERR " + e.error : ""}`;
    case "finding.added": return `${e.finding.id} (${e.finding.agentId}, ${e.finding.checks.quote}${e.finding.checks.sourceRetrieved ? "" : ", NOT RETRIEVED"}) ${cut(e.finding.claim, 90)}`;
    case "scores.proposed": return `${e.agentId} ${e.proposals.map((p) => `${p.optionId}/${p.criterionId}=${p.score}`).join(" ")}`;
    case "agent.done": return `${e.agentId} ${e.status} ${e.usage.ms}ms $${e.usage.costUsd.toFixed(4)} reasoning=${e.usage.reasoningTokens}${e.error ? " ERR " + e.error : ""} — ${cut(e.answer, 80)}`;
    case "contradictions.ready": return `${e.contradictions.length}${e.error ? " " + e.error : ""}`;
    case "synthesis.ready": return `"${e.synthesis.recommendation}" option=${e.synthesis.optionId} conf=${e.synthesis.confidence} ${e.usage.ms}ms`;
    case "synthesis.failed": return e.error;
    case "notice": return `${e.level}: ${e.message}`;
    case "run.error": return `${e.fatal ? "FATAL " : ""}${e.message}`;
    case "stats.updated": return null;
    default: return cut(JSON.stringify(e).slice(0, 140));
  }
}

const ctx: RunContext = {
  state,
  emit(body) {
    const ev = { ...body, seq: log.length + 1, ts: Date.now(), runId: state.id } as CruxEvent;
    log.push(ev);
    const line = describe(body);
    if (line !== null) console.log(`${sec()}s  ${body.type.padEnd(18)} ${line}`);
    return ev;
  },
  nextId(kind) { state.counters[kind]++; return `${PREFIX[kind]}${state.counters[kind]}`; },
  recordUsage(actorId: string, usage: Usage, fingerprint?: string | null) {
    state.usages.push({ actorId, usage });
    if (fingerprint) state.fingerprint = fingerprint;
  },
  flushStats() { /* stats are summarised at the end */ },
};

await runPipeline(ctx);

const count = (t: string) => log.filter((e) => e.type === t).length;
const done = log.filter((e) => e.type === "agent.done");
const byModel = new Map<string, { calls: number; cost: number; out: number; reasoning: number }>();
for (const { usage } of state.usages) {
  const m = byModel.get(usage.model) ?? { calls: 0, cost: 0, out: 0, reasoning: 0 };
  m.calls++; m.cost += usage.costUsd; m.out += usage.outputTokens; m.reasoning += usage.reasoningTokens;
  byModel.set(usage.model, m);
}
const findings = [...state.findings.values()];
const q = (k: string) => findings.filter((f) => f.checks.quote === k).length;
console.log("\n──── summary ────");
console.log(`wall ${((Date.now() - t0) / 1000).toFixed(1)}s · events ${log.length} · phase ${state.phase}`);
console.log(`agents done ${done.filter((e: any) => e.status === "done").length}/${state.agents.size} (timeout ${done.filter((e: any) => e.status === "timeout").length}, failed ${done.filter((e: any) => e.status === "failed").length})`);
console.log(`findings ${findings.length} · verified ${q("verified")} · partial ${q("partial")} · not_found ${q("not_found")} · no_quote ${q("no_quote")} · not retrieved ${findings.filter((f) => !f.checks.sourceRetrieved).length}`);
console.log(`proposals ${state.proposals.length} · searches ${state.tavily.searches} (${state.tavily.credits} credits) · sources ${state.sources.size} · summaries ${count("reasoning.summary")} · reasoning chars ${chunkChars} · json repairs ${state.jsonRepairs}`);
for (const [m, s] of byModel) console.log(`  ${m}: ${s.calls} calls · ${s.out} out tok (${s.reasoning} reasoning) · $${s.cost.toFixed(4)}`);
console.log(`Nebius cost $${state.usages.reduce((a, u) => a + u.usage.costUsd, 0).toFixed(4)}`);
console.log(`synthesis: ${state.synthesis ? `"${state.synthesis.recommendation}" — ${state.synthesis.summary}` : "NONE"}`);
process.exit(0);
