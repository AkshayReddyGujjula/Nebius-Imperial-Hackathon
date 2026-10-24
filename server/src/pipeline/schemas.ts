import { z } from "zod";

const FactKind = z.enum(["constraint", "priority", "fact", "feeling"]);
const EffortE = z.enum(["low", "high", "max"]);
const Conf = z.enum(["low", "medium", "high"]);

export const PlanOut = z.object({
  title: z.string().min(3).max(140),
  facts: z.array(z.object({
    kind: FactKind.catch("fact"), text: z.string(), quote: z.string().default(""),
  })).max(8).default([]),
  options: z.array(z.object({
    label: z.string(), description: z.string().default(""), origin: z.enum(["user", "ai"]).catch("user"),
  })).min(2).max(5),
  criteria: z.array(z.object({
    label: z.string(), description: z.string().default(""), weight: z.number().catch(5), weightReason: z.string().default(""),
  })).min(2).max(6),
  questions: z.array(z.object({
    text: z.string().min(10), why: z.string().default(""),
    optionIndexes: z.array(z.number().int()).default([]), criterionIndexes: z.array(z.number().int()).default([]),
    effort: EffortE.catch("high"), effortReason: z.string().default(""),
    seedQueries: z.array(z.string()).min(1).max(4),
  })).min(2).max(6),
  blindSpot: z.object({
    kind: z.enum(["missing_option", "unstated_assumption", "missing_criterion", "personal_unknown"]).catch("unstated_assumption"),
    text: z.string(), reason: z.string().default(""), quote: z.string().default(""),
    researchable: z.boolean().catch(false), seedQueries: z.array(z.string()).default([]),
  }).nullable().default(null),
});
export type PlanOut = z.infer<typeof PlanOut>;

const submitFields = {
  answer: z.string().default(""),
  findings: z.array(z.object({
    claim: z.string().min(5), quote: z.string().default(""), sourceId: z.string(),
    optionIds: z.array(z.string()).default([]), criterionIds: z.array(z.string()).default([]),
    confidence: Conf.catch("medium"),
  })).max(5).default([]),
  scores: z.array(z.object({
    optionId: z.string(), criterionId: z.string(), score: z.number(),
    rationale: z.string().default(""), findingNumbers: z.array(z.number().int()).default([]),
  })).max(30).default([]),
  gaps: z.array(z.string()).max(5).default([]),
};
export const SubmitOut = z.object(submitFields);
export type SubmitOut = z.infer<typeof SubmitOut>;

export const JsonActionOut = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), queries: z.array(z.string()).min(1).max(4) }),
  z.object({ action: z.literal("submit"), ...submitFields }),
]);
export type JsonActionOut = z.infer<typeof JsonActionOut>;

export const SynthesisOut = z.object({
  recommendation: z.string().min(3),
  optionId: z.string().nullable().catch(null),
  confidence: Conf.catch("medium"),
  summary: z.string(),
  conditions: z.array(z.string()).default([]),
  reasons: z.array(z.object({ text: z.string(), findingIds: z.array(z.string()).default([]) })).default([]),
  cruxes: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
  uncertainties: z.array(z.string()).default([]),
});
export type SynthesisOut = z.infer<typeof SynthesisOut>;

export const ContradictionOut = z.object({
  contradictions: z.array(z.object({
    a: z.string(), b: z.string(), severity: z.enum(["direct", "tension"]).catch("tension"), explanation: z.string().default(""),
  })).max(6).default([]),
});
export type ContradictionOut = z.infer<typeof ContradictionOut>;

export const FollowupOut = z.object({
  note: z.string().default(""),
  newFacts: z.array(z.object({ kind: FactKind.catch("fact"), text: z.string(), quote: z.string().default("") })).default([]),
  weightChanges: z.array(z.object({ criterionId: z.string(), weight: z.number(), reason: z.string().default("") })).default([]),
  newOptions: z.array(z.object({ label: z.string(), description: z.string().default("") })).default([]),
  staleQuestionIds: z.array(z.string()).default([]),
  newQuestions: z.array(z.object({
    text: z.string(), why: z.string().default(""), optionIds: z.array(z.string()).default([]),
    criterionIds: z.array(z.string()).default([]), effort: EffortE.catch("high"),
    effortReason: z.string().default(""), seedQueries: z.array(z.string()).default([]),
  })).default([]),
});
export type FollowupOut = z.infer<typeof FollowupOut>;
