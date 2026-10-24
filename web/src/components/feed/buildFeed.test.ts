import { describe, expect, it } from 'vitest'
import { MOCK_EVENTS } from '@/dev/mockRun'
import { reduce, type ReducerState } from '@/store/reducer'
import { initialRun, initialUi } from '@/store/runStore'
import { buildFeed, modelName } from './buildFeed'

describe('buildFeed', () => {
  it('names models readably', () => {
    expect(modelName('deepseek-ai/DeepSeek-V4.1-Flash-1017')).toBe('DeepSeek V4.1 Flash')
    expect(modelName('nvidia/Nemotron-3_5-Lightning')).toBe('Nemotron 3.5 Lightning')
    expect(modelName('MiniMaxAI/MiniMax-M3.1-Flash')).toBe('MiniMax M3.1 Flash')
  })

  it('turns the mock run into prioritised cards with a pinned brief', () => {
    let s: ReducerState = { ...initialRun(true), ...initialUi() }
    for (const e of MOCK_EVENTS) s = { ...s, ...(reduce(s, e) ?? {}) }
    const items = buildFeed(MOCK_EVENTS.filter((e) => e.type !== 'reasoning.chunk'), s)
    expect(items.some((i) => i.title.startsWith('Decision brief') && i.priority === 3)).toBe(true)
    expect(items.some((i) => i.actor.kind === 'auditor' && i.priority === 3)).toBe(true)
    expect(items.filter((i) => i.actor.kind === 'narrator').length).toBeLessThanOrEqual(8)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })
})
