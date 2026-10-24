import OpenAI from "openai";
import { CONFIG } from "../config";
import { costUsd, type Usage } from "@shared/index";
import { nebiusLimiter, SUMMARY_SOFT_CAP } from "./limiter";

export const nebius = new OpenAI({ baseURL: CONFIG.nebiusBaseUrl, apiKey: CONFIG.keys.nebius, maxRetries: 0 });

export type ReasoningEffortParam = "none" | "low" | "high" | "max";
export interface ToolCall { id: string; name: string; arguments: string }
export interface ChatOpts {
  model: string;
  messages: any[];
  reasoningEffort?: ReasoningEffortParam;   // omitted → param not sent
  maxTokens: number;
  timeoutMs: number;
  tools?: any[];                            // tool_choice is always "auto" (DeepSeek thinking mode rejects forced choices)
  jsonObject?: boolean;                     // adds response_format json_object when CONFIG.jsonMode
  onReasoning?: (delta: string) => void;
  onContent?: (delta: string) => void;
  bestEffort?: boolean;                     // run via limiter.tryRunNow; returns null if skipped
}
export interface ChatResult {
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
  usage: Usage;
  fingerprint: string | null;
}

class StreamedError extends Error { constructor(public inner: unknown) { super(String((inner as any)?.message ?? inner)); } }

async function execOnce(o: ChatOpts): Promise<ChatResult> {
  const t0 = Date.now();
  let ttft: number | null = null, streamed = false;
  const body: any = {
    model: o.model, messages: o.messages, stream: true,
    stream_options: { include_usage: true }, max_tokens: o.maxTokens,
  };
  if (o.reasoningEffort) body.reasoning_effort = o.reasoningEffort;
  if (o.tools?.length) { body.tools = o.tools; body.tool_choice = "auto"; }
  if (o.jsonObject && CONFIG.jsonMode && !o.tools?.length) body.response_format = { type: "json_object" };
  try {
    const stream: any = await nebius.chat.completions.create(body, { signal: AbortSignal.timeout(o.timeoutMs) });
    let content = "", reasoning = "", finishReason: string | null = null, usage: any = null, fingerprint: string | null = null;
    const calls = new Map<number, ToolCall>();
    for await (const chunk of stream) {
      streamed = true;
      if (chunk.system_fingerprint) fingerprint = chunk.system_fingerprint;
      if (chunk.usage) usage = chunk.usage;
      const ch = chunk.choices?.[0];
      if (!ch) continue;
      const d: any = ch.delta ?? {};
      const r: string | undefined = d.reasoning_content ?? d.reasoning;
      if (r) { ttft ??= Date.now() - t0; reasoning += r; o.onReasoning?.(r); }
      if (d.content) { ttft ??= Date.now() - t0; content += d.content; o.onContent?.(d.content); }
      for (const tc of d.tool_calls ?? []) {
        const c = calls.get(tc.index) ?? { id: "", name: "", arguments: "" };
        if (tc.id) c.id = tc.id;
        if (tc.function?.name) c.name += tc.function.name;
        if (tc.function?.arguments) c.arguments += tc.function.arguments;
        calls.set(tc.index, c);
      }
      if (ch.finish_reason) finishReason = ch.finish_reason;
    }
    const inputTokens = usage?.prompt_tokens ?? Math.ceil(JSON.stringify(o.messages).length / 4);
    const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens ?? usage?.prompt_cache_hit_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? Math.ceil((content.length + reasoning.length) / 4);
    const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? Math.ceil(reasoning.length / 4);
    const toolCalls = [...calls.entries()].sort((a, b) => a[0] - b[0])
      .map(([i, c]) => ({ ...c, id: c.id || `call_${t0}_${i}` }));
    return {
      content, reasoning, toolCalls, finishReason, fingerprint,
      usage: { model: o.model, inputTokens, cachedInputTokens, outputTokens, reasoningTokens,
        costUsd: costUsd(o.model, inputTokens, cachedInputTokens, outputTokens), ms: Date.now() - t0, ttftMs: ttft },
    };
  } catch (err) {
    if (streamed) throw new StreamedError(err);
    throw err;
  }
}

// Nebius outages are short (~10-30 s of 503s), so ride them out: 2/4/8/12 s plus jitter.
const RETRY_BACKOFF_MS = [2000, 4000, 8000, 12000];
const RETRY_WAIT_CAP_MS = 15_000;

async function withRetry(o: ChatOpts): Promise<ChatResult> {
  for (let attempt = 0; ; attempt++) {
    try { return await execOnce(o); }
    catch (err: any) {
      if (err instanceof StreamedError || attempt >= RETRY_BACKOFF_MS.length) throw err;
      const status = err?.status as number | undefined;
      const retryable = status === undefined ? err?.name !== "TimeoutError" && err?.name !== "AbortError"
        : [429, 502, 503, 504].includes(status);
      if (!retryable) throw err;
      const ra = Number(err?.headers?.get?.("retry-after") ?? err?.headers?.["retry-after"]);
      const base = Math.max(RETRY_BACKOFF_MS[attempt]!, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0);
      await new Promise((r) => setTimeout(r, Math.min(base + Math.random() * 500, RETRY_WAIT_CAP_MS)));
    }
  }
}

export function streamChat(o: ChatOpts & { bestEffort: true }): Promise<ChatResult> | null;
export function streamChat(o: ChatOpts): Promise<ChatResult>;
export function streamChat(o: ChatOpts): Promise<ChatResult> | null {
  if (o.bestEffort) return nebiusLimiter.tryRunNow(() => execOnce(o), SUMMARY_SOFT_CAP);
  return nebiusLimiter.run(() => withRetry(o));
}
