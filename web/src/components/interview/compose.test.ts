import { describe, expect, it } from 'vitest'
import { ANSWERS_HEADER, composeDecision } from './compose'

describe('composeDecision', () => {
  it('returns the original when nothing was answered', () => {
    expect(composeDecision('Should I go?', [])).toBe('Should I go?')
    expect(composeDecision('Should I go?', [{ question: 'Q?', answer: '  ' }])).toBe('Should I go?')
  })

  it('appends one line per answer', () => {
    const out = composeDecision('Should I go?', [
      { question: 'How prepared are you?', answer: '70%' },
      { question: 'Is it graded?', answer: 'Yes, 40%' },
    ])
    expect(out).toBe(`Should I go?${ANSWERS_HEADER}- How prepared are you? 70%\n- Is it graded? Yes, 40%`)
  })

  it('caps the total at 4000 by trimming answers', () => {
    const original = 'x'.repeat(3500)
    const out = composeDecision(original, [
      { question: 'Q1?', answer: 'a'.repeat(600) },
      { question: 'Q2?', answer: 'b'.repeat(600) },
    ])
    expect(out.length).toBeLessThanOrEqual(4000)
    expect(out.startsWith(original + ANSWERS_HEADER)).toBe(true)
    expect(out).toContain('- Q1? a')
    expect(out).toContain('- Q2? b')
  })

  it('falls back to the original when there is no room', () => {
    const original = 'x'.repeat(3990)
    expect(composeDecision(original, [{ question: 'Q?', answer: 'yes' }])).toBe(original)
  })
})
