import { CONFIG } from "../config";
import { auditContradictions } from "../checks/contradictions";
import { Summarizer } from "../llm/summarizer";
import type { RunContext } from "../runs/types";
import { runAgent } from "./agent";
import { plan, shortMessage, synthesize } from "./orchestrator";
import { afterSynthesis, onPlanReady, openConversation } from "./chat";
import { initMemory } from "./memory";

// DECISION: follow-ups (dig deeper, blind spot, re-synthesis) need the run's Summarizer after
// runPipeline returns, so it is kept here per run state and fetched with summarizerFor(ctx).
const summarizers = new WeakMap<object, Summarizer>();
export function summarizerFor(ctx: RunContext): Summarizer {
  let s = summarizers.get(ctx.state);
  if (!s) { s = new Summarizer(ctx); summarizers.set(ctx.state, s); }
  return s;
}

const sleep = (ms: number) => new Promise<"deadline">((r) => setTimeout(() => r("deadline"), ms).unref?.());

/** §5.2 / §9.7: plan → parallel agents (soft deadline) → audit (async) → synthesis. */
export async function runPipeline(run: RunContext): Promise<void> {
  const ctx = run;
  const summarizer = summarizerFor(ctx);
  const phase = (p: typeof ctx.state.phase) => { ctx.state.phase = p; ctx.emit({ type: "run.phase", phase: p }); ctx.flushStats(); };
  try {
    ctx.emit({ type: "run.started", decision: ctx.state.decision, inputMode: ctx.state.inputMode, replay: false, replayOf: null,
      models: { ...CONFIG.models } });
    phase("planning");
    initMemory(ctx);                 // instant, so the planner already reads user.md
    void openConversation(ctx);      // the assistant talks while the plan is drawn up
    const p = await plan(ctx, summarizer);
    onPlanReady(ctx);

    phase("researching");
    const tasks = p.questions.map((q) => runAgent(ctx, summarizer, q));
    const winner = await Promise.race([Promise.allSettled(tasks).then(() => "all" as const), sleep(CONFIG.softDeadlineMs)]);
    if (winner === "deadline") {
      ctx.emit({ type: "notice", level: "info", message: "Writing the recommendation with the results so far; slower agents will keep going." });
    }

    phase("checking");
    try { auditContradictions(ctx).catch(() => {}); } catch { /* stub may throw synchronously */ }

    phase("synthesizing");
    const synthesis = await synthesize(ctx, summarizer, Object.fromEntries(p.criteria.map((c) => [c.id, c.weight])));
    afterSynthesis(ctx, synthesis);
    phase("done");
    ctx.flushStats();
  } catch (err) {
    ctx.emit({ type: "run.error", message: shortMessage(err), fatal: true });
    phase("error");
    ctx.flushStats();
  } finally {
    summarizer.close();   // agents still running past the soft deadline re-activate their actor on the next feed
  }
}
