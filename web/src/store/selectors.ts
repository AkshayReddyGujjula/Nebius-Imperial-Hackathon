import type { AgentStatus, MatrixCell, OptionTotal } from '@shared/index'
import type { ActivityTone, CruxStore } from './types'

// Phase 0 stubs: Lane W3 supplies derivation and memoisation.
export function selectMatrix(_s: CruxStore): { cells: MatrixCell[]; totals: OptionTotal[]; leader: OptionTotal | null } {
  return { cells: [], totals: [], leader: null }
}

export function selectRecommendationStale(_s: CruxStore): { stale: boolean; reasons: string[] } {
  return { stale: false, reasons: [] }
}

export function selectQuestionTrust(_s: CruxStore, _questionId: string): {
  sources: number; findings: number; verified: number; unverified: number;
  contradictions: number; agentStatus: AgentStatus | null;
} {
  return { sources: 0, findings: 0, verified: 0, unverified: 0, contradictions: 0, agentStatus: null }
}

export function selectTopStatus(_s: CruxStore): { label: string; tone: ActivityTone; elapsedMs: number } {
  return { label: '', tone: 'neutral', elapsedMs: 0 }
}

export function selectQuestionLabel(_s: CruxStore, _questionId: string): string {
  return ''
}
