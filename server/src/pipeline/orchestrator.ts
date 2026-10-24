import type { BlindSpot, Criterion, Effort, Fact, Option, Plan, Question, Synthesis } from "@shared/index";
import { CONFIG } from "../config";
import { callJson } from "../llm/json";
import type { Summarizer } from "../llm/summarizer";
import type { RunContext } from "../runs/types";
import { PLAN_SYSTEM, PLAN_USER, SYNTHESIS_SYSTEM, buildSynthesisUser } from "./prompts";
import { PlanOut, SynthesisOut } from "./schemas";

export function shortMessage(err: unknown): string {
  const m = String((err as any)?.message ?? err ?? "error");
  const title = m.match(/<title>([^<]*)<\/title>/i)?.[1];   // nginx HTML error pages
  const code = m.match(/^\d{3}/)?.[0] ?? "";
  const text = title ? (title.startsWith(code) ? title : `${code} ${title}`) : m;
  return text.replace(/^(\d{3}) \1\b/, "$1").replace(/\s+/g, " ").trim().slice(0, 200);
}

function validQuote(decision: string, quote: string | null | undefined): string | null {
  const q = (quote ?? "").trim();
  if (q.split(/\s+/).filter(Boolean).length < 2) return null;
  return decision.toLowerCase().includes(q.toLowerCase()) ? q : null;
}

/** At most 1 max and 2 high; downgrade from the last question backwards (§9.4). */
export function clampEfforts(questions: Question[]): void {
  const count = (e: Effort) => questions.filter((q) => q.effort === e).length;
  for (let i = questions.length - 1; i >= 0 && count("max") > 1; i--) if (questions[i].effort === "max") questions[i].effort = "high";
  for (let i = questions.length - 1; i >= 0 && count("high") > 2; i--) if (questions[i].effort === "high") questions[i].effort = "low";
  for (const q of questions) if (q.effort !== q.effortRequested && !q.effortReason.endsWith("(capped by budget)")) {
    q.effortReason = `${q.effortReason} (capped by budget)`.trim();
  }
}

export async function plan(ctx: RunContext, summarizer: Summarizer): Promise<Plan> {
  const decision = ctx.state.decision;
  const date = new Date().toISOString().slice(0, 10);
  const messages = [{ role: "system", content: PLAN_SYSTEM(date) }, { role: "user", content: PLAN_USER(decision) }];
  const onReasoning = (d: string) => summarizer.feed("orchestrator", d);
  let out: Awaited<ReturnType<typeof callJson<PlanOut>>>;
  try {
    out = await callJson(ctx, "orchestrator", PlanOut, {
      model: CONFIG.models.orchestrator, reasoningEffort: "max", maxTokens: 32000, timeoutMs: 90_000, messages, onReasoning });
  } catch (err) {
    console.warn("[plan] max effort failed:", err);
    ctx.emit({ type: "notice", level: "warn", message: `Planner retrying at high effort (${shortMessage(err)})` });
    out = await callJson(ctx, "orchestrator", PlanOut, {
      model: CONFIG.models.orchestrator, reasoningEffort: "high", maxTokens: 32000, timeoutMs: 60_000, messages, onReasoning });
  } finally {
    summarizer.end("orchestrator");
  }
  const d = out.data;

  const facts: Fact[] = d.facts.map((f) => ({
    id: ctx.nextId("fact"), kind: f.kind, text: f.text, quote: validQuote(decision, f.quote), origin: "user" }));
  const options: Option[] = d.options.slice(0, 4).map((o, i) => ({
    id: `o${i + 1}`, label: o.label, description: o.description, origin: o.origin }));
  const criteria: Criterion[] = d.criteria.slice(0, 5).map((c, i) => ({
    id: `c${i + 1}`, label: c.label, description: c.description,
    weight: Math.max(0, Math.min(10, Math.round(Number.isFinite(c.weight) ? c.weight : 5))), weightReason: c.weightReason }));
  const questions: Question[] = d.questions.slice(0, CONFIG.maxQuestions).map((q) => {
    let optionIds = [...new Set(q.optionIndexes.filter((i) => i >= 0 && i < options.length).map((i) => options[i].id))];
    let criterionIds = [...new Set(q.criterionIndexes.filter((i) => i >= 0 && i < criteria.length).map((i) => criteria[i].id))];
    if (!optionIds.length) optionIds = options.map((o) => o.id);
    if (!criterionIds.length) criterionIds = criteria.map((c) => c.id);
    return {
      id: ctx.nextId("question"), text: q.text, why: q.why, optionIds, criterionIds,
      effort: q.effort, effortRequested: q.effort, effortReason: q.effortReason,
      seedQueries: q.seedQueries.map((s) => s.trim()).filter(Boolean).slice(0, 3),
      parentNodeId: null, origin: "plan", stale: false,
    };
  });
  clampEfforts(questions);

  let blindSpot: BlindSpot | null = null;
  if (d.blindSpot && d.blindSpot.text.trim()) {
    const seeds = d.blindSpot.seedQueries.map((s) => s.trim()).filter(Boolean).slice(0, 3);
    blindSpot = {
      id: "bs1", kind: d.blindSpot.kind, text: d.blindSpot.text, reason: d.blindSpot.reason,
      quote: validQuote(decision, d.blindSpot.quote), researchable: d.blindSpot.researchable && seeds.length > 0,
      seedQueries: seeds, status: "open", answer: null, questionId: null,
    };
  }

  const p: Plan = { version: 1, title: d.title, facts, options, criteria, questions, blindSpot };
  ctx.state.plan = p;
  ctx.emit({ type: "plan.ready", plan: p, usage: out.result.usage });
  return p;
}

