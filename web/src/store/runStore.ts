import { create } from 'zustand'
import type { CruxStore, RunData, UiState, ViewMode } from './types'

function savedViewMode(): ViewMode {
  try { return localStorage.getItem('crux.viewMode') === 'detailed' ? 'detailed' : 'simple' }
  catch { return 'simple' }
}

const initialRun = (mock = false): RunData => ({
  runId: null, lastSeq: 0, mock, decision: '', inputMode: 'text', replay: false,
  startedTs: null, phase: 'idle', doneTs: null, plan: null,
  agents: {}, agentByQuestion: {}, searches: {}, sources: {}, findings: {},
  findingSeq: {}, factSeq: {}, proposals: [], contradictions: [],
  contradictionsStatus: 'idle', synthesis: null, synthesisSeq: 0,
  synthesisStatus: 'idle', stats: null, reasoning: {}, activity: [], ladders: {},
  notices: [], fatalError: null,
})

const initialUi = (): UiState => ({
  viewMode: savedViewMode(), selectedNodeId: null, selectedCellKey: null,
  matrixOpen: false, railTab: 'timeline', weights: {}, overrides: {},
  lastRerank: null, userMovedViewport: false, draft: '', draftInputMode: 'text',
})

export const useCrux = create<CruxStore>()((set) => ({
  ...initialRun(), ...initialUi(),
  ingest: () => {}, // Phase 0 stub: Lane W3 installs the event reducer.
  reset: (opts) => set((s) => ({ ...initialRun(opts?.mock), ...initialUi(), viewMode: s.viewMode })),
  setViewMode: (viewMode) => {
    try { localStorage.setItem('crux.viewMode', viewMode) } catch { /* Storage may be unavailable. */ }
    set({ viewMode })
  },
  select: (selectedNodeId) => set({ selectedNodeId, selectedCellKey: null }),
  selectCell: (selectedCellKey) => set({ selectedCellKey, selectedNodeId: null }),
  setMatrixOpen: (matrixOpen) => set({ matrixOpen }),
  setRailTab: (railTab) => set({ railTab }),
  setWeight: (criterionId, weight) => set((s) => {
    const to = Math.max(0, Math.min(10, Math.round(weight)))
    const from = s.weights[criterionId] ?? s.plan?.criteria.find((c) => c.id === criterionId)?.weight ?? 0
    return { weights: { ...s.weights, [criterionId]: to }, lastRerank: { criterionId, from, to, ts: Date.now() } }
  }),
  setOverride: (cellKey, score) => set((s) => {
    const overrides = { ...s.overrides }
    if (score === null) delete overrides[cellKey]
    else overrides[cellKey] = Math.max(1, Math.min(5, score))
    return { overrides }
  }),
  setUserMovedViewport: (userMovedViewport) => set({ userMovedViewport }),
  setDraft: (draft, mode) => set((s) => ({ draft, draftInputMode: mode ?? s.draftInputMode })),
}))
