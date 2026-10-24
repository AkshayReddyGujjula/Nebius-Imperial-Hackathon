// Pre-run interview: a few personal questions before research starts. No RunContext exists yet.
import type { ClarifyQuestion, ClarifyResponse } from "@shared/api";
import { CONFIG } from "../config";
import { callJson } from "../llm/json";
import type { RunContext } from "../runs/types";
import { CLARIFY_SYSTEM } from "./prompts";
import { ClarifyOut } from "./schemas";

/** callJson only touches recordUsage and state.jsonRepairs, so a stub is enough here. */
const stubContext = (): RunContext => ({ recordUsage: () => {}, state: { jsonRepairs: 0 } }) as unknown as RunContext;

export async function clarify(decision: string): Promise<ClarifyResponse> {
  const started = Date.now();
  const model = CONFIG.models.orchestrator;
  const { data } = await callJson(stubContext(), "clarify", ClarifyOut, {
    model, reasoningEffort: "low", maxTokens: 4000, timeoutMs: 30_000,
    messages: [
      { role: "system", content: CLARIFY_SYSTEM },
      { role: "user", content: `The person's decision, in their own words:\n"""\n${decision}\n"""` },
    ],
  });
  const questions: ClarifyQuestion[] = data.questions
    .map((q) => ({
      question: q.question.trim(),
      why: q.why.trim(),
      suggestions: [...new Set(q.suggestions.map((s) => s.trim()).filter(Boolean))].slice(0, 4),
    }))
    .filter((q) => q.question)
    .slice(0, 4)
    .map((q, i) => ({ id: `k${i + 1}`, ...q }));
  if (!questions.length) throw new Error("Model returned no questions");
  return { questions, ms: Date.now() - started, model };
}
