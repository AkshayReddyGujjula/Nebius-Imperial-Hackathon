import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import type { Effort } from "@shared/types";

loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
const env = (k: string, d = "") => (process.env[k] ?? "").trim() || d;

export const CONFIG = {
  port: Number(env("PORT", "8787")),
  keys: { nebius: env("NEBIUS_API_KEY"), tavily: env("TAVILY_API_KEY"), elevenlabs: env("ELEVENLABS_API_KEY") },
  nebiusBaseUrl: "https://api.tokenfactory.nebius.com/v1/",
  models: {
    orchestrator: env("ORCHESTRATOR_MODEL", "deepseek-ai/DeepSeek-V4.1-Flash-1017"),
    agent: env("AGENT_MODEL", "deepseek-ai/DeepSeek-V4.1-Flash-1017"),
    summary: env("SUMMARY_MODEL", "zai-org/GLM-5.3-Flash"),
    audit: env("AUDIT_MODEL", "MiniMaxAI/MiniMax-M3.1-Flash"),
  },
  agentMode: (env("AGENT_MODE", "tools") === "json" ? "json" : "tools") as "tools" | "json",
  jsonMode: env("JSON_MODE", "true") === "true",
  summaryEffort: (env("SUMMARY_EFFORT", "none") === "omit" ? "omit" : "none") as "none" | "omit",
  auditEffort: env("AUDIT_EFFORT", "low") as "low" | "none" | "omit",
  tavilyDepth: (env("TAVILY_DEPTH", "advanced") === "basic" ? "basic" : "advanced") as "basic" | "advanced",
  maxQuestions: Number(env("MAX_QUESTIONS", "4")),
  softDeadlineMs: Number(env("SOFT_DEADLINE_MS", "100000")),
  corsOrigin: env("CORS_ORIGIN"),
  runsDir: fileURLToPath(new URL("../runs/", import.meta.url)),
  replaysDir: fileURLToPath(new URL("../replays/", import.meta.url)),
  webDist: fileURLToPath(new URL("../../web/dist/", import.meta.url)),
};

export interface EffortProfile {
  reasoningEffort: Effort; seedQueries: number; extraRounds: number; queriesPerRound: number;
  maxTokens: number; turnTimeoutMs: number; agentTimeoutMs: number;
}
export const EFFORT: Record<Effort, EffortProfile> = {
  low:  { reasoningEffort: "low",  seedQueries: 2, extraRounds: 0, queriesPerRound: 2, maxTokens: 8000,  turnTimeoutMs: 45_000, agentTimeoutMs: 70_000 },
  high: { reasoningEffort: "high", seedQueries: 2, extraRounds: 1, queriesPerRound: 2, maxTokens: 16000, turnTimeoutMs: 60_000, agentTimeoutMs: 110_000 },
  max:  { reasoningEffort: "max",  seedQueries: 3, extraRounds: 2, queriesPerRound: 2, maxTokens: 32000, turnTimeoutMs: 90_000, agentTimeoutMs: 150_000 },
};
export const bumpEffort = (e: Effort): Effort => (e === "low" ? "high" : "max");