// DECISION: RunState is frozen and has no `synthesizing` field, so the one-in-flight flag lives here.
// Routes call isSynthesizing(ctx) and return 409 while it is true.
const inFlight = new WeakSet<object>();
export const isSynthesizing = (ctx: RunContext): boolean => inFlight.has(ctx.state);

export async function synthesize(ctx: RunContext, summarizer: Summarizer, weights: Record<string, number>): Promise<Synthesis | null> {
  const state = ctx.state;
  const plan = state.plan;
  if (!plan) throw new Error("No plan yet");
  if (inFlight.has(state)) throw new Error("A recommendation is already being written");
  inFlight.add(state);
  const version = (state.synthesis?.version ?? 0) + 1;
  try {
    ctx.emit({ type: "synthesis.started", version });
    const messages = [{ role: "system", content: SYNTHESIS_SYSTEM }, { role: "user", content: buildSynthesisUser(state, weights) }];
    const onReasoning = (d: string) => summarizer.feed("orchestrator", d);
    let out: Awaited<ReturnType<typeof callJson<SynthesisOut>>>;
    try {
      try {
        out = await callJson(ctx, "orchestrator", SynthesisOut, {
          model: CONFIG.models.orchestrator, reasoningEffort: "max", maxTokens: 32000, timeoutMs: 90_000, messages, onReasoning });
      } catch (err) {
        console.warn("[synthesize] max effort failed:", err);
        out = await callJson(ctx, "orchestrator", SynthesisOut, {
          model: CONFIG.models.orchestrator, reasoningEffort: "high", maxTokens: 32000, timeoutMs: 60_000, messages, onReasoning });
      }
    } catch (err) {
      ctx.emit({ type: "synthesis.failed", version, error: shortMessage(err) });
      return null;
    } finally {
      summarizer.end("orchestrator");
    }
    const d = out.data;
    // Neutral evidence brief: the synthesis never picks an option for the person.
    const optionId = null;
    const reasons = d.reasons
      .map((r) => ({ text: r.text.trim(), findingIds: r.findingIds.filter((id) => state.findings.has(id)) }))
      .filter((r) => r.text);
    const basedOnWeights = Object.fromEntries(plan.criteria.map((c) => [c.id, weights[c.id] ?? c.weight]));
    const synthesis: Synthesis = {
      version, recommendation: d.recommendation, optionId, confidence: d.confidence, summary: d.summary,
      conditions: d.conditions, reasons, cruxes: d.cruxes, nextSteps: d.nextSteps, uncertainties: d.uncertainties,
      basedOnWeights, basedOnFactIds: plan.facts.map((f) => f.id), createdAt: Date.now(),
    };
    state.synthesis = synthesis;
    ctx.emit({ type: "synthesis.ready", synthesis, usage: out.result.usage });
    return synthesis;
  } finally {
    inFlight.delete(state);
  }
}
