import type {
  AgentInfo, AgentStatus, Contradiction, CruxEvent, CruxEventBody, Finding, Plan,
  RunPhase, ScoreProposal, Source, Synthesis, Usage,
} from "@shared/index";

export interface AgentRuntime {
  info: AgentInfo;
  status: AgentStatus;
  shownSourceIds: Set<string>;      // every source id included in this agent's prompts (URL check uses this)
  promptSourcesText: string;        // exact formatted source blocks this agent read (effort ladder reuses it)
  findingIds: string[];
  answer: string;
  gaps: string[];
  startedAt: number;
  endedAt: number | null;
  usage: Usage[];
}

export type CounterKind = "question" | "agent" | "finding" | "source" | "fact" | "contradiction" | "search" | "ladder";

export interface RunState {
  id: string;
  decision: string;
  inputMode: "text" | "voice";
  replay: boolean;
  createdAt: number;
  phase: RunPhase;
  plan: Plan | null;
  agents: Map<string, AgentRuntime>;     // by agent id
  sources: Map<string, Source>;          // by source id
  sourceIdByUrl: Map<string, string>;    // canonicalUrl → source id
  findings: Map<string, Finding>;        // by finding id
  proposals: ScoreProposal[];
  contradictions: Contradiction[];
  synthesis: Synthesis | null;
  usages: { actorId: string; usage: Usage }[];
  tavily: { searches: number; credits: number };
  jsonRepairs: number;
  fingerprint: string | null;
  counters: Record<CounterKind, number>;
  /** Shared memory about the user (user.md). Every prompt includes it; every chat turn may update it. */
  memory: string;
  /** The live conversation, oldest first. */
  chat: { id: string; role: "user" | "assistant"; text: string }[];
}

export interface RunContext {
  state: RunState;
  /** Assigns seq/ts/runId, appends to the in-memory log and the JSONL file, wakes SSE readers. */
  emit(body: CruxEventBody): CruxEvent;
  /** "q5" | "a3" | "F12" | "s40" | "f7" | "x2" | "srch17" | "L1" */
  nextId(kind: CounterKind): string;
  /** Records an LLM call's usage; triggers a throttled stats.updated. */
  recordUsage(actorId: string, usage: Usage, fingerprint?: string | null): void;
  /** Recomputes and emits stats.updated immediately. */
  flushStats(): void;
}
