export interface CreateRunRequest { decision: string; inputMode: "text" | "voice" }
export interface CreateRunResponse { runId: string }
export interface DeeperRequest { nodeId: string }                 // "q:q2" or "f:F5"
export interface DeeperResponse { questionId: string }
export interface BlindSpotAnswerRequest { answer: string }
export interface SynthesizeRequest { weights: Record<string, number> }
export interface LadderRequest { questionId: string }
export interface LadderResponse { ladderId: string }
export interface FollowupRequest { text: string }                 // P2
export interface TranscribeResponse { text: string; ms: number; provider: "elevenlabs" }
export interface ReplayInfo { file: string; decision: string; recordedAt: string; events: number; durationMs: number }
export interface CreateReplayRequest { file: string; speed?: number }
export interface HealthResponse {
  ok: true;
  keys: { nebius: boolean; tavily: boolean; elevenlabs: boolean };
  models: { orchestrator: string; agent: string; summary: string; audit: string };
  agentMode: "tools" | "json";
  jsonMode: boolean;
}
export interface ApiError { error: string }

/** Interview step before a run: the orchestrator asks the user tailored questions first. */
export interface ClarifyRequest { decision: string }
export interface ClarifyQuestion {
  id: string;                    // "k1"
  question: string;              // ≤ 20 words, second person
  why: string;                   // ≤ 15 words: why the answer changes the research
  suggestions: string[];         // 2–4 short one-tap answers
}
export interface ClarifyResponse { questions: ClarifyQuestion[]; ms: number; model: string }

/** One user turn in the live conversation (POST /api/runs/:id/chat). The reply arrives as chat.message events. */
export interface ChatRequest { text: string; inputMode?: "text" | "voice" }
export interface ChatResponse { ok: true }
