import OpenAI from "openai";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONFIG } from "../src/config";

const ai = new OpenAI({ baseURL: CONFIG.nebiusBaseUrl, apiKey: CONFIG.keys.nebius, maxRetries: 0 });
type R = Record<string, any>;
const results: Record<string, R> = {};

async function chat(body: any, timeoutMs = 150_000): Promise<R> {
  const t0 = Date.now();
  const { data, response } = await ai.chat.completions
    .create({ ...body, stream: true, stream_options: { include_usage: true } } as any, { signal: AbortSignal.timeout(timeoutMs) })
    .withResponse();
  let content = "", reasoning = "", usage: any = null, ttft: number | null = null, finish: string | null = null;
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  for await (const c of data as any) {
    const d = c.choices?.[0]?.delta ?? {};
    if ((d.reasoning_content || d.reasoning || d.content) && ttft === null) ttft = Date.now() - t0;
    reasoning += d.reasoning_content ?? d.reasoning ?? "";
    content += d.content ?? "";
    for (const tc of d.tool_calls ?? []) {
      const x = calls.get(tc.index) ?? { id: "", name: "", arguments: "" };
      if (tc.id) x.id = tc.id;
      if (tc.function?.name) x.name += tc.function.name;
      if (tc.function?.arguments) x.arguments += tc.function.arguments;
      calls.set(tc.index, x);
    }
    if (c.choices?.[0]?.finish_reason) finish = c.choices[0].finish_reason;
    if (c.usage) usage = c.usage;
  }
  const rateLimit: R = {};
  response.headers.forEach((v, k) => { if (k.startsWith("x-ratelimit") || k === "retry-after") rateLimit[k] = v; });
  return { ms: Date.now() - t0, ttftMs: ttft, content, reasoning, reasoningChars: reasoning.length, finish,
    toolCalls: [...calls.values()], inputTokens: usage?.prompt_tokens ?? null, outputTokens: usage?.completion_tokens ?? null,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? null, rateLimit };
}

