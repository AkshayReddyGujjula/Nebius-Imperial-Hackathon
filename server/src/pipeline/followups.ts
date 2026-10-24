import { parseNodeId, type Fact, type Question } from "@shared/index";
import { bumpEffort } from "../config";
import type { RunContext } from "../runs/types";
import { runAgent } from "./agent";
import { isSynthesizing, synthesize } from "./orchestrator";
import { summarizerFor } from "./runPipeline";

function requirePlan(ctx: RunContext) {
  const plan = ctx.state.plan;
  if (!plan) throw new Error("The plan isn't ready yet");
  return plan;
}

/** Latest agent that researched a question (dig-deeper and re-runs create more than one). */
function agentFor(ctx: RunContext, questionId: string) {
  return [...ctx.state.agents.values()].filter((a) => a.info.questionId === questionId).pop();
}

/** §9.8: grows a new, higher-effort branch from a question node ("q:q2") or a finding node ("f:F5"). */
export async function digDeeper(ctx: RunContext, nodeId: string): Promise<{ questionId: string }> {
  const plan = requirePlan(ctx);
  const { kind, ref } = parseNodeId(nodeId);
  let parent: Question | undefined, text: string;
  if (kind === "question") {
    parent = plan.questions.find((q) => q.id === ref);
    if (!parent) throw new Error(`Unknown question: ${ref}`);
    const gaps = agentFor(ctx, parent.id)?.gaps.join("; ") ?? "";
    text = `${parent.text} Go deeper: find stronger, more specific or more recent evidence, and resolve these gaps: ${gaps || "none listed"}.`;
  } else if (kind === "finding") {
    const finding = ctx.state.findings.get(ref ?? "");
    if (!finding) throw new Error(`Unknown finding: ${ref}`);
    parent = plan.questions.find((q) => q.id === finding.questionId);
    if (!parent) throw new Error(`Unknown question: ${finding.questionId}`);
    text = `Verify and go deeper on this claim: "${finding.claim}" (context: ${parent.text})`;
  } else {
    throw new Error(`Can't dig deeper on ${nodeId}`);
  }
  const effort = bumpEffort(parent.effort);
  const question: Question = {
    id: ctx.nextId("question"), text, why: parent.why, optionIds: [...parent.optionIds], criterionIds: [...parent.criterionIds],
    effort, effortRequested: effort, effortReason: "You asked to dig deeper", seedQueries: [],
    parentNodeId: nodeId, origin: "dig_deeper", stale: false,
  };
  plan.questions.push(question);
  ctx.emit({ type: "question.added", question });
  void runAgent(ctx, summarizerFor(ctx), question);
  return { questionId: question.id };
}

/** §9.8: spawns a high-effort agent on a researchable, open blind spot; its answer closes the blind spot. */
export async function researchBlindSpot(ctx: RunContext): Promise<{ questionId: string }> {
  const plan = requirePlan(ctx);
  const bs = plan.blindSpot;
  if (!bs) throw new Error("There is no blind spot");
  if (!bs.researchable) throw new Error("This blind spot can't be researched on the web");
  if (bs.status !== "open") throw new Error(`The blind spot is already ${bs.status}`);
  const question: Question = {
    id: ctx.nextId("question"), text: bs.text, why: bs.reason,
    optionIds: plan.options.map((o) => o.id), criterionIds: plan.criteria.map((c) => c.id),
    effort: "high", effortRequested: "high", effortReason: "You asked to research the blind spot",
    seedQueries: [...bs.seedQueries], parentNodeId: "blindspot", origin: "blindspot", stale: false,
  };
  plan.questions.push(question);
  bs.status = "researching"; bs.questionId = question.id;
  ctx.emit({ type: "question.added", question });
  ctx.emit({ type: "blindspot.updated", blindSpot: { ...bs } });
  void runAgent(ctx, summarizerFor(ctx), question).then(() => {
    if (bs.status !== "researching") return;   // the person answered it themselves meanwhile
    const agent = agentFor(ctx, question.id);
    bs.status = "answered";
    bs.answer = agent?.answer || "Research didn't find a clear answer.";
    ctx.emit({ type: "blindspot.updated", blindSpot: { ...bs } });
  });
  return { questionId: question.id };
}

/** §9.8: records the person's own answer to the blind spot as a fact. */
export async function answerBlindSpot(ctx: RunContext, answer: string): Promise<void> {
  const plan = requirePlan(ctx);
  const bs = plan.blindSpot;
  if (!bs) throw new Error("There is no blind spot");
  const text = answer.trim();
  if (!text) throw new Error("The answer is empty");
  const fact: Fact = { id: ctx.nextId("fact"), kind: "fact", text: `${bs.text} — ${text}`, quote: null, origin: "blindspot_answer" };
  plan.facts.push(fact);
  ctx.emit({ type: "fact.added", fact });
  bs.status = "answered"; bs.answer = text;
  ctx.emit({ type: "blindspot.updated", blindSpot: { ...bs } });
}

/** §9.8: re-writes the recommendation with the person's current weights (routes check isSynthesizing → 409). */
export async function resynthesize(ctx: RunContext, weights: Record<string, number>): Promise<void> {
  requirePlan(ctx);
  if (isSynthesizing(ctx)) throw new Error("A recommendation is already being written");
  const setPhase = (phase: "synthesizing" | "done") => { ctx.state.phase = phase; ctx.emit({ type: "run.phase", phase }); };
  setPhase("synthesizing");
  try {
    await synthesize(ctx, summarizerFor(ctx), weights);
  } finally {
    setPhase("done");
    ctx.flushStats();
  }
}

export async function runLadder(ctx: RunContext, questionId: string): Promise<{ ladderId: string }> {
  throw new Error("not implemented: runLadder");
}

export async function applyFollowup(ctx: RunContext, text: string): Promise<void> {
  throw new Error("not implemented: applyFollowup");
}
