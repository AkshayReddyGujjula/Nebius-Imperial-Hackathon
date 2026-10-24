import type {
  AgentInfo, AgentStatus, BlindSpot, Contradiction, Fact, Finding, LadderArm, Plan,
  Question, RunPhase, RunStats, ScoreProposal, Source, SourceRef, Synthesis, Usage,
} from "./types";

export type CruxEventBody =
  | { type: "run.started"; decision: string; inputMode: "text" | "voice"; replay: boolean; replayOf: string | null;
      models: { orchestrator: string; agent: string; summary: string; audit: string } }
  | { type: "run.phase"; phase: RunPhase }
  | { type: "reasoning.chunk"; actorId: string; text: string }        // actorId: "orchestrator" | "a1".. | "auditor"
  | { type: "reasoning.summary"; actorId: string; text: string }
  | { type: "plan.ready"; plan: Plan; usage: Usage }
  | { type: "agent.spawned"; agent: AgentInfo }
  | { type: "agent.status"; agentId: string; status: AgentStatus; round: number; sourcesRead: number; note: string | null }
  | { type: "search.started"; agentId: string; searchId: string; round: number; query: string }
  | { type: "search.done"; agentId: string; searchId: string; sources: SourceRef[]; ms: number; credits: number; error: string | null }
  | { type: "finding.added"; finding: Finding; source: Source | null }
  | { type: "scores.proposed"; agentId: string; proposals: ScoreProposal[] }
  | { type: "agent.done"; agentId: string; status: "done" | "failed" | "timeout"; answer: string; gaps: string[]; usage: Usage; error: string | null }
  | { type: "question.added"; question: Question }                    // P1 dig deeper / blind-spot research, P2 follow-up
  | { type: "blindspot.updated"; blindSpot: BlindSpot }
  | { type: "fact.added"; fact: Fact }
  | { type: "contradictions.ready"; contradictions: Contradiction[]; usage: Usage | null; error: string | null }
  | { type: "synthesis.started"; version: number }
  | { type: "synthesis.ready"; synthesis: Synthesis; usage: Usage }
  | { type: "synthesis.failed"; version: number; error: string }
  | { type: "stats.updated"; stats: RunStats }
  | { type: "ladder.started"; ladderId: string; questionId: string }
  | { type: "ladder.arm"; ladderId: string; arm: LadderArm }
  | { type: "plan.updated"; plan: Plan; reason: string }                // P2
  | { type: "nodes.stale"; nodeIds: string[]; reason: string }          // P2
  // The live conversation. Assistant turns usually end with one question; `suggestions` are 2–4 one-tap
  // multiple-choice answers (the UI always adds "Type my own answer"); `recommendedIndex` marks the likeliest
  // answer given user.md (null when none stands out).
  | { type: "chat.message"; id: string; role: "user" | "assistant"; text: string; suggestions: string[]; recommendedIndex: number | null }
  | { type: "memory.updated"; markdown: string; changes: string[]; by: string }  // shared user.md every agent reads
  | { type: "notice"; level: "info" | "warn" | "error"; message: string }
  | { type: "run.error"; message: string; fatal: boolean };

export type CruxEvent = CruxEventBody & { seq: number; ts: number; runId: string };
export type CruxEventType = CruxEvent["type"];
export type EventOf<T extends CruxEventType> = Extract<CruxEvent, { type: T }>;