async function test(name: string, fn: () => Promise<R>) {
  process.stdout.write(`• ${name} … `);
  try { const r = await fn(); results[name] = { ok: true, ...r }; console.log(`ok (${r.ms ?? "?"} ms)`); }
  catch (e: any) {
    results[name] = { ok: false, status: e?.status ?? null, error: String(e?.message ?? e).slice(0, 400) };
    console.log(`FAIL ${e?.status ?? ""} ${String(e?.message ?? e).slice(0, 200)}`);
  }
}
const stripFence = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
const DS = CONFIG.models.orchestrator;
const PUZZLE = "A bat and a ball cost £1.10 in total. The bat costs £1.00 more than the ball. How much is the ball? Reply with the amount only.";
const TOOLS = [
  { type: "function", function: { name: "tavily_search", description: "Search the web.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "submit_findings", description: "Submit the final answer.", parameters: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] } } },
];
const SUMMARY_SYSTEM = "You write live status lines for an AI agent, like the progress line in a developer tool. You are given the latest excerpt of the agent's private reasoning. Reply with ONE line of at most 9 words saying what it is doing right now. Start with a present participle such as \"Comparing\", \"Checking\" or \"Weighing\". Plain English, no first person, no quotes, no trailing period.";
const CONTRADICTION_SYSTEM = "You audit research findings produced by several independent agents for one decision. Identify pairs of findings from DIFFERENT agents that contradict each other (\"direct\") or pull in clearly opposite directions on the same point (\"tension\"). Ignore pairs that are simply about different topics. Be strict: flag only real disagreements.\n\nReturn ONLY JSON: {\"contradictions\":[{\"a\":\"F2\",\"b\":\"F7\",\"severity\":\"direct\"|\"tension\",\"explanation\":\"at most 25 words\"}]}\nReturn {\"contradictions\":[]} if there are none. At most 4 pairs.";
const SAMPLE_REASONING = "The user is torn between attending a hackathon and revising. I should check how one night of reduced sleep affects memory consolidation, compare that with the career value of hackathons, and then weigh partial attendance…";

await test("ds_effort_low", () => chat({ model: DS, reasoning_effort: "low", max_tokens: 4000, messages: [{ role: "user", content: PUZZLE }] }));
await test("ds_effort_max", () => chat({ model: DS, reasoning_effort: "max", max_tokens: 16000, messages: [{ role: "user", content: PUZZLE }] }));
// DECISION: the bat-and-ball puzzle is too easy to separate effort levels (both use <100 reasoning tokens),
// so also probe with a multi-step problem that rewards thinking.
const HARD = "Three friends split a bill. Ana pays 40% of it plus £3, Ben pays half of what remains plus £2, and Cara pays the remaining £17. What was the total bill? Show the final amount only.";
await test("ds_effort_low_hard", () => chat({ model: DS, reasoning_effort: "low", max_tokens: 8000, messages: [{ role: "user", content: HARD }] }));
await test("ds_effort_max_hard", () => chat({ model: DS, reasoning_effort: "max", max_tokens: 32000, messages: [{ role: "user", content: HARD }] }));
await test("ds_json_object", async () => {
  const r = await chat({ model: DS, reasoning_effort: "low", max_tokens: 4000, response_format: { type: "json_object" },
    messages: [{ role: "user", content: 'Return the JSON object {"ok": true, "items": ["a", "b"]} and nothing else.' }] });
  JSON.parse(stripFence(r.content)); return r;
});
const sys = { role: "system", content: "You research with tavily_search, then call submit_findings with your answer." };
const usr = { role: "user", content: "What is the population of Iceland? Search first." };
await test("ds_tools_turn1", () => chat({ model: DS, reasoning_effort: "high", max_tokens: 8000, tools: TOOLS, tool_choice: "auto", messages: [sys, usr] }));
await test("ds_tools_turn2", async () => {
  const t1 = results.ds_tools_turn1;
  if (!t1?.ok || !t1.toolCalls?.length) throw new Error("turn 1 produced no tool call");
  const tc = t1.toolCalls[0]; const id = tc.id || "call_1";
  return chat({ model: DS, reasoning_effort: "high", max_tokens: 8000, tools: TOOLS, tool_choice: "auto", messages: [sys, usr,
    { role: "assistant", content: t1.content ?? "", reasoning_content: t1.reasoning,
      tool_calls: [{ id, type: "function", function: { name: tc.name, arguments: tc.arguments } }] },
    { role: "tool", tool_call_id: id, content: "[s1] Population — statice.is\nURL: https://statice.is\nIceland's population was 389,444 on 1 January 2025." }] });
});
await test("glm_summary_none", () => chat({ model: CONFIG.models.summary, reasoning_effort: "none", max_tokens: 40,
  messages: [{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: SAMPLE_REASONING }] }, 15_000));
// DECISION: GLM sometimes spends its whole 40-token budget on hidden reasoning despite effort "none" and returns "".
// Repeat the call twice more so one lucky (or unlucky) sample does not decide the summary model.
for (const n of [2, 3]) await test(`glm_summary_none_${n}`, () => chat({ model: CONFIG.models.summary, reasoning_effort: "none", max_tokens: 40,
  messages: [{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: SAMPLE_REASONING }] }, 15_000));
if (!results.glm_summary_none.ok) await test("glm_summary_omit", () => chat({ model: CONFIG.models.summary, max_tokens: 40,
  messages: [{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: SAMPLE_REASONING }] }, 15_000));
await test("nemotron_summary_none", () => chat({ model: "nvidia/Nemotron-3_5-Lightning", reasoning_effort: "none", max_tokens: 40,
  messages: [{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: SAMPLE_REASONING }] }, 15_000));
await test("minimax_audit", async () => {
  const r = await chat({ model: CONFIG.models.audit, reasoning_effort: "low", max_tokens: 6000, response_format: { type: "json_object" },
    messages: [{ role: "system", content: CONTRADICTION_SYSTEM }, { role: "user", content:
      "F1 (agent a1): Sleeping under 6 hours cuts next-day recall by 20-40%.\nF2 (agent a2): One short night of sleep has no measurable effect on next-day exam recall." }] }, 90_000);
  JSON.parse(stripFence(r.content)); return r;
});
await test("tavily_search", async () => {
  const t0 = Date.now();
  const res = await fetch("https://api.tavily.com/search", { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.keys.tavily}` },
    body: JSON.stringify({ query: "sleep deprivation exam performance study", search_depth: CONFIG.tavilyDepth, max_results: 5,
      chunks_per_source: 3, include_usage: true }) });
  if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
  const j: any = await res.json();
  return { ms: Date.now() - t0, results: j.results?.length ?? 0, credits: j.usage?.credits ?? null,
    firstResultKeys: Object.keys(j.results?.[0] ?? {}), firstContentChars: j.results?.[0]?.content?.length ?? 0 };
});
function silenceWav(seconds = 1, rate = 16000): Blob {
  const n = rate * seconds, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return new Blob([b], { type: "audio/wav" });
}
async function eleven(withKeyterms: boolean): Promise<R> {
  const t0 = Date.now(); const fd = new FormData();
  fd.append("model_id", "scribe_v2"); fd.append("file", silenceWav(), "silence.wav"); fd.append("language_code", "en");
  if (withKeyterms) for (const k of ["Nebius", "Tavily", "DeepSeek"]) fd.append("keyterms", k);
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": CONFIG.keys.elevenlabs }, body: fd });
  if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
  const j: any = await res.json(); return { ms: Date.now() - t0, text: j.text ?? null, keys: Object.keys(j) };
}
await test("elevenlabs_keyterms", () => eleven(true));
if (!results.elevenlabs_keyterms.ok) await test("elevenlabs_plain", () => eleven(false));

// ---- decisions ----
const effortLow = results.ds_effort_low, effortMax = results.ds_effort_max;
const reasoningOf = (r: R) => (r?.reasoningTokens ?? Math.round((r?.reasoningChars ?? 0) / 4));
const rec: Record<string, string> = {
  AGENT_MODE: results.ds_tools_turn1?.ok && results.ds_tools_turn1.toolCalls?.length && results.ds_tools_turn2?.ok ? "tools" : "json",
  JSON_MODE: results.ds_json_object?.ok ? "true" : "false",
};
const glm = results.glm_summary_none?.ok ? results.glm_summary_none : results.glm_summary_omit;
// DECISION: also require a non-empty line; GLM can spend all 40 tokens on hidden reasoning and return "".
const glmRuns = results.glm_summary_none?.ok ? [results.glm_summary_none, results.glm_summary_none_2, results.glm_summary_none_3] : [glm];
const glmGood = glmRuns.every((r) => r?.ok && r.ms < 2500 && String(r.content ?? "").trim());
if (glmGood) { rec.SUMMARY_MODEL = CONFIG.models.summary; rec.SUMMARY_EFFORT = results.glm_summary_none?.ok ? "none" : "omit"; }
else if (results.nemotron_summary_none?.ok) { rec.SUMMARY_MODEL = "nvidia/Nemotron-3_5-Lightning"; rec.SUMMARY_EFFORT = "none"; }
if (!results.minimax_audit?.ok) rec.AUDIT_MODEL = "zai-org/GLM-5.3-Flash";

const rows = Object.entries(results).map(([k, r]) =>
  `| ${k} | ${r.ok ? "ok" : "FAIL " + (r.status ?? "")} | ${r.ms ?? ""} | ${r.ttftMs ?? ""} | ${r.reasoningTokens ?? ""} | ${(r.error ?? r.content ?? r.text ?? "").toString().replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 80)} |`);
const md = [
  `# Smoke results — ${new Date().toISOString()}`, "",
  "| test | result | ms | ttft ms | reasoning tok | note |", "|---|---|---|---|---|---|", ...rows, "",
  `**Effort control honoured (hard probe):** low = ${reasoningOf(results.ds_effort_low_hard)} reasoning tok / ${results.ds_effort_low_hard?.ms ?? "?"} ms, max = ${reasoningOf(results.ds_effort_max_hard)} reasoning tok / ${results.ds_effort_max_hard?.ms ?? "?"} ms → ${reasoningOf(results.ds_effort_max_hard) > 1.5 * reasoningOf(results.ds_effort_low_hard) ? "YES" : "NO / unclear"}`,
  `**Effort control honoured (easy puzzle):** low = ${reasoningOf(effortLow)} reasoning tok, max = ${reasoningOf(effortMax)} → ${reasoningOf(effortMax) > reasoningOf(effortLow) ? "YES" : "NO / unclear"}`,
  `**Rate-limit headers seen:** ${JSON.stringify(effortLow?.rateLimit ?? {})}`,
  `**ElevenLabs:** ${results.elevenlabs_keyterms?.ok ? "keyterms accepted" : results.elevenlabs_plain?.ok ? "keyterms REJECTED — plain works" : "FAILED"}`,
  "", "## Recommended .env", "```dotenv", ...Object.entries(rec).map(([k, v]) => `${k}=${v}`), "```", "",
].join("\n");
writeFileSync(fileURLToPath(new URL("../../SMOKE.md", import.meta.url)), md);
console.log("\n" + md);
