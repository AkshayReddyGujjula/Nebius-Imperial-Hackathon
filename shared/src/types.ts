export type Effort = "low" | "high" | "max";
export const EFFORT_ORDER: Effort[] = ["low", "high", "max"];

export type FactKind = "constraint" | "priority" | "fact" | "feeling";
export interface Fact {
  id: string;                    // "f1"
  kind: FactKind;
  text: string;                  // short paraphrase: "Exam is worth 40% of the module"
  quote: string | null;          // verbatim span of the user's words (validated), else null
  origin: "user" | "blindspot_answer" | "followup";
}

export interface Option {
  id: string;                    // "o1"
  label: string;                 // ≤ 5 words: "Go until 15:00"
  description: string;
  origin: "user" | "ai";
}

export interface Criterion {
  id: string;                    // "c1"
  label: string;                 // phrased so higher = better: "Exam performance"
  description: string;
  weight: number;                // integer 0..10 as inferred by the orchestrator
  weightReason: string;
}

export type QuestionOrigin = "plan" | "blindspot" | "dig_deeper" | "followup";
export interface Question {
  id: string;                    // "q1"
  text: string;
  why: string;
  optionIds: string[];
  criterionIds: string[];
  effort: Effort;                // effective (after clamp / bump)
  effortRequested: Effort;       // what the orchestrator asked for
  effortReason: string;
  seedQueries: string[];
  parentNodeId: string | null;   // graph node id this branch grows from; null = decision root
  origin: QuestionOrigin;
  stale: boolean;
}

export type BlindSpotKind = "missing_option" | "unstated_assumption" | "missing_criterion" | "personal_unknown";
export interface BlindSpot {
  id: string;                    // "bs1"
  kind: BlindSpotKind;
  text: string;                  // phrased as a question to the user
  reason: string;
  quote: string | null;          // verbatim span of the user's words it relates to
  researchable: boolean;
  seedQueries: string[];
  status: "open" | "researching" | "answered" | "dismissed";
  answer: string | null;
  questionId: string | null;     // set when "Research it" spawned a question/agent
}

export interface Plan {
  version: number;               // 1 for the first plan; P2 follow-ups increment
  title: string;
  facts: Fact[];
  options: Option[];
  criteria: Criterion[];
  questions: Question[];
  blindSpot: BlindSpot | null;
}

export type AgentStatus = "queued" | "searching" | "reading" | "thinking" | "writing" | "done" | "failed" | "timeout";
export interface AgentInfo {
  id: string;                    // "a1"
  questionId: string;
  effort: Effort;
  model: string;
  extraRounds: number;           // search rounds the model may request after the seeded round
  startedAt: number;             // epoch ms
}

export interface SourceRef {
  id: string;                    // "s1" — unique per run, deduplicated by canonical URL
  url: string;
  title: string;
  domain: string;                // "nature.com"
  score: number;                 // Tavily relevance 0..1
  publishedDate: string | null;
}
export interface Source extends SourceRef {
  content: string;               // merged Tavily chunks for this URL (≤ 4000 chars sent to client)
}

export type QuoteCheck = "verified" | "partial" | "not_found" | "no_quote";
export interface FindingChecks {
  sourceRetrieved: boolean;      // cited source id was actually shown to THIS agent
  quote: QuoteCheck;
  quoteMatchRatio: number;       // 0..1 (1 = exact)
  supported: boolean;            // sourceRetrieved && (quote is verified|partial)
}

export interface Finding {
  id: string;                    // "F1" (capital F: used inside prompts)
  agentId: string;
  questionId: string;
  claim: string;
  quote: string;
  sourceId: string;
  optionIds: string[];
  criterionIds: string[];
  confidence: "low" | "medium" | "high";
  checks: FindingChecks;
  stale: boolean;
}

export interface ScoreProposal {
  optionId: string;
  criterionId: string;
  score: number;                 // integer 1..5, 5 = best for that criterion
  rationale: string;
  findingIds: string[];
  agentId: string;
}

export interface Contradiction {
  id: string;                    // "x1"
  findingIds: [string, string];
  severity: "direct" | "tension";
  explanation: string;
  model: string;
}

export interface Synthesis {
  version: number;               // 1, 2, … (re-synthesis increments)
  recommendation: string;        // ≤ 14 words, imperative
  optionId: string | null;       // null = hybrid / none of the options exactly
  confidence: "low" | "medium" | "high";
  summary: string;
  conditions: string[];          // "If …, then …"
  reasons: { text: string; findingIds: string[] }[];
  cruxes: string[];
  nextSteps: string[];
  uncertainties: string[];
  basedOnWeights: Record<string, number>;   // criterionId → weight used
  basedOnFactIds: string[];
  createdAt: number;
}

export interface Usage {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;          // includes reasoning tokens
  reasoningTokens: number;
  costUsd: number;
  ms: number;
  ttftMs: number | null;
}

export interface ModelStats { calls: number; inputTokens: number; outputTokens: number; reasoningTokens: number; costUsd: number }
export interface RunStats {
  wallMs: number;                // run start → now (or → done)
  agentPhaseWallMs: number;      // first plan-agent start → last plan-agent end (or now)
  agentMsSum: number;            // Σ each plan agent's own duration
  speedup: number;               // agentMsSum / agentPhaseWallMs (1 if undefined)
  llmCalls: number;
  tavilySearches: number;
  tavilyCredits: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costUsd: number;               // Nebius only
  byModel: Record<string, ModelStats>;
  findings: number;
  quoteVerified: number;
  quotePartial: number;
  quoteNotFound: number;
  noQuote: number;
  sourceNotRetrieved: number;
  contradictions: number;
  jsonRepairs: number;
  fingerprint: string | null;    // system_fingerprint from DeepSeek responses, if any
}

export interface LadderArm {
  effort: Effort;
  status: "running" | "done" | "failed";
  ms: number;
  reasoningTokens: number;
  outputTokens: number;
  costUsd: number;
  findings: number;
  quotePassRate: number;         // (verified + partial) / findings, 0..1
  answer: string;
  error: string | null;
}

export type RunPhase = "planning" | "researching" | "checking" | "synthesizing" | "done" | "error";
