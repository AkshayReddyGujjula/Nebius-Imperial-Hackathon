export const PRICES_PER_M: Record<string, { in: number; cachedIn: number; out: number }> = {
  "deepseek-ai/DeepSeek-V4.1-Flash-1017": { in: 0.30, cachedIn: 0.006, out: 1.20 },
  "deepseek-ai/DeepSeek-V4.1-Flash":      { in: 0.30, cachedIn: 0.01,  out: 1.20 },
  "zai-org/GLM-5.3-Flash":                { in: 0.15, cachedIn: 0.15,  out: 0.50 },
  "MiniMaxAI/MiniMax-M3.1-Flash":         { in: 0.15, cachedIn: 0.15,  out: 0.60 },
  "nvidia/Nemotron-3_5-Lightning":        { in: 0.06, cachedIn: 0.06,  out: 0.24 },
  "Qwen/Qwen3-30B-A3B-Instruct-2507":     { in: 0.10, cachedIn: 0.10,  out: 0.30 },
};
export const TAVILY_USD_PER_CREDIT = 0.008;

import { MODEL_CATALOG } from "./models";
for (const m of MODEL_CATALOG) if (!PRICES_PER_M[m.id]) PRICES_PER_M[m.id] = { in: m.in, cachedIn: m.in, out: m.out };

export function costUsd(model: string, inputTokens: number, cachedInputTokens: number, outputTokens: number): number {
  const p = PRICES_PER_M[model];
  if (!p) return 0;
  const uncached = Math.max(0, inputTokens - cachedInputTokens);
  return (uncached * p.in + cachedInputTokens * p.cachedIn + outputTokens * p.out) / 1_000_000;
}
