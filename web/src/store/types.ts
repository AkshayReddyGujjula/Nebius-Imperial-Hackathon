import type {
  AgentInfo, AgentStatus, Contradiction, CruxEvent, Effort, Finding, LadderArm, Plan,
  RunPhase, RunStats, ScoreProposal, Source, SourceRef, Synthesis, Usage,
} from "@shared/index";

export type ViewMode = "simple" | "detailed";

export interface SearchView {
  id: string; agentId: string; round: number; query: string;
  status: "running" | "done" | "failed"; sources: SourceRef[]; ms: number; error: string | null; ts: number;
}
export interface AgentView extends AgentInfo {
  status: AgentStatus; round: number; sourcesRead: number; note: string | null;
  answer: string; gaps: string[]; usage: Usage | null; error: string | null; endedAt: number | null;
  searchIds: string[]; findingIds: string[];
}
export interface ReasoningView { raw: string; summary: string | null; summaries: { ts: number; text: string }[] }
export type ActivityTone = "neutral" | "accent" | "ok" | "warn" | "bad";
export interface ActivityItem {
  id: string; ts: number; actorId: string | null; tone: ActivityTone;
  simple: string | null;           // null → hidden in Simple mode
  title: string;                   // Detailed title
  detail: string | null;           // Detailed second line (mono where it is a query/model)
  nodeId: string | null;           // clicking the item selects this node
}
export interface LadderView { id: string; questionId: string; arms: Partial<Record<Effort, LadderArm>> }

export interface RunData {
  runId: string | null;
  lastSeq: number;
  mock: boolean;                   // true when playing dev/mockRun (shows a "Mock data" pill)
  decision: string;
  inputMode: "text" | "voice";
  replay: boolean;
  startedTs: number | null;
  phase: RunPhase | "idle";
  doneTs: number | null;
  plan: Plan | null;
  agents: Record<string, AgentView>;
  agentByQuestion: Record<string, string>;
  searches: Record<string, SearchView>;
  sources: Record<string, Source>;
  findings: Record<string, Finding>;
  findingSeq: Record<string, number>;
  factSeq: Record<string, number>;
  proposals: ScoreProposal[];
  contradictions: Contradiction[];
  contradictionsStatus: "idle" | "ready" | "failed";
  synthesis: Synthesis | null;
  synthesisSeq: number;
  synthesisStatus: "idle" | "running" | "ready" | "failed";
  stats: RunStats | null;
  reasoning: Record<string, ReasoningView>;
  activity: ActivityItem[];
  ladders: Record<string, LadderView>;
  notices: { id: string; level: "info" | "warn" | "error"; message: string; ts: number }[];
  fatalError: string | null;
  /** The live conversation (chat.message events), oldest first. */
  chat: { id: string; role: "user" | "assistant"; text: string; suggestions: string[]; recommendedIndex: number | null; ts: number }[];
  /** Shared memory about the user (user.md) and what changed last. */
  memory: string;
  memoryChanges: string[];
  memorySeq: number;
  /** Per user chat message id: what that message saved to user.md and the research it started. */
  receipts: Record<string, { memory: string[]; research: string[] }>;
  /** Raw event log for the live feed (reasoning.chunk excluded), oldest first. */
  feedLog: CruxEvent[];
}

export interface UiState {
  viewMode: ViewMode;
  selectedNodeId: string | null;
  selectedCellKey: string | null;  // "o2|c1"
  matrixOpen: boolean;
  railTab: "timeline" | "checks";
  weights: Record<string, number>;
  overrides: Record<string, number>;
  lastRerank: { criterionId: string; from: number; to: number; ts: number } | null;
  userMovedViewport: boolean;
  draft: string;
  draftInputMode: "text" | "voice";
}

export interface StoreActions {
  ingest(e: CruxEvent): void;
  reset(opts?: { mock?: boolean }): void;
  setViewMode(m: ViewMode): void;
  select(nodeId: string | null): void;
  selectCell(key: string | null): void;
  setMatrixOpen(open: boolean): void;
  setRailTab(t: UiState["railTab"]): void;
  setWeight(criterionId: string, weight: number): void;
  setOverride(cellKey: string, score: number | null): void;
  setUserMovedViewport(v: boolean): void;
  setDraft(s: string, mode?: "text" | "voice"): void;
}

export type CruxStore = RunData & UiState & StoreActions;
