import type { Synthesis } from "@shared/index";
import { CONFIG } from "../config";
import { callJson } from "../llm/json";
import type { RunContext } from "../runs/types";
import { applyFollowup, resynthesize } from "./followups";
import { updateMemory } from "./memory";
import { isSynthesizing } from "./orchestrator";
import { CHAT_AFTER_SYNTHESIS, CHAT_OPEN_USER, CHAT_SYSTEM, memoryBlock } from "./prompts";
import { ChatOut } from "./schemas";

// DECISION: RunState is frozen, so per-run conversation bookkeeping lives in WeakMaps keyed by state.
const queues = new WeakMap<object, Promise<void>>();
const counters = new WeakMap<object, number>();
const pendingBrief = new WeakSet<object>();
const pendingResearch = new WeakMap<object, string[]>();

const FALLBACK = "I didn't catch that — could you say it another way?";

/** Serialises conversation turns per run so replies never interleave. Never rejects. */
function enqueue(ctx: RunContext, fn: () => Promise<void>): Promise<void> {
  const prev = queues.get(ctx.state) ?? Promise.resolve();
  const next = prev.then(fn).catch((err) => console.warn("[chat] turn failed:", err));
  queues.set(ctx.state, next);
  return next;
}

function say(ctx: RunContext, role: "user" | "assistant", text: string, suggestions: string[] = [], recommendedIndex: number | null = null): void {
  const n = (counters.get(ctx.state) ?? 0) + 1;
  counters.set(ctx.state, n);
  const id = `m${n}`;
  if (role === "assistant") text = shapeReply(text);
  ctx.state.chat.push({ id, role, text });
  ctx.emit({ type: "chat.message", id, role, text, suggestions, recommendedIndex });
}

// Words a trimmed phrase must not end on, so a cut never leaves "...lets the team" or "core to the".
const DANGLING = /^(a|an|the|to|of|and|or|but|for|with|in|on|at|by|from|your|my|their|its|is|are|was|still|lets|than|that|so|if|as|very|more|less)$/i;

