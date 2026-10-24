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
