import { describe, expect, it } from 'vitest'
import { MOCK_EVENTS } from '@/dev/mockRun'
import { reduce, type ReducerState } from './reducer'
import { initialRun, initialUi } from './runStore'
import { selectMatrix, selectQuestionLabel, selectQuestionTrust, selectRecommendationStale, selectTopStatus } from './selectors'

const fresh = (): ReducerState => ({ ...initialRun(true), ...initialUi() })
const play = (events = MOCK_EVENTS, s = fresh()): ReducerState =>
  events.reduce((acc, e) => { const p = reduce(acc, e); return p ? { ...acc, ...p } : acc }, s)

describe('reducer', () => {
  it('plays the full mock to done with the expected counts', () => {
    const s = play()
    expect(s.phase).toBe('done')
    expect(s.runId).toBe('mock-run')
    expect(Object.keys(s.agents)).toHaveLength(4)
    expect(Object.values(s.agents).every((a) => a.status === 'done')).toBe(true)
    expect(Object.keys(s.findings)).toHaveLength(10)
    expect(s.contradictions).toHaveLength(1)
    expect(s.synthesis).not.toBeNull()
    expect(s.synthesisStatus).toBe('ready')
    expect(s.lastSeq).toBe(MOCK_EVENTS.length)
    expect(s.activity.length).toBeGreaterThan(5)
    expect(new Set(s.activity.map((a) => a.id)).size).toBe(s.activity.length)
  })

  it('mock content matches the spec', () => {
    const s = play()
    expect(s.plan!.options).toHaveLength(3)
    expect(s.plan!.criteria).toHaveLength(5)
    expect(s.plan!.questions.map((q) => q.effort)).toEqual(['high', 'low', 'high', 'low'])
    expect(s.plan!.blindSpot).toMatchObject({ kind: 'personal_unknown', researchable: false })
    const fs = Object.values(s.findings)
    expect(fs.filter((f) => f.checks.quote === 'not_found')).toHaveLength(1)
    expect(fs.filter((f) => !f.checks.sourceRetrieved)).toHaveLength(1)
    for (const a of Object.values(s.agents)) {
      expect(a.searchIds.length).toBeGreaterThanOrEqual(2)
      expect(a.searchIds.length).toBeLessThanOrEqual(3)
      expect(s.reasoning[a.id]?.summary).toBeTruthy()
    }
    expect(s.reasoning.orchestrator.summary).toBeTruthy()
    const { cells, totals, leader } = selectMatrix(s)
    expect(cells).toHaveLength(15)
    expect(cells.filter((c) => c.score === null)).toHaveLength(2)
    expect(totals).toHaveLength(3)
    expect(leader).not.toBeNull()
    expect(MOCK_EVENTS.filter((e) => e.type === 'stats.updated').length).toBeGreaterThanOrEqual(30)
  })

  it('ignores a duplicate seq', () => {
    const s = play()
    const again = play(MOCK_EVENTS, s)
    expect(again).toBe(s)
    expect(reduce(s, MOCK_EVENTS[5])).toBeNull()
  })

  it('ignores events from another run', () => {
    const s = play(MOCK_EVENTS.slice(0, 3))
    expect(reduce(s, { ...MOCK_EVENTS[3], runId: 'other' })).toBeNull()
  })

  it('plan.ready initialises the weights', () => {
    const idx = MOCK_EVENTS.findIndex((e) => e.type === 'plan.ready')
    const s = play(MOCK_EVENTS.slice(0, idx + 1))
    expect(s.weights).toEqual({ c1: 9, c2: 6, c3: 5, c4: 7, c5: 3 })
    expect(s.overrides).toEqual({})
    expect(Object.keys(s.factSeq)).toHaveLength(5)
  })
})

describe('selectors', () => {
  it('derives status, trust, labels and staleness', () => {
    const s = play()
    expect(selectTopStatus(s).label).toBe('Done')
    expect(selectQuestionLabel(s, 'q3')).toBe('Q3')
    const t2 = selectQuestionTrust(s, 'q2')
    expect(t2).toMatchObject({ findings: 2, verified: 1, unverified: 1, agentStatus: 'done' })
    expect(selectQuestionTrust(s, 'q3').contradictions).toBe(1)
    expect(selectRecommendationStale(s)).toEqual({ stale: false, reasons: [] })
    expect(selectRecommendationStale({ ...s, weights: { ...s.weights, c1: 2 } }).reasons).toContain('Weights changed')
  })

  it('shows researching progress mid-run', () => {
    const idx = MOCK_EVENTS.findIndex((e) => e.type === 'agent.done')
    const s = play(MOCK_EVENTS.slice(0, idx))
    expect(selectTopStatus(s, s.startedTs! + 1000).label).toBe('Researching · 4 of 4 agents active')
  })
})
