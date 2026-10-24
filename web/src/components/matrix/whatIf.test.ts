import { describe, expect, it } from 'vitest'
import { buildCells } from '@shared/matrix'
import type { Criterion, Option, ScoreProposal } from '@shared/types'
import { smallestRankFlip } from './whatIf'

const options: Option[] = [
  { id: 'a', label: 'A', description: '', origin: 'user' },
  { id: 'b', label: 'B', description: '', origin: 'user' },
]
const crit = (id: string, weight: number): Criterion => ({ id, label: id, description: '', weight, weightReason: '' })
const prop = (optionId: string, criterionId: string, score: number) =>
  ({ optionId, criterionId, score, rationale: '', findingIds: [] }) as unknown as ScoreProposal

describe('smallestRankFlip', () => {
  it('finds the smallest single weight change that changes #1', () => {
    const criteria = [crit('speed', 6), crit('privacy', 4)]
    // A: speed 5, privacy 1 → (30+4)/10 = 3.4 ; B: speed 2, privacy 5 → (12+20)/10 = 3.2
    const cells = buildCells(options, criteria, [prop('a', 'speed', 5), prop('a', 'privacy', 1), prop('b', 'speed', 2), prop('b', 'privacy', 5)], {})
    const flip = smallestRankFlip(options, criteria, cells, {})
    expect(flip).toMatchObject({ newLeaderId: 'b', delta: 1, criterionId: 'privacy', from: 4, to: 5 })
  })

  it('returns null when no single change flips the leader', () => {
    const criteria = [crit('x', 5)]
    const cells = buildCells(options, criteria, [prop('a', 'x', 5), prop('b', 'x', 1)], {})
    expect(smallestRankFlip(options, criteria, cells, {})).toBeNull()
  })
})
