import OpenAI from "openai";
import type { ChatCompletionChunk, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { costUsd, type Contradiction, type Usage } from "@shared/index";
import { CONFIG } from "../config";
import { parseJsonLoose } from "../llm/json";
import { nebiusLimiter } from "../llm/limiter";
import { CONTRADICTION_SYSTEM } from "../pipeline/prompts";
import type { RunContext } from "../runs/types";

const ContradictionOut = z.object({
  contradictions: z.array(z.object({
    a: z.string(), b: z.string(),
    severity: z.enum(["direct", "tension"]).catch("tension"),
    explanation: z.string().default(""),
  })).max(6).default([]),
});

// DECISION: the lane brief requires the SDK directly; share S1's parser and global limiter,
// while keeping the audit independent of its pipeline schemas and JSON repair calls.
async function requestAudit(messages: ChatCompletionMessageParam[]): Promise<{ content: string; usage: Usage; fingerprint: string | null }> {
  const client = new OpenAI({ apiKey: CONFIG.keys.nebius, baseURL: CONFIG.nebiusBaseUrl, maxRetries: 0 });
  const signal = AbortSignal.timeout(60_000);
  for (let attempt = 0; ; attempt++) {
    let streamed = false;
    try {
      return await nebiusLimiter.run(async () => {
        const started = Date.now();
        const stream = await client.chat.completions.create({
          model: CONFIG.models.audit, messages, stream: true, stream_options: { include_usage: true }, max_tokens: 6000,
          ...(CONFIG.auditEffort === "omit" ? {} : { reasoning_effort: CONFIG.auditEffort }),
          ...(CONFIG.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        }, { signal });
        let content = "", reasoning = "", fingerprint: string | null = null, ttftMs: number | null = null;
        let reportedUsage: ChatCompletionChunk["usage"];
        for await (const chunk of stream) {
          streamed = true;
          if (chunk.usage) reportedUsage = chunk.usage;
          if (chunk.system_fingerprint) fingerprint = chunk.system_fingerprint;
          const delta = chunk.choices[0]?.delta as (ChatCompletionChunk.Choice.Delta & {
            reasoning_content?: string; reasoning?: string;
          }) | undefined;
          const thought = delta?.reasoning_content ?? delta?.reasoning ?? "";
          if (thought || delta?.content) ttftMs ??= Date.now() - started;
          reasoning += thought;
          content += delta?.content ?? "";
        }
        const inputTokens = reportedUsage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4);
        const cachedInputTokens = reportedUsage?.prompt_tokens_details?.cached_tokens ?? 0;
        const outputTokens = reportedUsage?.completion_tokens ?? Math.ceil((content.length + reasoning.length) / 4);
        const reasoningTokens = reportedUsage?.completion_tokens_details?.reasoning_tokens ?? Math.ceil(reasoning.length / 4);
        return { content, fingerprint, usage: {
          model: CONFIG.models.audit, inputTokens, cachedInputTokens, outputTokens, reasoningTokens,
          costUsd: costUsd(CONFIG.models.audit, inputTokens, cachedInputTokens, outputTokens),
          ms: Date.now() - started, ttftMs,
        } };
      });
    } catch (error) {
      const retryable = error instanceof OpenAI.APIConnectionError ||
        (error instanceof OpenAI.APIError && [429, 502, 503, 504].includes(error.status ?? 0));
      if (streamed || attempt >= 2 || signal.aborted || !retryable) throw error;
      const retryAfter = error instanceof OpenAI.APIError ? Number(error.headers?.get("retry-after")) : 0;
      await delay((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000) + Math.random() * 500,
        undefined, { signal });
    }
  }
}

export async function auditContradictions(ctx: RunContext): Promise<void> {
  try {
    const findings = [...ctx.state.findings.values()].filter((f) => !f.stale);
    if (new Set(findings.map((f) => f.agentId)).size < 2) {
      ctx.state.contradictions = [];
      ctx.emit({ type: "contradictions.ready", contradictions: [], usage: null, error: null });
      return;
    }
    const questions = new Map(ctx.state.plan?.questions.map((q) => [q.id, q.text]) ?? []);
    const result = await requestAudit([
      { role: "system", content: CONTRADICTION_SYSTEM },
      { role: "user", content: findings.map((f) =>
        `${f.id} (agent ${f.agentId} · question: ${questions.get(f.questionId) ?? f.questionId}): ${f.claim} — quote: "${f.quote}"`
      ).join("\n") },
    ]);
    ctx.recordUsage("auditor", result.usage, result.fingerprint);
    const data = ContradictionOut.parse(parseJsonLoose(result.content));
    const byId = new Map(findings.map((f) => [f.id, f]));
    const seen = new Set<string>();
    const contradictions: Contradiction[] = [];
    for (const pair of data.contradictions) {
      const a = byId.get(pair.a), b = byId.get(pair.b);
      if (!a || !b || a.agentId === b.agentId) continue;
      const key = JSON.stringify([a.id, b.id].sort());
      if (seen.has(key)) continue;
      seen.add(key);
      contradictions.push({
        id: ctx.nextId("contradiction"), findingIds: [a.id, b.id], severity: pair.severity,
        explanation: pair.explanation, model: CONFIG.models.audit,
      });
      if (contradictions.length === 4) break;
    }
    ctx.state.contradictions = contradictions;
    ctx.emit({ type: "contradictions.ready", contradictions, usage: result.usage, error: null });
  } catch {
    // Audit failures and even a failed event sink must never abort the research pipeline.
    try {
      ctx.state.contradictions = [];
      ctx.emit({ type: "contradictions.ready", contradictions: [], usage: null, error: "Audit unavailable" });
    } catch { /* Best effort: the caller can continue even if the event sink is unavailable. */ }
  }
}
