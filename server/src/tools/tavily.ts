import type { Source } from "@shared/index";
import type { RunContext } from "../runs/types";

export interface SearchOutcome {
  searchId: string; query: string;
  sources: Source[];        // this search's results (deduplicated against the run registry), content = THIS result's chunk text
  ms: number; credits: number; error: string | null;
}

export async function searchAndRegister(ctx: RunContext, agentId: string, round: number, query: string): Promise<SearchOutcome> {
  throw new Error("not implemented: searchAndRegister");
}

export function formatBlocks(outcomes: SearchOutcome[]): string {   // §9.2 source block format
  throw new Error("not implemented: formatBlocks");
}
