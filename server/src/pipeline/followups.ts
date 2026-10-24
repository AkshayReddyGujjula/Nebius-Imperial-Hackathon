import type { RunContext } from "../runs/types";

export async function digDeeper(ctx: RunContext, nodeId: string): Promise<{ questionId: string }> {
  throw new Error("not implemented: digDeeper");
}

export async function researchBlindSpot(ctx: RunContext): Promise<{ questionId: string }> {
  throw new Error("not implemented: researchBlindSpot");
}

export async function answerBlindSpot(ctx: RunContext, answer: string): Promise<void> {
  throw new Error("not implemented: answerBlindSpot");
}

export async function resynthesize(ctx: RunContext, weights: Record<string, number>): Promise<void> {
  throw new Error("not implemented: resynthesize");
}

export async function runLadder(ctx: RunContext, questionId: string): Promise<{ ladderId: string }> {
  throw new Error("not implemented: runLadder");
}

export async function applyFollowup(ctx: RunContext, text: string): Promise<void> {
  throw new Error("not implemented: applyFollowup");
}
