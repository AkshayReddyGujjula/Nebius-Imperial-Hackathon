import { jsonrepair } from "jsonrepair";
import type { z } from "zod";
import type { Usage } from "@shared/index";
import { CONFIG } from "../config";
import type { RunContext } from "../runs/types";
import { streamChat, type ChatOpts, type ChatResult } from "./nebius";
import { REPAIR_SYSTEM } from "../pipeline/prompts";

export function parseJsonLoose(text: string): unknown {
  let t = text.trim().replace(/^<think>[\s\S]*?<\/think>/i, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in model output");
  const body = t.slice(start, end + 1);
  try { return JSON.parse(body); } catch { return JSON.parse(jsonrepair(body)); }
}

export function zodIssues(err: z.ZodError): string {
  return err.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

/** One LLM call that must return JSON matching `schema`, with one repair attempt. */
export async function callJson<T>(ctx: RunContext, actorId: string, schema: z.ZodType<T>,
  opts: Omit<ChatOpts, "jsonObject" | "tools">): Promise<{ data: T; result: ChatResult }> {
  const result = await streamChat({ ...opts, jsonObject: true });
  ctx.recordUsage(actorId, result.usage, result.fingerprint);
  if (!result.content.trim() && result.finishReason === "length") throw new Error("Model ran out of tokens while reasoning");
  let problem: string;
  try {
    const parsed = schema.safeParse(parseJsonLoose(result.content));
    if (parsed.success) return { data: parsed.data, result };
    problem = zodIssues(parsed.error);
  } catch (e: any) { problem = String(e?.message ?? e); }
  ctx.state.jsonRepairs++;
  const repair = await streamChat({
    model: CONFIG.models.orchestrator, reasoningEffort: "low", maxTokens: 6000, timeoutMs: 40_000, jsonObject: true,
    messages: [
      { role: "system", content: REPAIR_SYSTEM },
      { role: "user", content: `Validation errors:\n${problem}\n\nOriginal output:\n${result.content.slice(0, 16000)}` },
    ],
  });
  ctx.recordUsage(actorId, repair.usage, repair.fingerprint);
  const parsed = schema.safeParse(parseJsonLoose(repair.content));
  if (!parsed.success) throw new Error(`Invalid JSON after repair: ${zodIssues(parsed.error)}`);
  return { data: parsed.data, result: { ...result, usage: sumUsage(result.usage, repair.usage) } };
}

export function sumUsage(a: Usage, b: Usage): Usage {
  return { model: a.model, inputTokens: a.inputTokens + b.inputTokens, cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens, reasoningTokens: a.reasoningTokens + b.reasoningTokens,
    costUsd: a.costUsd + b.costUsd, ms: a.ms + b.ms, ttftMs: a.ttftMs };
}