/** First `max` words of a phrase, minus trailing filler and punctuation. */
function firstWords(text: string, max: number): string {
  const words = text.split(" ").slice(0, max);
  while (words.length > 1 && DANGLING.test(words[words.length - 1].replace(/[^\p{L}']/gu, ""))) words.pop();
  return words.join(" ").replace(/[\s,;:.!?—–-]+$/, "");
}

/** Cuts a sentence to `max` words, re-ending it with `end`. */
function clip(sentence: string, max: number, end: string): string {
  return sentence.split(" ").length <= max ? sentence : firstWords(sentence, max) + end;
}

/** Guard: forces a reply into lead (12 words) + up to 2 facts (12 words) + one "If you value…" (12 words) + one question (14 words). Trims, never fails. */
export function shapeReply(raw: string): string {
  const flat = raw.replace(/[*_#`]+/g, "").replace(/^\s*(?:[-•–]|\d+[.)])\s+/gm, "").replace(/\s+/g, " ").trim();
  const parts = flat.split(/(?<=[.!?])\s+(?=["'(“]?[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) return flat;
  const qi = parts.map((x) => /\?["'”)]?$/.test(x)).lastIndexOf(true);
  const question = qi >= 0 ? parts[qi] : null;
  const rest = parts.filter((_, i) => i !== qi);
  const lead = rest.find((x) => !/^if you value/i.test(x));
  const ifs = rest.filter((x) => /^if you value/i.test(x)).slice(0, 1);
  const facts = rest.filter((x) => x !== lead && !ifs.includes(x)).slice(0, 2);
  const end = (x: string) => (/[.!]$/.test(x) ? x.slice(-1) : ".");
  const out = [
    ...(lead ? [clip(lead, 12, end(lead))] : []),
    ...facts.map((x) => clip(x, 12, end(x))),
    ...ifs.map((x) => clip(x, 12, ".")),
    ...(question ? [clip(question, 14, "?")] : []),
  ];
  return out.join(" ");
}

/** The conversation asks at most this many questions; after that it wraps up and points at the summary. */
const MAX_QUESTIONS = 10;
const WRAP_UP = "Thanks, I have what I need. Your summary is ready below, ranked by what you told me.";
const asked = new WeakMap<object, number>();
const endsWithQuestion = (t: string | undefined) => /\?["'”)]?\s*$/.test((t ?? "").trim());

/** Posts an assistant turn, enforcing the question budget. */
function ask(ctx: RunContext, reply: string, suggestions: string[], rec: number | null): void {
  const isQuestion = endsWithQuestion(shapeReply(reply));
  const n = asked.get(ctx.state) ?? 0;
  if (isQuestion && n >= MAX_QUESTIONS) {
    const last = ctx.state.chat[ctx.state.chat.length - 1];
    if (last?.text !== WRAP_UP) say(ctx, "assistant", WRAP_UP);
    return;
  }
  if (isQuestion) asked.set(ctx.state, n + 1);
  say(ctx, "assistant", reply, suggestions, rec);
}

const GENERIC = ["Yes, a lot", "Somewhat", "Not really", "Not sure yet"];

/** Every turn that asks a question carries 2-4 one-tap answers; falls back to generic ones if the model gave none. */
function answersFor(reply: string, raw: string[], rec: number | null): { suggestions: string[]; recommendedIndex: number | null } {
  const s = cleanSuggestions(raw, rec);
  if (s.suggestions.length || !/\?\s*$/.test(reply.trim())) return s;
  return { suggestions: GENERIC, recommendedIndex: null };
}

function cleanSuggestions(raw: string[], rec: number | null): { suggestions: string[]; recommendedIndex: number | null } {
  const seen = new Set<string>();
  const picked: { s: string; i: number }[] = [];
  raw.forEach((s, i) => {
    const t = String(s ?? "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
    const t5 = firstWords(t, 5);
    if (!t5 || seen.has(t5.toLowerCase())) return;
    seen.add(t5.toLowerCase());
    picked.push({ s: t5, i });
  });
  const top = picked.slice(0, 4);
  if (top.length < 2) return { suggestions: [], recommendedIndex: null };
  const idx = rec === null ? -1 : top.findIndex((p) => p.i === rec);
  return { suggestions: top.map((p) => p.s), recommendedIndex: idx >= 0 ? idx : null };
}

async function callChat(ctx: RunContext, user: string): Promise<ChatOut> {
  const once = async () => (await callJson(ctx, "orchestrator", ChatOut, {
    model: CONFIG.models.orchestrator, reasoningEffort: "low", maxTokens: 2500, timeoutMs: 25_000,
    messages: [{ role: "system", content: CHAT_SYSTEM }, { role: "user", content: user }],
  })).data;
  try { return await once(); } catch (err) {
    console.warn("[chat] retrying turn:", String((err as Error)?.message ?? err).slice(0, 200));
    return await once();
  }
}

/** Plan, latest brief, top findings and recent chat, as context for a chat turn. */
function context(ctx: RunContext): string {
  const st = ctx.state;
  const lines: string[] = [`THE DECISION, IN THEIR WORDS: """${st.decision}"""`];
  const plan = st.plan;
  if (plan) {
    lines.push(`PLAN: ${plan.title}`, "OPTIONS:", ...plan.options.map((o) => `- ${o.id} ${o.label}: ${o.description}`));
    lines.push("CRITERIA (weights 0-10):", ...plan.criteria.map((c) => `- ${c.id} ${c.label} — weight ${c.weight}`));
    lines.push("RESEARCH QUESTIONS:", ...plan.questions.filter((q) => !q.stale).map((q) => `- ${q.id}: ${q.text}`));
  } else {
    lines.push("PLAN: still being drawn up (research is starting).");
  }
  const syn = st.synthesis;
  if (syn) {
    lines.push(`LATEST EVIDENCE BRIEF (v${syn.version}): ${syn.recommendation}`, `SUMMARY: ${syn.summary}`);
    if (syn.conditions.length) lines.push("CONDITIONS:", ...syn.conditions.map((c) => `- ${c}`));
  }
  const findings = [...st.findings.values()].filter((f) => !f.stale)
    .sort((a, b) => Number(b.checks.supported) - Number(a.checks.supported)).slice(0, 10);
  if (findings.length) {
    lines.push("TOP FINDINGS (with their statistics):");
    for (const f of findings) lines.push(`- ${f.id}: ${f.claim}${f.quote ? ` — "${f.quote.slice(0, 220)}"` : ""}`);
  } else {
    lines.push("FINDINGS: none yet; agents are still researching.");
  }
  lines.push("RECENT CONVERSATION:", ...st.chat.slice(-10).map((m) => `${m.role === "user" ? "PERSON" : "YOU"}: ${m.text}`));
  return lines.join("\n") + memoryBlock(st.memory);
}

/** Re-writes the brief with the current weights now, or after the in-flight synthesis finishes. */
export function requestBrief(ctx: RunContext): void {
  const st = ctx.state;
  if (!st.plan || st.replay) return;
  if (isSynthesizing(ctx)) { pendingBrief.add(st); return; }
  if (!st.synthesis) return;   // the first brief hasn't started yet; it reads the latest memory and facts anyway
  const weights = Object.fromEntries(st.plan.criteria.map((c) => [c.id, c.weight]));
  resynthesize(ctx, weights).catch((err) => console.warn("[chat] resynthesize failed:", err));
}

function startResearch(ctx: RunContext, text: string): void {
  if (!ctx.state.plan) {   // research actions wait for the plan
    const list = pendingResearch.get(ctx.state) ?? [];
    list.push(text);
    pendingResearch.set(ctx.state, list);
    return;
  }
  applyFollowup(ctx, text).catch((err) => console.warn("[chat] follow-up failed:", err));
}

/** Called by runPipeline once the plan exists: runs research the person asked for during planning. */
export function onPlanReady(ctx: RunContext): void {
  const list = pendingResearch.get(ctx.state) ?? [];
  pendingResearch.delete(ctx.state);
  for (const t of list) startResearch(ctx, t);
}

/** Opens the conversation at run start, in parallel with planning. Never throws. */
export function openConversation(ctx: RunContext): Promise<void> {
  return enqueue(ctx, async () => {
    say(ctx, "user", ctx.state.decision);
    try {
      const out = await callChat(ctx, CHAT_OPEN_USER(ctx.state.decision, ctx.state.memory));
      updateMemory(ctx, out.memory, "conversation");
      const s = answersFor(out.reply, out.suggestions, out.recommendedIndex);
      ask(ctx, out.reply.trim(), s.suggestions, s.recommendedIndex);
    } catch (err) {
      console.warn("[chat] opening failed:", err);
      say(ctx, "assistant", "I've started researching this for you. While the agents work — how big are the stakes on each side for you?",
        ["Both matter a lot", "One clearly matters more", "Not sure yet"], null);
    }
  });
}

/** One later message from the person. Never throws. */
export function userTurn(ctx: RunContext, text: string): Promise<void> {
  return enqueue(ctx, async () => {
    say(ctx, "user", text);
    let out: ChatOut;
    try {
      out = await callChat(ctx, `${context(ctx)}\n\nTHE PERSON JUST SAID: """${text}"""\n\nReply to them now.`);
    } catch (err) {
      console.warn("[chat] turn failed:", err);
      say(ctx, "assistant", FALLBACK);
      return;
    }
    updateMemory(ctx, out.memory, "conversation");
    const plan = ctx.state.plan;
    let weightsChanged = false;
    if (plan) {
      const reasons: string[] = [];
      for (const w of out.weightChanges) {
        const c = plan.criteria.find((x) => x.id === w.criterionId);
        const weight = Math.max(0, Math.min(10, Math.round(w.weight)));
        if (!c || !Number.isFinite(weight) || c.weight === weight) continue;
        c.weight = weight; c.weightReason = w.reason || "From the conversation";
        reasons.push(`${c.label} → ${weight}`);
      }
      if (reasons.length) {
        weightsChanged = true;
        ctx.emit({ type: "plan.updated", plan, reason: `Weights changed from the conversation: ${reasons.join(", ")}` });
      }
    }
    const s = answersFor(out.reply, out.suggestions, out.recommendedIndex);
    ask(ctx, out.reply.trim(), s.suggestions, s.recommendedIndex);
    if (out.action === "research") startResearch(ctx, out.researchRequest?.trim() || text);
    else if (out.action === "update_brief" || weightsChanged) requestBrief(ctx);
  });
}

/** Called whenever a synthesis finishes (v1 and later; null = it failed). Posts the neutral turn; runs any pending brief. */
export function afterSynthesis(ctx: RunContext, synthesis: Synthesis | null): void {
  if (pendingBrief.has(ctx.state)) {
    pendingBrief.delete(ctx.state);
    setTimeout(() => requestBrief(ctx), 50);   // after the caller has cleared the in-flight flag
  }
  if (!synthesis || ctx.state.replay) return;
  void enqueue(ctx, async () => {
    try {
      // A new brief must not stack a second question on top of one the person hasn't answered yet.
      const last = ctx.state.chat[ctx.state.chat.length - 1];
      if (last?.role === "assistant" && endsWithQuestion(last.text)) return;
      const out = await callChat(ctx, `${context(ctx)}\n\n${CHAT_AFTER_SYNTHESIS}`);
      const s = answersFor(out.reply, out.suggestions, out.recommendedIndex);
      ask(ctx, out.reply.trim(), s.suggestions, s.recommendedIndex);
    } catch (err) {
      console.warn("[chat] after-synthesis turn failed:", err);
      const cond = synthesis.conditions.slice(0, 2).join(" ");
      say(ctx, "assistant", `The research is in: ${synthesis.recommendation}. ${cond} What matters most to you here?`.replace(/\s+/g, " "),
        ["Cost", "Quality", "Risk", "Not sure yet"], null);
    }
  });
}
