import { describe, expect, it } from 'vitest'
import { clip, splitIf } from './text'

describe('summary text', () => {
  it('clips at a word boundary and strips citations', () => {
    expect(clip('Rest before the exam improves recall a lot [f2, f3]. More text.', 5)).toBe('Rest before the exam improves…')
    expect(clip('Short one (f1).', 10)).toBe('Short one')
  })
  it('splits conditions', () => {
    expect(splitIf('If you value grades most, then skip the hackathon — rest instead')).toEqual({ care: 'grades', pick: 'skip the hackathon' })
    expect(splitIf('Go anyway')).toBeNull()
  })
})
